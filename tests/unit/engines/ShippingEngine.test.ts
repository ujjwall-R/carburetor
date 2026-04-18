import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ShippingEngine } from '../../../src/engines/ShippingEngine.js';
import { ExecutionStatus, ProjectType, StepType } from '../../../src/models/enums.js';
import {
  makeDeploymentRequest,
  makePipeline,
  makePipelineStep,
  makePendingPipelineResult,
  makeFailedPipelineResult,
} from '../../helpers/fixtures.js';
import { makeVCSAccessMock, makeCSPAccessMock, makeExecutorMock } from '../../helpers/mocks.js';

describe('ShippingEngine', () => {
  let vcsMock: ReturnType<typeof makeVCSAccessMock>;
  let cspMock: ReturnType<typeof makeCSPAccessMock>;
  let executorMock: ReturnType<typeof makeExecutorMock>;
  let engine: ShippingEngine;

  beforeEach(() => {
    vcsMock = makeVCSAccessMock();
    cspMock = makeCSPAccessMock();
    executorMock = makeExecutorMock();
    engine = new ShippingEngine(vcsMock as any, cspMock as any, executorMock as any);
  });

  // ─── validateCredentials ──────────────────────────────────────────────────

  describe('validateCredentials', () => {
    it('returns valid=true when both VCS and CSP credentials are valid', async () => {
      const result = await engine.validateCredentials(makeDeploymentRequest());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid=false when VCS credentials are invalid', async () => {
      vcsMock.validateCredentials.mockResolvedValueOnce(false);
      const result = await engine.validateCredentials(makeDeploymentRequest());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('vcs'))).toBe(true);
    });

    it('returns valid=false when CSP credentials are invalid', async () => {
      cspMock.validateCredentials.mockResolvedValueOnce(false);
      const result = await engine.validateCredentials(makeDeploymentRequest());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('cloud') || e.toLowerCase().includes('csp'))).toBe(true);
    });

    it('returns valid=false when both VCS and CSP credentials are invalid', async () => {
      vcsMock.validateCredentials.mockResolvedValueOnce(false);
      cspMock.validateCredentials.mockResolvedValueOnce(false);
      const result = await engine.validateCredentials(makeDeploymentRequest());
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('captures error thrown by VCS credential check', async () => {
      vcsMock.validateCredentials.mockRejectedValueOnce(new Error('VCS auth timeout'));
      const result = await engine.validateCredentials(makeDeploymentRequest());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('VCS auth timeout'))).toBe(true);
    });

    it('captures error thrown by CSP credential check', async () => {
      cspMock.validateCredentials.mockRejectedValueOnce(new Error('CSP token expired'));
      const result = await engine.validateCredentials(makeDeploymentRequest());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CSP token expired'))).toBe(true);
    });
  });

  // ─── run ─────────────────────────────────────────────────────────────────

  describe('run', () => {
    it('returns Completed status and calls cspAccess.deploy when executor returns Completed', async () => {
      const result = await engine.run(makePipeline(), makeDeploymentRequest());
      expect(result.status).toBe(ExecutionStatus.Completed);
      expect(cspMock.deploy.mock.calls).toHaveLength(1);
    });

    it('sets endpoint from cspAccess.getEndpoint on Completed result', async () => {
      const result = await engine.run(makePipeline(), makeDeploymentRequest());
      expect(result.endpoint).toBe('https://test-app.example.com');
    });

    it('passes pipeline.steps to cspAccess.deploy as the fourth argument', async () => {
      const shipStep = makePipelineStep({ id: 'ship', name: 'Deploy', type: StepType.Ship, command: 'sudo nginx -t' });
      const pipeline = makePipeline({ steps: [makePipelineStep(), shipStep] });
      await engine.run(pipeline, makeDeploymentRequest());
      const stepsArg = cspMock.deploy.mock.calls[0]?.[3];
      expect(stepsArg).toEqual(pipeline.steps);
    });

    it('skips cspAccess.deploy and returns Pending when executor returns Pending', async () => {
      executorMock.execute.mockResolvedValueOnce(
        makePendingPipelineResult('https://jenkins.example.com/job/42')
      );
      const result = await engine.run(makePipeline(), makeDeploymentRequest());
      expect(result.status).toBe(ExecutionStatus.Pending);
      expect(result.trackingUrl).toBe('https://jenkins.example.com/job/42');
      expect(cspMock.deploy.mock.calls).toHaveLength(0);
    });

    it('skips cspAccess.deploy and returns Failed when executor returns Failed', async () => {
      executorMock.execute.mockResolvedValueOnce(makeFailedPipelineResult());
      const result = await engine.run(makePipeline(), makeDeploymentRequest());
      expect(result.status).toBe(ExecutionStatus.Failed);
      expect(cspMock.deploy.mock.calls).toHaveLength(0);
    });

    it('returns Failed when executor returns Completed but no artifact is present', async () => {
      executorMock.execute.mockResolvedValueOnce({
        status: ExecutionStatus.Completed,
        completedSteps: [],
        // artifact intentionally absent
      });
      const result = await engine.run(makePipeline(), makeDeploymentRequest());
      expect(result.status).toBe(ExecutionStatus.Failed);
    });

    it('always calls vcsAccess.fetchSource once before execution', async () => {
      await engine.run(makePipeline(), makeDeploymentRequest());
      expect(vcsMock.fetchSource.mock.calls).toHaveLength(1);
    });

    it('calls executor.execute with sourceDir equal to the path from vcsAccess.fetchSource', async () => {
      await engine.run(makePipeline(), makeDeploymentRequest());
      const destDir = vcsMock.fetchSource.mock.calls[0]?.[2];
      const context = executorMock.execute.mock.calls[0]?.[1];
      expect(context?.sourceDir).toBe(destDir);
    });
  });

  // ─── Docker ───────────────────────────────────────────────────────────────

  describe('run — Docker project type', () => {
    const dockerPipeline = makePipeline({ projectType: ProjectType.Docker });

    it('returns Failed immediately when dockerfilePath is not set', async () => {
      const request = makeDeploymentRequest({ project: { type: ProjectType.Docker, buildConfig: {} } });
      const result = await engine.run(dockerPipeline, request);
      expect(result.status).toBe(ExecutionStatus.Failed);
      expect(result.failedStep?.stepId).toBe('validate-dockerfile');
    });

    it('returns Failed immediately when dockerfilePath does not exist on disk', async () => {
      const request = makeDeploymentRequest({
        project: { type: ProjectType.Docker, buildConfig: { dockerfilePath: '/nonexistent/Dockerfile' } },
      });
      const result = await engine.run(dockerPipeline, request);
      expect(result.status).toBe(ExecutionStatus.Failed);
      expect(result.failedStep?.stepId).toBe('validate-dockerfile');
    });

    it('skips vcsAccess.fetchSource for Docker pipelines', async () => {
      // Supply a real file path that exists on disk (/etc/hosts is always present)
      const request = makeDeploymentRequest({
        project: { type: ProjectType.Docker, buildConfig: { dockerfilePath: '/etc/hosts' } },
      });
      await engine.run(dockerPipeline, request);
      expect(vcsMock.fetchSource.mock.calls).toHaveLength(0);
    });
  });

  // ─── validateCredentials — Docker ─────────────────────────────────────────

  describe('validateCredentials — Docker project type', () => {
    it('skips VCS validation and only validates CSP credentials', async () => {
      const request = makeDeploymentRequest({ project: { type: ProjectType.Docker, buildConfig: {} } });
      await engine.validateCredentials(request);
      expect(vcsMock.validateCredentials.mock.calls).toHaveLength(0);
      expect(cspMock.validateCredentials.mock.calls).toHaveLength(1);
    });

    it('returns valid=true when CSP credentials are valid (no VCS check)', async () => {
      const request = makeDeploymentRequest({ project: { type: ProjectType.Docker, buildConfig: {} } });
      const result = await engine.validateCredentials(request);
      expect(result.valid).toBe(true);
    });
  });
});

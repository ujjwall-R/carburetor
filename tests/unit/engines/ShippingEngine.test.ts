import { describe, it, expect, beforeEach } from 'bun:test';
import { ShippingEngine } from '../../../src/engines/ShippingEngine.js';
import { ExecutionStatus } from '../../../src/models/enums.js';
import {
  makeDeploymentRequest,
  makePipeline,
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
      // third arg to fetchSource is destDir (the temp path created inside ShippingEngine.fetchSource)
      const destDir = vcsMock.fetchSource.mock.calls[0]?.[2];
      // executor.execute second arg is context; context.sourceDir should equal destDir
      const context = executorMock.execute.mock.calls[0]?.[1];
      expect(context?.sourceDir).toBe(destDir);
    });
  });
});

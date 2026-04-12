import { describe, it, expect, beforeEach } from 'bun:test';
import { DeploymentManager } from '../../../src/managers/DeploymentManager.js';
import { ExecutionStatus, CloudPlatform } from '../../../src/models/enums.js';
import { makeDeploymentRequest, makePipeline, makePipelineStep } from '../../helpers/fixtures.js';
import { makeShippingEngineMock, makeOrchestratingEngineMock } from '../../helpers/mocks.js';

describe('DeploymentManager', () => {
  let shippingMock: ReturnType<typeof makeShippingEngineMock>;
  let orchMock: ReturnType<typeof makeOrchestratingEngineMock>;
  let progressMessages: string[];
  let manager: DeploymentManager;

  beforeEach(() => {
    shippingMock = makeShippingEngineMock();
    orchMock = makeOrchestratingEngineMock();
    progressMessages = [];
    manager = new DeploymentManager(
      orchMock as any,
      shippingMock as any,
      (msg: string) => { progressMessages.push(msg); }
    );
  });

  // ─── Happy path — Completed ───────────────────────────────────────────────

  it('returns Completed outcome when credentials are valid and executor succeeds', async () => {
    const outcome = await manager.deploy(makeDeploymentRequest());
    expect(outcome.status).toBe(ExecutionStatus.Completed);
    expect(outcome.endpoint).toBe('https://test-app.example.com');
  });

  // ─── Credential failure ───────────────────────────────────────────────────

  it('returns Failed outcome when credential validation fails', async () => {
    shippingMock.validateCredentials.mockResolvedValueOnce({
      valid: false,
      errors: ['VCS credentials invalid'],
    });
    const outcome = await manager.deploy(makeDeploymentRequest());
    expect(outcome.status).toBe(ExecutionStatus.Failed);
    expect(outcome.error).toContain('VCS credentials invalid');
  });

  it('does not call orchestrating.buildPipeline when credentials are invalid', async () => {
    shippingMock.validateCredentials.mockResolvedValueOnce({ valid: false, errors: ['bad'] });
    await manager.deploy(makeDeploymentRequest());
    expect(orchMock.buildPipeline.mock.calls).toHaveLength(0);
  });

  // ─── Pending path ─────────────────────────────────────────────────────────

  it('returns Pending outcome when executor reports a pending (fire-and-forget) result', async () => {
    shippingMock.run.mockResolvedValueOnce({
      status: ExecutionStatus.Pending,
      trackingUrl: 'https://jenkins.example.com/job/99',
      platform: CloudPlatform.AWS,
    });
    const outcome = await manager.deploy(makeDeploymentRequest());
    expect(outcome.status).toBe(ExecutionStatus.Pending);
    expect(outcome.trackingUrl).toBe('https://jenkins.example.com/job/99');
  });

  // ─── Failed pipeline path ─────────────────────────────────────────────────

  it('returns Failed outcome when executor pipeline fails', async () => {
    shippingMock.run.mockResolvedValueOnce({
      status: ExecutionStatus.Failed,
      platform: CloudPlatform.AWS,
    });
    const outcome = await manager.deploy(makeDeploymentRequest());
    expect(outcome.status).toBe(ExecutionStatus.Failed);
    expect(outcome.error).toBe('Pipeline execution failed');
  });

  // ─── Timing ───────────────────────────────────────────────────────────────

  it('sets totalDurationMs to a non-negative number', async () => {
    const outcome = await manager.deploy(makeDeploymentRequest());
    expect(typeof outcome.totalDurationMs).toBe('number');
    expect(outcome.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  // ─── Progress callbacks ───────────────────────────────────────────────────

  it('calls progress callback with a message containing "Validating" at the credential stage', async () => {
    await manager.deploy(makeDeploymentRequest());
    expect(progressMessages.some(m => m.toLowerCase().includes('validating'))).toBe(true);
  });

  it('calls progress callback with a message containing "Building" at the pipeline stage', async () => {
    await manager.deploy(makeDeploymentRequest());
    expect(progressMessages.some(m => m.toLowerCase().includes('building'))).toBe(true);
  });

  // ─── validate ────────────────────────────────────────────────────────────

  it('returns valid=true when shipping.validateCredentials resolves valid', async () => {
    const result = await manager.validate(makeDeploymentRequest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=false with errors when shipping.validateCredentials reports failure', async () => {
    shippingMock.validateCredentials.mockResolvedValueOnce({
      valid: false,
      errors: ['Missing AWS_ACCESS_KEY_ID'],
    });
    const result = await manager.validate(makeDeploymentRequest());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing AWS_ACCESS_KEY_ID');
  });

  it('does not throw when no progress callback is provided', async () => {
    const managerNoCallback = new DeploymentManager(orchMock as any, shippingMock as any);
    const outcome = await managerNoCallback.deploy(makeDeploymentRequest());
    expect(outcome.status).toBe(ExecutionStatus.Completed);
  });

  // ─── Pipeline wiring ──────────────────────────────────────────────────────

  it('calls shipping.run with the exact pipeline produced by orchestrating.buildPipeline', async () => {
    const customPipeline = makePipeline({ steps: [makePipelineStep({ id: 'custom-step' })] });
    orchMock.buildPipeline.mockReturnValueOnce(customPipeline);
    await manager.deploy(makeDeploymentRequest());
    const pipelineArg = shippingMock.run.mock.calls[0]?.[0];
    expect(pipelineArg).toEqual(customPipeline);
  });
});

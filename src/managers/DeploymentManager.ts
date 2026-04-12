import { ExecutionStatus } from '../models/enums.js';
import type { DeploymentRequest } from '../models/DeploymentRequest.js';
import type { DeploymentOutcome } from '../models/DeploymentOutcome.js';
import type { IDeploymentManager } from './IDeploymentManager.js';
import type { IOrchestratingEngine } from '../engines/IOrchestratingEngine.js';
import type { IShippingEngine } from '../engines/IShippingEngine.js';

export type ProgressCallback = (message: string) => void;

export class DeploymentManager implements IDeploymentManager {
  constructor(
    private readonly orchestrating: IOrchestratingEngine,
    private readonly shipping: IShippingEngine,
    private readonly onProgress?: ProgressCallback
  ) {}

  async deploy(request: DeploymentRequest): Promise<DeploymentOutcome> {
    const start = Date.now();

    this.progress('Validating credentials...');
    const validation = await this.shipping.validateCredentials(request);
    if (!validation.valid) {
      return {
        status: ExecutionStatus.Failed,
        completedSteps: [],
        error: `Credential validation failed:\n  ${validation.errors.join('\n  ')}`,
        totalDurationMs: Date.now() - start,
      };
    }

    this.progress('Building deployment pipeline...');
    const pipeline = this.orchestrating.buildPipeline(request.project);

    this.progress(`Running ${pipeline.steps.length} pipeline step(s) locally...`);
    const result = await this.shipping.run(pipeline, request);

    return {
      status: result.status,
      ...(result.endpoint ? { endpoint: result.endpoint } : {}),
      ...(result.trackingUrl ? { trackingUrl: result.trackingUrl } : {}),
      completedSteps: result.completedSteps ?? [],
      ...(result.failedStep ? { failedStep: result.failedStep } : {}),
      ...(result.status === ExecutionStatus.Failed && !result.failedStep ? { error: 'Pipeline execution failed' } : {}),
      totalDurationMs: Date.now() - start,
    };
  }

  private progress(message: string): void {
    this.onProgress?.(message);
  }
}

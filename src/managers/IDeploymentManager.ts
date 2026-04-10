import type { DeploymentRequest } from '../models/DeploymentRequest.js';
import type { DeploymentOutcome } from '../models/DeploymentOutcome.js';

export interface IDeploymentManager {
  deploy(request: DeploymentRequest): Promise<DeploymentOutcome>;
}

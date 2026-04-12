import type { DeploymentRequest } from '../models/DeploymentRequest.js';
import type { DeploymentOutcome, ValidationResult } from '../models/DeploymentOutcome.js';

export interface IDeploymentManager {
  deploy(request: DeploymentRequest): Promise<DeploymentOutcome>;
  validate(request: DeploymentRequest): Promise<ValidationResult>;
}

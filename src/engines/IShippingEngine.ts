import type { DeploymentRequest } from '../models/DeploymentRequest.js';
import type { Pipeline } from '../models/Pipeline.js';
import type { ShippingResult, ValidationResult } from '../models/DeploymentOutcome.js';

export interface IShippingEngine {
  validateCredentials(request: DeploymentRequest): Promise<ValidationResult>;
  run(pipeline: Pipeline, request: DeploymentRequest): Promise<ShippingResult>;
}

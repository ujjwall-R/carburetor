import type { ExecutionStatus, CloudPlatform } from './enums.js';
import type { StepResult } from './Pipeline.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ShippingResult {
  status: ExecutionStatus;
  endpoint?: string;
  trackingUrl?: string;
  platform: CloudPlatform;
}

export interface DeploymentOutcome {
  status: ExecutionStatus;
  endpoint?: string;
  trackingUrl?: string;
  completedSteps: StepResult[];
  failedStep?: StepResult;
  error?: string;
  totalDurationMs: number;
}

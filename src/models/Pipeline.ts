import type { ProjectType, StepType, ExecutionStatus } from './enums.js';
import type { DeployableArtifact } from './DeployableArtifact.js';

export interface PipelineStep {
  id: string;
  name: string;
  type: StepType;
  command?: string;
}

export interface Pipeline {
  projectType: ProjectType;
  steps: PipelineStep[];
}

export interface ExecutionContext {
  sourceDir: string;
  artifactDir: string;
  env: Record<string, string>;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface PipelineResult {
  status: ExecutionStatus;
  completedSteps: StepResult[];
  failedStep?: StepResult;
  artifact?: DeployableArtifact;
  trackingUrl?: string;
}

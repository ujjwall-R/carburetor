import type { BuildConfig } from '../../models/DeploymentRequest.js';
import type { PipelineStep } from '../../models/Pipeline.js';
import { BasePipelineOrchestration } from './BasePipelineOrchestration.js';

export class CustomOrchestration extends BasePipelineOrchestration {
  buildSteps(_buildConfig: BuildConfig, _deployDir?: string): PipelineStep[] {
    return [];
  }
}

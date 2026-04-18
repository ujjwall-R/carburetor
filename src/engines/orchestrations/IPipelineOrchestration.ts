import type { BuildConfig } from '../../models/DeploymentRequest.js';
import type { PipelineStep } from '../../models/Pipeline.js';

export interface IPipelineOrchestration {
  /**
   * Returns the ordered pipeline steps for this project type, including any
   * remote Ship step if the project type defines one (e.g. ReactApp → nginx).
   */
  buildSteps(buildConfig: BuildConfig, deployDir?: string): PipelineStep[];
}

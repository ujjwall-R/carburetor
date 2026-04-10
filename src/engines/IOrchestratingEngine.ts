import type { Project } from '../models/DeploymentRequest.js';
import type { Pipeline } from '../models/Pipeline.js';

export interface IOrchestratingEngine {
  /**
   * Produces an ordered Pipeline value object for the given project.
   * Pure computation — no I/O except optional filesystem reads when sourceDir is provided.
   */
  buildPipeline(project: Project, sourceDir?: string): Pipeline;
}

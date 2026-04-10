import type { Pipeline, ExecutionContext, PipelineResult } from '../../models/Pipeline.js';

export interface IPipelineExecutor {
  /**
   * Executes a Pipeline within the given context.
   * Returns PipelineResult with status 'completed', 'failed', or 'pending'
   * (pending only for remote executors in non-blocking mode).
   */
  execute(pipeline: Pipeline, context: ExecutionContext): Promise<PipelineResult>;
}

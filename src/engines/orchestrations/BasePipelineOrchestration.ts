import type { BuildConfig } from '../../models/DeploymentRequest.js';
import type { PipelineStep } from '../../models/Pipeline.js';
import type { IPipelineOrchestration } from './IPipelineOrchestration.js';

export abstract class BasePipelineOrchestration implements IPipelineOrchestration {
  abstract buildSteps(buildConfig: BuildConfig, deployDir?: string): PipelineStep[];

  /**
   * Builds a shell command that probes for the output directory at runtime.
   * The primary dir (from config or framework default) is tried first;
   * common framework alternatives follow so a mis-configured outputDir does not
   * immediately hard-fail a working build.
   */
  protected buildPackageCommand(primary: string, extra?: string): string {
    const fallbacks = ['dist', 'build', 'out'].filter(d => d !== primary);
    const dirs = [primary, ...fallbacks];
    const dirList = dirs.map(d => `"${d}"`).join(' ');
    const extraArgs = extra ? ` ${extra}` : '';
    return (
      `OUTPUT=; for d in ${dirList}; do [ -d "$d" ] && OUTPUT="$d" && break; done; ` +
      `[ -n "$OUTPUT" ] && COPYFILE_DISABLE=1 tar -czf artifact.tar.gz "$OUTPUT"${extraArgs} || ` +
      `{ echo "Build output not found (tried: ${dirs.join(', ')})" >&2; exit 1; }`
    );
  }
}

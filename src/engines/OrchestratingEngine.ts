import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ProjectType, StepType } from '../models/enums.js';
import type { Project, BuildConfig } from '../models/DeploymentRequest.js';
import type { Pipeline, PipelineStep } from '../models/Pipeline.js';
import type { IOrchestratingEngine } from './IOrchestratingEngine.js';

export class OrchestratingEngine implements IOrchestratingEngine {
  buildPipeline(project: Project, sourceDir?: string): Pipeline {
    const projectType = project.type ?? (sourceDir ? this.detectProjectType(sourceDir) : ProjectType.Custom);
    const steps = this.buildStepsForType(projectType, project.buildConfig);
    return { projectType, steps };
  }

  private detectProjectType(sourceDir: string): ProjectType {
    if (existsSync(join(sourceDir, 'Dockerfile'))) {
      return ProjectType.Docker;
    }

    const pkgPath = join(sourceDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
        const deps = {
          ...(pkg['dependencies'] as Record<string, string> | undefined ?? {}),
          ...(pkg['devDependencies'] as Record<string, string> | undefined ?? {}),
        };
        if ('react' in deps || 'react-dom' in deps) return ProjectType.ReactApp;
        return ProjectType.NodeService;
      } catch {
        return ProjectType.NodeService;
      }
    }

    return ProjectType.Custom;
  }

  private buildStepsForType(type: ProjectType, buildConfig: BuildConfig): PipelineStep[] {
    if (buildConfig.buildScript) {
      return [
        {
          id: 'custom-build',
          name: 'Run custom build script',
          type: StepType.Build,
          command: buildConfig.buildScript,
        },
      ];
    }

    switch (type) {
      case ProjectType.ReactApp:
        return [
          {
            id: 'install-deps',
            name: 'Install dependencies',
            type: StepType.Build,
            command: 'npm ci',
          },
          {
            id: 'build-react',
            name: 'Build React application',
            type: StepType.Build,
            command: 'npm run build',
          },
          {
            id: 'package-artifact',
            name: 'Package build output',
            type: StepType.Package,
            command: this.buildPackageCommand(buildConfig.outputDir ?? 'dist'),
          },
        ];

      case ProjectType.NodeService:
        return [
          {
            id: 'install-deps',
            name: 'Install dependencies',
            type: StepType.Build,
            command: 'npm ci',
          },
          {
            id: 'build-node',
            name: 'Build Node.js service',
            type: StepType.Build,
            command: 'npm run build',
          },
          {
            id: 'package-artifact',
            name: 'Package build output',
            type: StepType.Package,
            command: this.buildPackageCommand(buildConfig.outputDir ?? 'dist', 'package.json'),
          },
        ];

      case ProjectType.Custom:
        return [];

      /* istanbul ignore next — Docker step generation not yet implemented */
      default:
        return [];
    }
  }

  /**
   * Builds a shell command that probes for the output directory at runtime.
   * The primary dir (from config or framework default) is tried first;
   * common framework alternatives follow so mis-configured outputDir does not
   * immediately hard-fail a working build.
   */
  private buildPackageCommand(primary: string, extra?: string): string {
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

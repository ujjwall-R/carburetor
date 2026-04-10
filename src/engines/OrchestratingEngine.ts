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
            command: 'npm install --frozen-lockfile',
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
            command: `tar -czf artifact.tar.gz ${buildConfig.outputDir ?? 'dist'}`,
          },
        ];

      case ProjectType.NodeService:
        return [
          {
            id: 'install-deps',
            name: 'Install dependencies',
            type: StepType.Build,
            command: 'npm install --frozen-lockfile',
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
            command: `tar -czf artifact.tar.gz ${buildConfig.outputDir ?? 'dist'} package.json`,
          },
        ];

      case ProjectType.Custom:
        return [];

      default:
        return [];
    }
  }
}

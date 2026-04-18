import { StepType } from '../../models/enums.js';
import type { BuildConfig } from '../../models/DeploymentRequest.js';
import type { PipelineStep } from '../../models/Pipeline.js';
import { BasePipelineOrchestration } from './BasePipelineOrchestration.js';

export class NodeServiceOrchestration extends BasePipelineOrchestration {
  buildSteps(buildConfig: BuildConfig, _deployDir?: string): PipelineStep[] {
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
    // No Ship step — a server runtime strategy (e.g. pm2, systemd) will be added
    // when NodeServiceOrchestration gains a remote deploy target.
  }
}

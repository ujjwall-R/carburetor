import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ProjectType } from '../models/enums.js';
import type { Project } from '../models/DeploymentRequest.js';
import type { Pipeline } from '../models/Pipeline.js';
import type { IOrchestratingEngine } from './IOrchestratingEngine.js';
import type { IPipelineOrchestration } from './orchestrations/IPipelineOrchestration.js';
import { ReactAppOrchestration } from './orchestrations/ReactAppOrchestration.js';
import { NodeServiceOrchestration } from './orchestrations/NodeServiceOrchestration.js';
import { DockerOrchestration } from './orchestrations/DockerOrchestration.js';
import { CustomOrchestration } from './orchestrations/CustomOrchestration.js';

export class OrchestratingEngine implements IOrchestratingEngine {
  buildPipeline(project: Project, sourceDir?: string, deployDir?: string): Pipeline {
    const projectType = project.type ?? (sourceDir ? this.detectProjectType(sourceDir) : ProjectType.Custom);
    const orchestration = this.selectOrchestration(projectType);
    const steps = orchestration.buildSteps(project.buildConfig, deployDir);
    return { projectType, steps };
  }

  private selectOrchestration(type: ProjectType): IPipelineOrchestration {
    switch (type) {
      case ProjectType.ReactApp:
        return new ReactAppOrchestration();
      case ProjectType.NodeService:
        return new NodeServiceOrchestration();
      case ProjectType.Docker:
        return new DockerOrchestration();
      default:
        return new CustomOrchestration();
    }
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
}

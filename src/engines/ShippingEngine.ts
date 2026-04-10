import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ExecutionStatus } from '../models/enums.js';
import type { DeploymentRequest } from '../models/DeploymentRequest.js';
import type { Pipeline } from '../models/Pipeline.js';
import type { SourceArtifact } from '../models/SourceArtifact.js';
import type { ShippingResult, ValidationResult } from '../models/DeploymentOutcome.js';
import type { IShippingEngine } from './IShippingEngine.js';
import type { IVCSAccess } from '../access/IVCSAccess.js';
import type { ICSPAccess } from '../access/ICSPAccess.js';
import type { IPipelineExecutor } from './executors/IPipelineExecutor.js';

export class ShippingEngine implements IShippingEngine {
  constructor(
    private readonly vcsAccess: IVCSAccess,
    private readonly cspAccess: ICSPAccess,
    private readonly executor: IPipelineExecutor
  ) {}

  async validateCredentials(request: DeploymentRequest): Promise<ValidationResult> {
    const errors: string[] = [];

    const vcsValid = await this.vcsAccess
      .validateCredentials(request.vcsCredentials, request.vcsConfig.provider)
      .catch((err: Error) => { errors.push(`VCS: ${err.message}`); return false; });

    if (!vcsValid) {
      errors.push(`VCS credentials invalid for provider: ${request.vcsConfig.provider}`);
    }

    const cspValid = await this.cspAccess
      .validateCredentials(request.cspCredentials, request.target.platform)
      .catch((err: Error) => { errors.push(`CSP: ${err.message}`); return false; });

    if (!cspValid) {
      errors.push(`Cloud credentials invalid for platform: ${request.target.platform}`);
    }

    return { valid: errors.length === 0, errors };
  }

  async run(pipeline: Pipeline, request: DeploymentRequest): Promise<ShippingResult> {
    const source = await this.fetchSource(request);

    const artifactDir = mkdtempSync(join(tmpdir(), 'carborator-artifacts-'));
    const pipelineResult = await this.executor.execute(pipeline, {
      sourceDir: source.localPath,
      artifactDir,
      env: request.project.buildConfig.env ?? {},
    });

    if (pipelineResult.status === ExecutionStatus.Pending) {
      return {
        status: ExecutionStatus.Pending,
        ...(pipelineResult.trackingUrl ? { trackingUrl: pipelineResult.trackingUrl } : {}),
        platform: request.target.platform,
      };
    }

    if (pipelineResult.status === ExecutionStatus.Failed || !pipelineResult.artifact) {
      return {
        status: ExecutionStatus.Failed,
        platform: request.target.platform,
      };
    }

    const deployResult = await this.cspAccess.deploy(
      pipelineResult.artifact,
      request.target,
      request.cspCredentials
    );

    return {
      status: ExecutionStatus.Completed,
      endpoint: this.cspAccess.getEndpoint(deployResult),
      platform: request.target.platform,
    };
  }

  private async fetchSource(request: DeploymentRequest): Promise<SourceArtifact> {
    const destDir = mkdtempSync(join(tmpdir(), 'carborator-src-'));
    const metadata = await this.vcsAccess.fetchSource(
      request.vcsConfig,
      request.vcsCredentials,
      destDir
    );
    return { localPath: destDir, metadata };
  }
}

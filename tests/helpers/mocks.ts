import { mock } from 'bun:test';
import { ExecutionStatus, CloudPlatform } from '../../src/models/enums.js';
import type { VCSConfig, VCSCredentials, CSPCredentials, DeploymentTarget } from '../../src/models/DeploymentRequest.js';
import type { VCSProvider } from '../../src/models/enums.js';
import type { Pipeline, ExecutionContext, PipelineResult, PipelineStep } from '../../src/models/Pipeline.js';
import type { Project } from '../../src/models/DeploymentRequest.js';
import type { DeploymentRequest } from '../../src/models/DeploymentRequest.js';
import type { DeployableArtifact } from '../../src/models/DeployableArtifact.js';
import type { ValidationResult, ShippingResult } from '../../src/models/DeploymentOutcome.js';
import type { DeploymentResult } from '../../src/access/ICSPAccess.js';
import {
  makeCompletedPipelineResult,
  makeDeploymentResult,
  makePipeline,
  makeSourceMetadata,
} from './fixtures.js';

export const makeVCSAccessMock = () => {
  const validateCredentials = mock(
    (_credentials: VCSCredentials, _provider: VCSProvider): Promise<boolean> =>
      Promise.resolve(true)
  );
  const fetchSource = mock(
    (_config: VCSConfig, _credentials: VCSCredentials, _destDir: string) =>
      Promise.resolve(makeSourceMetadata())
  );
  return { validateCredentials, fetchSource };
};

export const makeCSPAccessMock = () => {
  const validateCredentials = mock(
    (_credentials: CSPCredentials, _platform: CloudPlatform): Promise<boolean> =>
      Promise.resolve(true)
  );
  const deploy = mock(
    (_artifact: DeployableArtifact, _target: DeploymentTarget, _credentials: CSPCredentials, _steps: PipelineStep[]): Promise<DeploymentResult> =>
      Promise.resolve(makeDeploymentResult())
  );
  const getEndpoint = mock(
    (_result: DeploymentResult): string => 'https://test-app.example.com'
  );
  return { validateCredentials, deploy, getEndpoint };
};

export const makeExecutorMock = () => {
  const execute = mock(
    (_pipeline: Pipeline, _context: ExecutionContext): Promise<PipelineResult> =>
      Promise.resolve(makeCompletedPipelineResult())
  );
  return { execute };
};

export const makeOrchestratingEngineMock = () => {
  const buildPipeline = mock(
    (_project: Project, _sourceDir?: string, _deployDir?: string): Pipeline => makePipeline()
  );
  return { buildPipeline };
};

export const makeShippingEngineMock = () => {
  const validateCredentials = mock(
    (_request: DeploymentRequest): Promise<ValidationResult> =>
      Promise.resolve({ valid: true, errors: [] })
  );
  const run = mock(
    (_pipeline: Pipeline, _request: DeploymentRequest): Promise<ShippingResult> =>
      Promise.resolve({
        status: ExecutionStatus.Completed,
        endpoint: 'https://test-app.example.com',
        platform: CloudPlatform.AWS,
      })
  );
  return { validateCredentials, run };
};

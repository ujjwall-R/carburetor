import { CloudPlatform, ExecutionStatus, ProjectType, StepType, VCSProvider } from '../../src/models/enums.js';
import type { DeploymentRequest } from '../../src/models/DeploymentRequest.js';
import type { Pipeline, PipelineResult, PipelineStep, StepResult } from '../../src/models/Pipeline.js';
import type { DeployableArtifact } from '../../src/models/DeployableArtifact.js';
import type { SourceMetadata } from '../../src/models/SourceArtifact.js';
import type { DeploymentResult } from '../../src/access/ICSPAccess.js';

export const makeDeploymentRequest = (overrides?: Partial<DeploymentRequest>): DeploymentRequest => ({
  project: {
    buildConfig: { env: {} },
  },
  target: {
    platform: CloudPlatform.AWS,
    region: 'us-east-1',
    environment: 'test',
    resourceId: 'test-resource',
  },
  vcsConfig: {
    provider: VCSProvider.GitHub,
    repoUrl: 'https://github.com/test/repo',
    branch: 'main',
  },
  vcsCredentials: { token: 'test-token' },
  cspCredentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
  dryRun: false,
  verbose: false,
  ...overrides,
});

export const makePipelineStep = (overrides?: Partial<PipelineStep>): PipelineStep => ({
  id: 'test-step',
  name: 'Test step',
  type: StepType.Build,
  command: 'echo test',
  ...overrides,
});

export const makePipeline = (overrides?: Partial<Pipeline>): Pipeline => ({
  projectType: ProjectType.NodeService,
  steps: [makePipelineStep()],
  ...overrides,
});

export const makeArtifact = (): DeployableArtifact => ({
  path: '/tmp/artifact.tar.gz',
  type: ProjectType.NodeService,
  buildMetadata: { executor: 'local', steps: '1' },
  builtAt: new Date().toISOString(),
});

export const makeCompletedPipelineResult = (): PipelineResult => ({
  status: ExecutionStatus.Completed,
  completedSteps: [],
  artifact: makeArtifact(),
});

export const makePendingPipelineResult = (trackingUrl = 'https://jenkins.example.com/job/123'): PipelineResult => ({
  status: ExecutionStatus.Pending,
  completedSteps: [],
  trackingUrl,
});

export const makeFailedPipelineResult = (): PipelineResult => {
  const failedStep: StepResult = {
    stepId: 'test-step',
    stepName: 'Test step',
    success: false,
    output: '',
    error: 'Process exited with code 1',
    durationMs: 100,
  };
  return {
    status: ExecutionStatus.Failed,
    completedSteps: [failedStep],
    failedStep,
  };
};

export const makeDeploymentResult = (): DeploymentResult => ({
  resourceId: 'test-resource',
  endpoint: 'https://test-app.example.com',
  platform: CloudPlatform.AWS,
});

export const makeSourceMetadata = (): SourceMetadata => ({
  provider: VCSProvider.GitHub,
  repoUrl: 'https://github.com/test/repo',
  branch: 'main',
  commitHash: 'abc123def456',
  fetchedAt: new Date().toISOString(),
});

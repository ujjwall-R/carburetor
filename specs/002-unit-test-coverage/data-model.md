# Data Model: Unit Test Coverage

**Branch**: `ujjwal/baseSetup` | **Date**: 2026-04-11 | **Plan**: [plan.md](./plan.md)

This document captures the test data entities — fixture shapes and mock contracts — used across the unit test suite.

---

## Fixture Entities (`tests/helpers/fixtures.ts`)

### `DeploymentRequest` fixture

```typescript
const makeDeploymentRequest = (overrides?: Partial<DeploymentRequest>): DeploymentRequest => ({
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
```

### `Pipeline` fixture

```typescript
const makePipeline = (overrides?: Partial<Pipeline>): Pipeline => ({
  projectType: ProjectType.NodeService,
  steps: [makePipelineStep()],
  ...overrides,
});

const makePipelineStep = (overrides?: Partial<PipelineStep>): PipelineStep => ({
  id: 'test-step',
  name: 'Test step',
  type: StepType.Build,
  command: 'echo test',
  ...overrides,
});
```

### `PipelineResult` fixture

```typescript
const makeCompletedPipelineResult = (): PipelineResult => ({
  status: ExecutionStatus.Completed,
  completedSteps: [],
  artifact: {
    path: '/tmp/artifact.tar.gz',
    type: ProjectType.NodeService,
    buildMetadata: { executor: 'local', steps: '1' },
    builtAt: new Date().toISOString(),
  },
});

const makePendingPipelineResult = (trackingUrl = 'https://jenkins.example.com/job/123'): PipelineResult => ({
  status: ExecutionStatus.Pending,
  completedSteps: [],
  trackingUrl,
});

const makeFailedPipelineResult = (): PipelineResult => ({
  status: ExecutionStatus.Failed,
  completedSteps: [],
  failedStep: {
    stepId: 'test-step',
    stepName: 'Test step',
    success: false,
    output: '',
    error: 'Process exited with code 1',
    durationMs: 100,
  },
});
```

### `DeploymentResult` fixture (from CSPAccess)

```typescript
const makeDeploymentResult = () => ({
  resourceId: 'test-resource',
  platform: CloudPlatform.AWS,
  region: 'us-east-1',
  deployedAt: new Date().toISOString(),
});
```

---

## Mock Contracts (`tests/helpers/mocks.ts`)

### `IVCSAccess` mock

| Method | Default return | Override pattern |
|--------|---------------|-----------------|
| `validateCredentials(creds, provider)` | `Promise.resolve(true)` | `mock.mockResolvedValueOnce(false)` |
| `fetchSource(config, creds, destDir)` | `Promise.resolve({ localPath: '/tmp/src', metadata: {} })` | `mock.mockRejectedValueOnce(new Error('...'))` |

### `ICSPAccess` mock

| Method | Default return | Override pattern |
|--------|---------------|-----------------|
| `validateCredentials(creds, platform)` | `Promise.resolve(true)` | `mock.mockResolvedValueOnce(false)` |
| `deploy(artifact, target, creds)` | `Promise.resolve(makeDeploymentResult())` | `mock.mockRejectedValueOnce(new Error('...'))` |
| `getEndpoint(result)` | `'https://test-app.example.com'` | Direct stub return override |

### `IPipelineExecutor` mock

| Method | Default return | Override pattern |
|--------|---------------|-----------------|
| `execute(pipeline, context)` | `Promise.resolve(makeCompletedPipelineResult())` | `mock.mockResolvedValueOnce(makePendingPipelineResult())` |

### `IOrchestratingEngine` mock

| Method | Default return | Override pattern |
|--------|---------------|-----------------|
| `buildPipeline(project, sourceDir?)` | `makePipeline()` | Direct return override via `mock.mockReturnValueOnce(...)` |

### `IShippingEngine` mock

| Method | Default return | Override pattern |
|--------|---------------|-----------------|
| `validateCredentials(request)` | `Promise.resolve({ valid: true, errors: [] })` | `mock.mockResolvedValueOnce({ valid: false, errors: ['...'] })` |
| `run(pipeline, request)` | `Promise.resolve({ status: ExecutionStatus.Completed, endpoint: 'https://...', platform: CloudPlatform.AWS })` | Override per-status |

---

## State Transitions

The following status transitions are the focus of branching tests:

```
ExecutionStatus flow (from IPipelineExecutor → ShippingEngine → DeploymentManager):

  Completed ─► ShippingEngine calls cspAccess.deploy() ─► DeploymentOutcome { status: Completed, endpoint }
  Pending   ─► ShippingEngine skips deploy             ─► DeploymentOutcome { status: Pending, trackingUrl }
  Failed    ─► ShippingEngine skips deploy             ─► DeploymentOutcome { status: Failed, error }
```

```
Credential validation flow (ShippingEngine.validateCredentials):

  VCS valid + CSP valid       ─► { valid: true, errors: [] }
  VCS invalid + CSP valid     ─► { valid: false, errors: ['VCS credentials invalid...'] }
  VCS valid + CSP invalid     ─► { valid: false, errors: ['Cloud credentials invalid...'] }
  VCS throws + CSP valid      ─► { valid: false, errors: ['VCS: <error>', 'VCS credentials invalid...'] }
  VCS valid + CSP throws      ─► { valid: false, errors: ['CSP: <error>', 'Cloud credentials invalid...'] }
```

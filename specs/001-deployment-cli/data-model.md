# Data Model: Deployment CLI Tool

**Feature**: `001-deployment-cli`  
**Phase**: 1 — Design  
**Date**: 2026-04-11

All types live in `src/models/`. No logic — pure data shapes.

---

## Enumerations

```typescript
// src/models/enums.ts

enum ProjectType {
  ReactApp    = 'react',
  NodeService = 'node',
  Docker      = 'docker',
  Custom      = 'custom',
}

enum CloudPlatform {
  AWS    = 'aws',
  GCP    = 'gcp',
  Azure  = 'azure',
  Lambda = 'lambda',   // AWS Lambda treated as a distinct target type
}

enum VCSProvider {
  GitHub    = 'github',
  GitLab    = 'gitlab',
  Bitbucket = 'bitbucket',
}

enum StepType {
  ValidateCredentials = 'validate-credentials',
  FetchSource         = 'fetch-source',
  DetectProject       = 'detect-project',
  Build               = 'build',
  Package             = 'package',
  Ship                = 'ship',
  Verify              = 'verify',
}

enum DeploymentStatus {
  Pending    = 'pending',
  InProgress = 'in-progress',
  Success    = 'success',
  Failed     = 'failed',
}

// Returned by IPipelineExecutor — reflects whether execution completed inline
// or was handed off to a remote system (Jenkins, Temporal)
enum ExecutionStatus {
  Completed = 'completed',   // execution finished, artifact ready
  Pending   = 'pending',     // submitted to remote executor, not yet done
  Failed    = 'failed',      // execution failed, error available
}
```

---

## Request Models (Client → Manager)

```typescript
// src/models/DeploymentRequest.ts

interface DeploymentRequest {
  project:        Project
  target:         DeploymentTarget
  vcsConfig:      VCSConfig
  vcsCredentials: VCSCredentials
  cspCredentials: CSPCredentials
  dryRun:         boolean
  verbose:        boolean
}

interface Project {
  type:        ProjectType           // detected or declared in config
  buildConfig: BuildConfig
}

interface BuildConfig {
  buildScript?: string               // overrides default (e.g. 'npm run build:prod')
  outputDir?:   string               // defaults to 'dist/' or 'build/' per project type
  env?:         Record<string, string>
}

interface DeploymentTarget {
  platform:    CloudPlatform
  region:      string                // e.g. 'us-east-1', 'europe-west1'
  environment: string                // e.g. 'production', 'staging'
  resourceId:  string                // instance id, bucket name, function name, etc.
}

interface VCSConfig {
  provider: VCSProvider
  repoUrl:  string
  branch:   string
  ref?:     string                   // specific commit SHA or tag; defaults to HEAD of branch
}

interface VCSCredentials {
  token: string                      // PAT or OAuth token
}

interface CSPCredentials {
  [key: string]: string              // platform-specific key-value pairs
  // AWS:   { accessKeyId, secretAccessKey, sessionToken? }
  // GCP:   { keyFile } or uses ADC
  // Azure: { clientId, clientSecret, tenantId, subscriptionId }
}
```

---

## Pipeline Models (OrchestratingEngine → ShippingEngine → IPipelineExecutor)

> `IPipelineExecutor` is an Engine-level strategy injected into `ShippingEngine`. It is **not** a ResourceAccess component — in Jenkins/Temporal mode it may internally coordinate VCS and CSP calls, which would violate the ResourceAccess no-cross-call rule if placed in that layer.

`Pipeline` is a **pure value object** — it describes what to run, never how. The executor is always external.

```typescript
// src/models/Pipeline.ts

interface Pipeline {
  projectType: ProjectType
  steps:       PipelineStep[]
}

// src/models/PipelineStep.ts

interface PipelineStep {
  id:       string         // unique step identifier, e.g. 'build-react'
  name:     string         // human-readable, e.g. 'Build React application'
  type:     StepType
  command?: string         // shell command for Build/Custom steps
}

// Passed to IPipelineExecutor.execute() — execution environment
interface ExecutionContext {
  sourceDir:   string      // absolute path to fetched source
  artifactDir: string      // absolute path where build outputs are written
  env:         Record<string, string>
}

// Result of executing a single step
interface StepResult {
  stepId:     string
  stepName:   string
  success:    boolean
  output:     string
  error?:     string
  durationMs: number
}

// Result of executing the full pipeline — returned by IPipelineExecutor.execute()
interface PipelineResult {
  status:         ExecutionStatus
  completedSteps: StepResult[]
  failedStep?:    StepResult           // populated when status === 'failed'
  artifact?:      DeployableArtifact   // populated when status === 'completed'
  trackingUrl?:   string               // populated when status === 'pending' (Jenkins job URL, Temporal workflow URL)
}
```

### Executor Configuration Models

Used only when wiring non-local executors in `src/index.ts`. Not part of the Pipeline itself.

```typescript
// Only needed when using JenkinsPipelineExecutor
interface JenkinsConfig {
  baseUrl:          string   // e.g. 'https://jenkins.example.com'
  jobName:          string   // Jenkins job to trigger
  token:            string   // Jenkins API token (from env at runtime)
  waitForCompletion: boolean // true = poll until done; false = fire-and-return-URL
  pollIntervalMs:   number   // poll frequency when waitForCompletion=true (default: 10000)
}

// Only needed when using TemporalPipelineExecutor
interface TemporalConfig {
  address:          string   // Temporal server address e.g. 'temporal.example.com:7233'
  namespace:        string
  taskQueue:        string
  waitForCompletion: boolean // true = await workflow result; false = return workflow ID as trackingUrl
}
```

---

## Artifact Models (Engine ↔ ResourceAccess)

```typescript
// src/models/SourceArtifact.ts

interface SourceArtifact {
  localPath: string          // absolute path to the cloned/downloaded source
  metadata:  SourceMetadata
}

interface SourceMetadata {
  provider:   VCSProvider
  repoUrl:    string
  branch:     string
  commitHash: string
  fetchedAt:  string         // ISO 8601
}

// src/models/DeployableArtifact.ts

interface DeployableArtifact {
  path:          string      // absolute path to built artifact (dir or tarball)
  type:          ProjectType
  buildMetadata: Record<string, string>
  builtAt:       string      // ISO 8601
}
```

---

## Result Models (Manager → Client)

```typescript
// src/models/DeploymentOutcome.ts

interface DeploymentOutcome {
  status:          ExecutionStatus
  endpoint?:       string          // live URL — populated when status === 'completed'
  trackingUrl?:    string          // Jenkins/Temporal URL — populated when status === 'pending'
  completedSteps:  StepResult[]
  failedStep?:     StepResult      // populated when status === 'failed'
  error?:          string          // top-level error message
  totalDurationMs: number
}

/*
  DeployCLI renders based on status:
    'completed' → "✓ Deployed. Endpoint: https://..."
    'pending'   → "Build submitted. Track at: https://jenkins.../job/123"
    'failed'    → "✗ Failed at step [name]: [error]"
*/

// Internal result from ShippingEngine.run()
interface ShippingResult {
  status:       ExecutionStatus
  endpoint?:    string          // live URL — populated when status === 'completed'
  trackingUrl?: string          // job/workflow URL — populated when status === 'pending'
  platform:     CloudPlatform
}

// Internal result from credential validation
interface ValidationResult {
  valid:   boolean
  errors:  string[]
}
```

---

## Configuration File Schema (`megalodon.yml`)

```yaml
# megalodon.yml — lives at project root

project:
  type: react                  # react | node | docker | custom
  build:
    script: "npm run build"    # optional — overrides default
    outputDir: "dist"          # optional — defaults per project type
    env:
      NODE_ENV: production

target:
  platform: aws                # aws | gcp | azure | lambda
  region: us-east-1
  environment: production
  resourceId: my-ec2-instance-id

vcs:
  provider: github
  repoUrl: "https://github.com/org/repo"
  branch: main
```

Credentials are **never** stored in `megalodon.yml`. They are sourced from environment variables at runtime:

| Platform | Environment Variables |
|----------|-----------------------|
| AWS | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` |
| GCP | `GOOGLE_APPLICATION_CREDENTIALS` (path to key file) |
| Azure | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` |
| GitHub | `megalodon_VCS_TOKEN` |

---

## Entity Relationships

```
DeploymentRequest
  ├── Project
  │     └── BuildConfig
  ├── DeploymentTarget
  ├── VCSConfig
  ├── VCSCredentials
  └── CSPCredentials

DeploymentOutcome
  ├── StepResult[]     (one per completed PipelineStep)
  └── StepResult?      (the step that failed, if any)

Pipeline  ← produced by OrchestratingEngine (pure value, no executor reference)
  └── PipelineStep[]

PipelineResult  ← produced by IPipelineExecutor.execute()
  ├── StepResult[]
  ├── StepResult?      (failed step)
  └── DeployableArtifact?

ExecutionContext  ← passed into IPipelineExecutor.execute() by ShippingEngine
  ├── sourceDir
  ├── artifactDir
  └── env

SourceArtifact
  └── SourceMetadata

DeployableArtifact
  └── buildMetadata (key-value)
```

### Data Flow Summary

```
OrchestratingEngine.buildPipeline()  →  Pipeline
                                            │
                                            ▼
ShippingEngine.run()
  ├── VCSAccess.fetchSource()         →  SourceArtifact
  ├── IPipelineExecutor.execute()     →  PipelineResult  (contains DeployableArtifact)
  └── CSPAccess.deploy()              →  DeploymentResult
                                            │
                                            ▼
                                       ShippingResult  →  DeploymentOutcome  →  DeployCLI
```

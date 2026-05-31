# Implementation Plan: Docker EC2 Deployment

**Branch**: `006-docker-ec2-deploy` | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/006-docker-ec2-deploy/spec.md`

## Summary

Enable deployment of single-image Docker applications to EC2 by introducing a `DockerOrchestration` pipeline that builds the image locally, exports it as a compressed archive, transfers it to EC2 via SSH, and runs the container with a user-specified port binding. The existing `CSPAccess.deployToEC2` and `LocalPipelineExecutor` are reused unchanged; the only pipeline-level change is a VCS-bypass path in `ShippingEngine` for Docker project types.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode)  
**Primary Dependencies**: `commander` (CLI), `@aws-sdk/client-ec2` (instance lookup), `@aws-sdk/client-sts` (credential validation); no new dependencies — Docker CLI invoked via child process (already established pattern)  
**Storage**: N/A — stateless per invocation; temp files in OS `/tmp`  
**Testing**: `bun test`  
**Target Platform**: macOS/Linux local machine (build) → EC2 Amazon Linux 2 (runtime)  
**Project Type**: CLI tool  
**Performance Goals**: No strict time bound; image build and transfer time is dominated by Dockerfile complexity and network speed  
**Constraints**: Single image, single port per deployment; Docker must be pre-installed on both local and remote machines  
**Scale/Scope**: One container per EC2 instance per invocation

## Constitution Check

The project constitution (`constitution.md`) has not been filled in beyond placeholder text. Evaluation is performed against the architecture rules in `CLAUDE.md`.

| Rule | Status | Notes |
|------|--------|-------|
| Client calls Manager only | PASS | `DeployCLI` → `DeploymentManager`; no direct engine calls from client |
| Manager:Engine ratio ≤ golden ratio | PASS | 1 Manager : 2 Engines (1:2 = valid) |
| Engines never call each other | PASS | `OrchestratingEngine` and `ShippingEngine` are independent |
| ResourceAccess never calls each other | PASS | `CSPAccess` and `VCSAccess` are independent |
| Client does not call Engines directly | PASS | No change to call graph |
| Naming conventions maintained | PASS | New file: `DockerOrchestration` (internal to Engine layer, not a top-level service) |

No gate violations. Constitution Check passes.

## Project Structure

### Documentation (this feature)

```text
specs/006-docker-ec2-deploy/
├── plan.md          ← this file
├── research.md      ← Phase 0
├── data-model.md    ← Phase 1
├── quickstart.md    ← Phase 1
├── contracts/
│   └── cli-contract.md   ← Phase 1
└── tasks.md         ← Phase 2 (created by /speckit.tasks)
```

### Source Code Changes

```text
src/
├── models/
│   └── DeploymentRequest.ts        — add dockerfilePath?, containerPort? to BuildConfig
├── engines/
│   ├── OrchestratingEngine.ts      — wire ProjectType.Docker → DockerOrchestration
│   └── orchestrations/
│       └── DockerOrchestration.ts  — NEW: 5-step Docker pipeline
└── engines/
│   └── ShippingEngine.ts           — VCS bypass + Docker validation
└── client/
    └── DeployCLI.ts                — add --dockerfile and --port flags to deploy command

tests/
└── unit/
    └── engines/
        └── orchestrations/
            └── DockerOrchestration.test.ts  — NEW
```

**Structure Decision**: Single project layout (Option 1). No new directories beyond one new orchestration file and its test.

## Files and Changes

### 1. `src/models/DeploymentRequest.ts`

Add two optional fields to `BuildConfig`:

```typescript
export interface BuildConfig {
  buildScript?: string;
  outputDir?: string;
  env?: Record<string, string>;
  dockerfilePath?: string;   // NEW
  containerPort?: number;    // NEW
}
```

### 2. `src/engines/orchestrations/DockerOrchestration.ts` (new)

```typescript
import * as path from 'path';
import { StepType } from '../../models/enums.js';
import type { BuildConfig } from '../../models/DeploymentRequest.js';
import type { PipelineStep } from '../../models/Pipeline.js';
import { BasePipelineOrchestration } from './BasePipelineOrchestration.js';

export class DockerOrchestration extends BasePipelineOrchestration {
  buildSteps(buildConfig: BuildConfig, _deployDir?: string): PipelineStep[] {
    const dockerfilePath = path.resolve(buildConfig.dockerfilePath!);
    const contextDir = path.dirname(dockerfilePath);
    const port = buildConfig.containerPort!;

    return [
      {
        id: 'docker-build',
        name: 'Build Docker image',
        type: StepType.Build,
        command: `docker build -t megalodon-docker-image -f ${dockerfilePath} ${contextDir}`,
      },
      {
        id: 'docker-export',
        name: 'Export image to archive',
        type: StepType.Package,
        command: `docker save megalodon-docker-image | gzip > artifact.tar.gz`,
      },
      {
        id: 'docker-load',
        name: 'Load image on EC2',
        type: StepType.Ship,
        command: `docker load < /tmp/megalodon-artifact.tar.gz`,
      },
      {
        id: 'docker-stop',
        name: 'Stop existing container',
        type: StepType.Ship,
        command: `docker rm -f megalodon-app 2>/dev/null || true`,
      },
      {
        id: 'docker-run',
        name: 'Start container',
        type: StepType.Ship,
        command: `docker run -d --restart unless-stopped -p ${port}:${port} --name megalodon-app megalodon-docker-image`,
      },
    ];
  }
}
```

### 3. `src/engines/OrchestratingEngine.ts`

Wire `ProjectType.Docker` to `DockerOrchestration` in `selectOrchestration`. Remove the `/* istanbul ignore next */` comment on the Docker case:

```typescript
case ProjectType.Docker:
  return new DockerOrchestration();
```

### 4. `src/engines/ShippingEngine.ts`

Two changes:
- Skip VCS credential validation for Docker.
- Skip VCS fetch for Docker; create an empty temp `sourceDir` instead.

```typescript
async validateCredentials(request: DeploymentRequest): Promise<ValidationResult> {
  const errors: string[] = [];
  const isDocker = request.project.type === ProjectType.Docker;

  if (!isDocker) {
    // existing VCS validation ...
  }

  // CSP validation unchanged
  const cspValid = await this.cspAccess.validateCredentials(...);
  ...
}

async run(pipeline: Pipeline, request: DeploymentRequest): Promise<ShippingResult> {
  const isDocker = pipeline.projectType === ProjectType.Docker;

  // Docker validation
  if (isDocker) {
    const { dockerfilePath, containerPort } = request.project.buildConfig;
    if (!dockerfilePath || !existsSync(dockerfilePath)) {
      return { status: ExecutionStatus.Failed, platform: request.target.platform,
        completedSteps: [], failedStep: { stepId: 'validate', stepName: 'Validate Dockerfile',
          success: false, output: '', error: `Dockerfile not found: ${dockerfilePath}`, durationMs: 0 } };
    }
    if (!containerPort || containerPort < 1 || containerPort > 65535) {
      return { /* similar error */ };
    }
  }

  const source = isDocker
    ? { localPath: mkdtempSync(join(tmpdir(), 'megalodon-src-')), metadata: { commitSha: 'local' } }
    : await this.fetchSource(request);

  // rest unchanged
}
```

### 5. `src/client/DeployCLI.ts`

Add `--dockerfile` and `--port` options to the `deploy` command. When present:
- Resolve dockerfile to an absolute path.
- Parse port as integer; validate range.
- Set `config.project.type = ProjectType.Docker`.
- Set `buildConfig.dockerfilePath` and `buildConfig.containerPort`.
- Skip VCS credential resolution (or provide empty stubs).

## Complexity Tracking

No violations to justify — this change fits entirely within the existing architecture.

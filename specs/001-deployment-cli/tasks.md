# Tasks: Deployment CLI Tool

**Input**: Design documents from `specs/001-deployment-cli/`  
**Stack**: TypeScript 5.x · Bun · commander · js-yaml · simple-git · AWS/GCP/Azure SDKs  
**Structure**: `src/{client,managers,engines,engines/executors,access,interfaces,models,config}/`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US4)
- No test tasks — not requested in spec

---

## Phase 1: Setup

**Purpose**: Project initialization and directory structure

- [x] T001 Initialize Bun project — run `bun init`, create `package.json`, `tsconfig.json` (strict mode, `paths` aliases) at repo root
- [x] T002 [P] Create full source directory tree: `src/{client,managers,engines,engines/executors,access,interfaces,models,config}/` and `tests/{unit,integration}/`
- [x] T003 [P] Install runtime dependencies: `commander`, `js-yaml`, `simple-git` — run `bun add commander js-yaml simple-git`
- [x] T004 [P] Install type declarations: `bun add -d @types/js-yaml @types/node`
- [x] T005 [P] Add `build` and `dev` scripts to `package.json`: `bun run src/index.ts` for dev, `bun build --compile --outfile carburetor src/index.ts` for build

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All shared models and interfaces that every user story depends on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: Phases 3–6 are blocked until this phase is done.

### Models

- [x] T006 Create all enum types (`ProjectType`, `CloudPlatform`, `VCSProvider`, `StepType`, `ExecutionStatus`, `DeploymentStatus`) in `src/models/enums.ts`
- [x] T007 [P] Create `DeploymentRequest`, `Project`, `BuildConfig`, `DeploymentTarget`, `VCSConfig`, `VCSCredentials`, `CSPCredentials` in `src/models/DeploymentRequest.ts`
- [x] T008 [P] Create `Pipeline`, `PipelineStep`, `ExecutionContext`, `StepResult`, `PipelineResult` in `src/models/Pipeline.ts`
- [x] T009 [P] Create `SourceArtifact`, `SourceMetadata` in `src/models/SourceArtifact.ts`
- [x] T010 [P] Create `DeployableArtifact` in `src/models/DeployableArtifact.ts`
- [x] T011 [P] Create `DeploymentOutcome`, `ShippingResult`, `ValidationResult` in `src/models/DeploymentOutcome.ts`
- [x] T012 [P] Create `JenkinsConfig`, `TemporalConfig` in `src/models/ExecutorConfig.ts`

### Interfaces

- [x] T013 [P] Create `IDeploymentManager` interface in `src/interfaces/IDeploymentManager.ts`
- [x] T014 [P] Create `IOrchestratingEngine` interface (`buildPipeline`) in `src/interfaces/IOrchestratingEngine.ts`
- [x] T015 [P] Create `IShippingEngine` interface (`run`, `validateCredentials`) in `src/interfaces/IShippingEngine.ts`
- [x] T016 [P] Create `IPipelineExecutor` interface (`execute`) in `src/interfaces/IPipelineExecutor.ts`
- [x] T017 [P] Create `IVCSAccess` interface (`validateCredentials`, `fetchSource`) in `src/interfaces/IVCSAccess.ts`
- [x] T018 [P] Create `ICSPAccess` interface (`validateCredentials`, `deploy`, `getEndpoint`) in `src/interfaces/ICSPAccess.ts`

### Config Loader

- [x] T019 Create `ConfigLoader` class in `src/config/ConfigLoader.ts` — reads and validates `carburetor.yml` using `js-yaml`, resolves credential env vars, returns typed `CarboratorConfig`

**Checkpoint**: All models, interfaces, and config loader are in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Deploy a Standard App (Priority: P1) 🎯 MVP

**Goal**: A developer can run `carburetor deploy` to deploy a standard React or Node.js app from GitHub to AWS with a single command.

**Independent Test**: Clone a sample React repo, configure `carburetor.yml` for AWS, run `carburetor deploy`, verify the app is live at the returned URL.

### OrchestratingEngine

- [x] T020 [US1] Implement `OrchestratingEngine` class in `src/engines/OrchestratingEngine.ts` — implements `IOrchestratingEngine`; `buildPipeline()` detects project type from `sourceDir` (scans `package.json` for react/node), builds ordered `PipelineStep[]` for each type; pure synchronous, no I/O beyond filesystem reads

### LocalPipelineExecutor

- [x] T021 [US1] Implement `LocalPipelineExecutor` class in `src/engines/executors/LocalPipelineExecutor.ts` — implements `IPipelineExecutor`; `execute()` runs each `PipelineStep.command` as a child process via `Bun.spawn()`; streams stdout per step; resolves with `PipelineResult { status: 'completed' | 'failed', completedSteps, artifact }`

### ResourceAccess — VCS

- [x] T022 [US1] Implement `VCSAccess` class in `src/access/VCSAccess.ts` — implements `IVCSAccess`; `fetchSource()` uses `simple-git` to clone the configured repo+branch into a temp dir; `validateCredentials()` makes a lightweight authenticated GitHub API call (`GET /user`); returns `SourceArtifact`

### ResourceAccess — CSP (AWS)

- [x] T023 [US1] Install AWS SDK v3 modules: `bun add @aws-sdk/client-s3 @aws-sdk/client-elastic-beanstalk @aws-sdk/client-lambda`
- [x] T024 [US1] Implement `CSPAccess` class in `src/access/CSPAccess.ts` — implements `ICSPAccess`; v1 supports `CloudPlatform.AWS` only; `deploy()` uploads built artifact to EC2/S3 via AWS SDK; `validateCredentials()` calls `STS.getCallerIdentity()`; `getPlatformAdapter()` private method returns the correct SDK client per platform

### ShippingEngine

- [x] T025 [US1] Implement `ShippingEngine` class in `src/engines/ShippingEngine.ts` — implements `IShippingEngine`; constructor takes `IVCSAccess`, `ICSPAccess`, `IPipelineExecutor`; `run()` orchestrates: fetch source → executor.execute(pipeline) → if `completed` then cspAccess.deploy else return with `status: 'pending'`; `validateCredentials()` calls both VCS and CSP validate methods

### DeploymentManager

- [x] T026 [US1] Implement `DeploymentManager` class in `src/managers/DeploymentManager.ts` — implements `IDeploymentManager`; `deploy()` calls `orchestrating.buildPipeline()` then `shipping.run(pipeline, request)`; maps `ShippingResult` to `DeploymentOutcome`; emits progress via callback passed from `DeployCLI`

### DeployCLI + Entry Point

- [x] T027 [US1] Implement `DeployCLI` class in `src/client/DeployCLI.ts` — uses `commander` to register `deploy` and `validate` subcommands; `run()` parses args, calls `ConfigLoader`, constructs `DeploymentRequest`, calls `DeploymentManager.deploy()`; `renderOutcome()` prints live URL on `completed`, tracking URL on `pending`, step error on `failed`
- [x] T028 [US1] Implement `src/index.ts` — DI wiring: instantiates `LocalPipelineExecutor`, `VCSAccess`, `CSPAccess`, `ShippingEngine`, `OrchestratingEngine`, `DeploymentManager`, `DeployCLI`; calls `DeployCLI.run(process.argv)`
- [x] T029 [US1] Implement `carburetor validate` subcommand in `src/client/DeployCLI.ts` — calls `ShippingEngine.validateCredentials()`, prints per-check pass/fail, exits with code 1 on any failure

**Checkpoint**: `carburetor deploy` fully works for a standard React/Node app → GitHub → AWS. Build, run the command, verify live URL returned.

---

## Phase 4: User Story 2 — Containerized Application (Priority: P2)

**Goal**: Detect a Dockerfile, build the image, push to a container registry, deploy the container to the cloud.

**Independent Test**: Add a `Dockerfile` to a sample project, run `carburetor deploy`, verify container is running in the cloud.

- [ ] T030 [US2] Extend `OrchestratingEngine.buildPipeline()` in `src/engines/OrchestratingEngine.ts` to detect `ProjectType.Docker` (checks for `Dockerfile` in `sourceDir`); build Docker-specific pipeline steps: `docker build`, `docker tag`, `docker push`
- [ ] T031 [US2] Extend `LocalPipelineExecutor` in `src/engines/executors/LocalPipelineExecutor.ts` to handle Docker step types — runs `docker build -t <tag> .` and `docker push <tag>` as child processes
- [ ] T032 [US2] Extend `CSPAccess` in `src/access/CSPAccess.ts` to support container registry operations for `CloudPlatform.AWS` (ECR push + ECS/Fargate deploy via `@aws-sdk/client-ecr` and `@aws-sdk/client-ecs`); install: `bun add @aws-sdk/client-ecr @aws-sdk/client-ecs`

**Checkpoint**: `carburetor deploy` detects Docker and runs a full container deploy independently of US1.

---

## Phase 5: User Story 3 — Custom Build/Deploy Script (Priority: P3)

**Goal**: User specifies a custom build script in `carburetor.yml`; the tool runs it instead of the built-in default steps.

**Independent Test**: Set `project.build.script: "make build"` in config, run `carburetor deploy`, verify the custom script is invoked and its output artifact is used.

- [ ] T033 [US3] Extend `OrchestratingEngine.buildPipeline()` in `src/engines/OrchestratingEngine.ts` to detect `ProjectType.Custom` when `buildConfig.buildScript` is set; generate a single `PipelineStep` with `type: StepType.Build, command: buildConfig.buildScript`
- [ ] T034 [US3] Extend `LocalPipelineExecutor` in `src/engines/executors/LocalPipelineExecutor.ts` to respect `PipelineStep.command` for custom steps — run the exact command string via `Bun.spawn()`; treat non-zero exit as `StepResult.success: false`
- [ ] T035 [US3] Update `ConfigLoader` in `src/config/ConfigLoader.ts` to validate `project.build.script` and `project.build.outputDir` fields and surface clear errors when a custom script path doesn't exist

**Checkpoint**: `carburetor deploy` invokes custom scripts transparently. Standard React and Docker paths still work.

---

## Phase 6: User Story 4 — Multi-Platform Support (Priority: P4)

**Goal**: Same command, same config structure works for GCP and Azure targets, not just AWS.

**Independent Test**: Change `target.platform` to `gcp` or `azure` in `carburetor.yml` and run `carburetor deploy` — app deploys to the correct cloud without any code change.

- [ ] T036 [P] [US4] Install GCP SDKs: `bun add @google-cloud/storage @google-cloud/run`
- [ ] T037 [P] [US4] Install Azure SDKs: `bun add @azure/storage-blob @azure/arm-appservice`
- [ ] T038 [US4] Add `GCPAdapter` private class inside `src/access/CSPAccess.ts` — implements `deploy()` for `CloudPlatform.GCP` using Cloud Run or GCS; `validateCredentials()` uses Application Default Credentials
- [ ] T039 [US4] Add `AzureAdapter` private class inside `src/access/CSPAccess.ts` — implements `deploy()` for `CloudPlatform.Azure` using App Service; `validateCredentials()` uses service principal credentials from env vars
- [ ] T040 [US4] Add `LambdaAdapter` private class inside `src/access/CSPAccess.ts` — implements `deploy()` for `CloudPlatform.Lambda` using `@aws-sdk/client-lambda`; packages artifact as zip, uploads function code, returns function ARN as endpoint

**Checkpoint**: All four platforms (AWS, GCP, Azure, Lambda) work via `target.platform` in config.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Production hardening, developer experience, and extensibility hooks

- [ ] T041 [P] Implement real-time TTY progress output in `src/client/DeployCLI.ts` — print `[N/total] Step name...` lines with `✓` / `✗` on completion; flush per step
- [ ] T042 [P] Implement `--json` flag output mode in `src/client/DeployCLI.ts` — emit NDJSON events per step and final outcome as defined in `contracts/cli-schema.md`
- [ ] T043 [P] Implement `JenkinsPipelineExecutor` in `src/engines/executors/JenkinsPipelineExecutor.ts` — `execute()` POSTs pipeline params to Jenkins REST API, polls `lastBuild` status every `pollIntervalMs`; respects `waitForCompletion` flag; returns `PipelineResult { status: 'pending', trackingUrl }` in non-blocking mode
- [ ] T044 Implement `carburetor version` subcommand in `src/client/DeployCLI.ts` — reads version from `package.json` and prints it
- [ ] T045 Harden error messages across all layers — ensure every caught error includes which step failed and what the user should do next (FR-011); update `ShippingEngine`, `VCSAccess`, `CSPAccess`
- [ ] T046 Build and smoke-test the compiled binary: `bun build --compile --outfile carburetor src/index.ts`; run `./carburetor --help` and `./carburetor validate` against a test config

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks Phases 3–6**
- **Phase 3 (US1)**: Depends on Phase 2 — primary MVP
- **Phase 4 (US2)**: Depends on Phase 3 (extends OrchestratingEngine + CSPAccess)
- **Phase 5 (US3)**: Depends on Phase 3 (extends OrchestratingEngine + LocalPipelineExecutor)
- **Phase 6 (US4)**: Depends on Phase 3 (extends CSPAccess with new adapters)
- **Phase 7 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — pure foundation
- **US2 (P2)**: Extends US1 components (OrchestratingEngine, CSPAccess) — US1 should be complete first
- **US3 (P3)**: Extends US1 components (OrchestratingEngine, LocalPipelineExecutor) — US1 should be complete first
- **US4 (P4)**: Extends US1 CSPAccess only — can start in parallel with US2/US3 after US1

### Parallel Opportunities

- All Phase 1 `[P]` tasks: run together
- All Phase 2 model tasks (T007–T012): run together
- All Phase 2 interface tasks (T013–T018): run together (also parallel with models)
- US4 platform installs (T036, T037): parallel
- Polish tasks T041, T042, T043, T044: parallel (different files)

---

## Parallel Example: Phase 2 Foundational

```bash
# All models in parallel:
T007  src/models/DeploymentRequest.ts
T008  src/models/Pipeline.ts
T009  src/models/SourceArtifact.ts
T010  src/models/DeployableArtifact.ts
T011  src/models/DeploymentOutcome.ts
T012  src/models/ExecutorConfig.ts

# Simultaneously, all interfaces in parallel:
T013  src/interfaces/IDeploymentManager.ts
T014  src/interfaces/IOrchestratingEngine.ts
T015  src/interfaces/IShippingEngine.ts
T016  src/interfaces/IPipelineExecutor.ts
T017  src/interfaces/IVCSAccess.ts
T018  src/interfaces/ICSPAccess.ts
```

## Parallel Example: User Story 4

```bash
# Install SDKs and implement adapters in parallel:
T036  bun add @google-cloud/storage @google-cloud/run
T037  bun add @azure/storage-blob @azure/arm-appservice

# Then in parallel once SDKs are installed:
T038  GCPAdapter in src/access/CSPAccess.ts
T039  AzureAdapter in src/access/CSPAccess.ts
T040  LambdaAdapter in src/access/CSPAccess.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — **do not skip**
3. Complete Phase 3: User Story 1 (T020–T029)
4. **STOP and VALIDATE**: run `carburetor deploy` against a real React repo → AWS
5. Ship MVP

### Incremental Delivery

1. Setup + Foundational → skeleton is in place
2. US1 → standard app deploy works (MVP)
3. US2 → Docker deploy works
4. US3 → custom script works
5. US4 → multi-platform works
6. Polish → Jenkins executor, JSON output, binary build

---

## Notes

- `[P]` = different files, no dependency on incomplete sibling tasks
- `[USN]` maps task to the user story it delivers — traceability back to spec.md
- Each user story phase ends with a concrete checkpoint test (described above)
- DI wiring lives entirely in `src/index.ts` — no class constructs its own dependencies
- `IPipelineExecutor` implementations live under `src/engines/executors/` — not `src/access/`
- Credentials are never read from `carburetor.yml` — always from environment variables

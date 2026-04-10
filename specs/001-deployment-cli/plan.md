# Implementation Plan: Deployment CLI Tool

**Branch**: `001-deployment-cli` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/001-deployment-cli/spec.md`

---

## Summary

A TypeScript CLI tool that deploys applications to cloud platforms end-to-end. The design follows The Method (Juval Löwy): a single `DeploymentManager` coordinates two engines — `OrchestratingEngine` (pure pipeline planner) and `ShippingEngine` (pipeline executor + VCS fetch + cloud delivery). Execution strategy (local, Jenkins, Temporal) is isolated in `IPipelineExecutor`, injected into `ShippingEngine`. All layer boundaries are TypeScript interfaces.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Runtime / Package Manager**: Bun (latest stable)  
**Primary Dependencies**: `commander` (CLI parsing), cloud SDKs (aws-sdk v3, @google-cloud/*, @azure/*)  
**Storage**: N/A — stateless per invocation; config sourced from `carborator.yml`  
**Testing**: `bun test` (built-in Bun test runner)  
**Target Platform**: macOS / Linux developer machine and CI environments  
**Project Type**: CLI tool (`bun build --compile` → single executable)  
**Performance Goals**: Full deploy pipeline for a standard app completes in under 5 minutes (SC-001)  
**Constraints**: No persistent daemon process; single-invocation stateless execution  
**Scale/Scope**: Single-user CLI; no concurrent request handling required

---

## Constitution Check

*Constitution is currently a placeholder template — no ratified principles to gate against.*  
*Re-check when constitution is ratified.*

| Gate | Status | Notes |
|------|--------|-------|
| Layer separation (The Method) | PASS | Client → Manager → Engine → Access strictly enforced |
| No cross-layer violations | PASS | Engines do not call each other; Access layers do not call each other |
| Manager:Engine ratio | PASS | 1 Manager : 2 Engines (ratio 1:2, within golden ratio band) |
| Interface-first design | PASS | All layer boundaries defined as TypeScript interfaces |
| OOP per layer | PASS | Each component is a class; each layer is a module |
| IPipelineExecutor placement | PASS | Kept as Engine-level strategy (not ResourceAccess) — avoids cross-ResourceAccess call violation |

---

## Architecture: Class Design

### System Diagram

```
┌─────────────────────┐
│      DeployCLI       │  ← Client layer
└─────────┬───────────┘
          │ DeploymentRequest
          ▼
┌─────────────────────┐
│  DeploymentManager   │  ← Manager layer
└──────┬──────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────────────────────────┐
│Orchestrating │     │         ShippingEngine            │  ← Engine layer
│   Engine     │     │  (acts as the "Jenkins" of the   │
│  (planner)   │     │   system — runs the pipeline)    │
│              │     │                                  │
│  Pipeline ──────►  │  ┌──────────────────────────┐   │
│  (pure data) │     │  │    IPipelineExecutor      │   │
└──────────────┘     │  │  LocalPipelineExecutor    │   │
                     │  │  JenkinsPipelineExecutor  │   │
                     │  │  TemporalPipelineExecutor │   │
                     │  └──────────────────────────┘   │
                     └──────────┬──────────────┬────────┘
                                │              │
                                ▼              ▼
                         ┌──────────┐   ┌──────────────┐
                         │ VCSAccess │   │  CSPAccess   │  ← ResourceAccess layer
                         └─────┬────┘   └──────┬───────┘
                               │               │
                               ▼               ▼
                         ┌──────────┐   ┌──────────────┐
                         │ VCS APIs │   │   CSP APIs   │  ← Resource layer
                         │ (GitHub) │   │ (AWS/GCP/Az) │
                         └──────────┘   └──────────────┘
```

### Key Design Decision: `ShippingEngine` as the Pipeline Coordinator

`OrchestratingEngine` is a **pure planner** — it produces a `Pipeline` value object. It never executes anything.

`ShippingEngine` IS the "Jenkins" of the system. It owns the full deployment lifecycle: fetch source → execute pipeline → ship artifact. How pipeline steps are executed is injected via `IPipelineExecutor` — a strategy dependency of the Engine, not a ResourceAccess layer component.

**Why `IPipelineExecutor` is NOT a ResourceAccess:**  
In the Jenkins scenario, the pipeline executor coordinates calls that may involve VCS and CSP operations. Placing it in the ResourceAccess layer would mean a ResourceAccess component calling other ResourceAccess components — a direct Method violation. It belongs as an internal execution strategy of `ShippingEngine`.

```
Wired in src/index.ts:

const executor = new LocalPipelineExecutor()         // swap for Jenkins/Temporal later
const shipping = new ShippingEngine(vcsAccess, cspAccess, executor)
const manager  = new DeploymentManager(orchestrating, shipping)
```

---

### Layer 1 — Client: `DeployCLI`

**File**: `src/client/DeployCLI.ts`  
**Responsibility**: Parse CLI args, load config file, construct `DeploymentRequest`, delegate to `DeploymentManager`, render output.

```typescript
class DeployCLI {
  constructor(private manager: IDeploymentManager)

  run(argv: string[]): Promise<void>

  private parseArgs(argv: string[]): CLIArgs
  private loadConfig(configPath: string): CarboratorConfig
  private buildRequest(args: CLIArgs, config: CarboratorConfig): DeploymentRequest
  private renderProgress(event: ProgressEvent): void
  private renderOutcome(outcome: DeploymentOutcome): void
}
```

**Rules enforced**:
- Does NOT call any Engine directly
- Does NOT call any ResourceAccess directly
- Calls exactly one Manager per invocation

---

### Layer 2 — Manager: `DeploymentManager`

**File**: `src/managers/DeploymentManager.ts`  
**Interface**: `src/interfaces/IDeploymentManager.ts`  
**Responsibility**: Coordinate `OrchestratingEngine` and `ShippingEngine`. The Manager plans then hands off — it does not step-iterate.

```typescript
interface IDeploymentManager {
  deploy(request: DeploymentRequest): Promise<DeploymentOutcome>
}

class DeploymentManager implements IDeploymentManager {
  constructor(
    private orchestrating: IOrchestratingEngine,
    private shipping: IShippingEngine
  )

  deploy(request: DeploymentRequest): Promise<DeploymentOutcome>
}
```

**Workflow inside `deploy()`** — 3 calls total:
```
1. pipeline = OrchestratingEngine.buildPipeline(request.project)
                 └─ pure computation, returns Pipeline value object

2. result   = ShippingEngine.run(pipeline, request)
                 └─ internally: fetch source → execute pipeline → ship artifact

3. return DeploymentOutcome from result
```

**Rules enforced**:
- Does NOT iterate pipeline steps — that belongs inside `ShippingEngine`
- Does NOT call ResourceAccess directly
- Does NOT call another Manager

---

### Layer 3 — Engines

#### `OrchestratingEngine` — Pure Planner

**File**: `src/engines/OrchestratingEngine.ts`  
**Interface**: `src/interfaces/IOrchestratingEngine.ts`  
**Responsibility**: Detect project type and produce a `Pipeline`. No I/O, no execution, no side effects.

```typescript
interface IOrchestratingEngine {
  buildPipeline(project: Project, sourceDir?: string): Pipeline
}

class OrchestratingEngine implements IOrchestratingEngine {
  buildPipeline(project: Project, sourceDir?: string): Pipeline

  private detectProjectType(sourceDir: string): ProjectType
  private buildStepsForType(type: ProjectType, buildConfig: BuildConfig): PipelineStep[]
}
```

- Returns a `Pipeline` value object — pure data, no behavior
- `sourceDir` is optional: passed only when the project type needs to be auto-detected from the filesystem (e.g., scanning `package.json`)
- No `async` — fully synchronous pure function

**Rules enforced**:
- Does NOT call `ShippingEngine`
- Does NOT call `VCSAccess` or `CSPAccess`
- Does NOT execute any step — it only describes them

---

#### `ShippingEngine` — Pipeline Coordinator + Shipper

**File**: `src/engines/ShippingEngine.ts`  
**Interface**: `src/interfaces/IShippingEngine.ts`  
**Responsibility**: Own the full deployment lifecycle. Acts as the "Jenkins" of the system — receives the `Pipeline`, coordinates source fetch, build execution, and cloud delivery.

```typescript
interface IShippingEngine {
  run(pipeline: Pipeline, request: DeploymentRequest): Promise<ShippingResult>
  validateCredentials(request: DeploymentRequest): Promise<ValidationResult>
}

class ShippingEngine implements IShippingEngine {
  constructor(
    private vcsAccess: IVCSAccess,
    private cspAccess: ICSPAccess,
    private executor: IPipelineExecutor        // ← injected execution strategy (NOT a ResourceAccess)
  )

  validateCredentials(request: DeploymentRequest): Promise<ValidationResult>

  run(pipeline: Pipeline, request: DeploymentRequest): Promise<ShippingResult>
  // Internally:
  //   1. source  = vcsAccess.fetchSource(request.vcsConfig, ...)
  //   2. result  = executor.execute(pipeline, { sourceDir: source.localPath, ... })
  //   3. outcome = cspAccess.deploy(result.artifact, request.target, ...)
  //   4. return ShippingResult
}
```

---

#### `IPipelineExecutor` — Execution Strategy (Engine-level plugin)

**File**: `src/interfaces/IPipelineExecutor.ts`  
**Implementations**: `src/engines/executors/`  
**Responsibility**: Execute the build steps of a `Pipeline` and return built artifacts. This is a strategy dependency of `ShippingEngine` — not a ResourceAccess component — because in real-world scenarios (e.g., Jenkins mode) the executor may itself coordinate VCS and CSP calls, which would violate the ResourceAccess no-cross-call rule if placed in that layer.

```typescript
interface IPipelineExecutor {
  execute(pipeline: Pipeline, context: ExecutionContext): Promise<PipelineResult>
}

// v1 — runs each step as a local child process via Bun.spawn
// File: src/engines/executors/LocalPipelineExecutor.ts
class LocalPipelineExecutor implements IPipelineExecutor {
  execute(pipeline: Pipeline, context: ExecutionContext): Promise<PipelineResult>
  private runStep(step: PipelineStep, cwd: string): Promise<StepResult>
}

// v2 — submits pipeline to Jenkins REST API, polls for completion, streams logs
// File: src/engines/executors/JenkinsPipelineExecutor.ts
class JenkinsPipelineExecutor implements IPipelineExecutor {
  constructor(private config: JenkinsConfig)
  execute(pipeline: Pipeline, context: ExecutionContext): Promise<PipelineResult>
}

// v3 — dispatches pipeline as a Temporal workflow, awaits result
// File: src/engines/executors/TemporalPipelineExecutor.ts
class TemporalPipelineExecutor implements IPipelineExecutor {
  constructor(private config: TemporalConfig)
  execute(pipeline: Pipeline, context: ExecutionContext): Promise<PipelineResult>
}
```

---

### Layer 4 — ResourceAccess

#### `VCSAccess`

**File**: `src/access/VCSAccess.ts`  
**Interface**: `src/interfaces/IVCSAccess.ts`

```typescript
interface IVCSAccess {
  validateCredentials(credentials: VCSCredentials, provider: VCSProvider): Promise<boolean>
  fetchSource(config: VCSConfig, credentials: VCSCredentials, destDir: string): Promise<SourceMetadata>
}

class VCSAccess implements IVCSAccess {
  validateCredentials(credentials: VCSCredentials, provider: VCSProvider): Promise<boolean>
  fetchSource(config: VCSConfig, credentials: VCSCredentials, destDir: string): Promise<SourceMetadata>

  private getProviderClient(provider: VCSProvider, credentials: VCSCredentials): VCSProviderClient
}
```

**Rules enforced**: Does NOT call `CSPAccess`. Provider differences handled internally.

---

#### `CSPAccess`

**File**: `src/access/CSPAccess.ts`  
**Interface**: `src/interfaces/ICSPAccess.ts`

```typescript
interface ICSPAccess {
  validateCredentials(credentials: CSPCredentials, platform: CloudPlatform): Promise<boolean>
  deploy(artifact: DeployableArtifact, target: DeploymentTarget, credentials: CSPCredentials): Promise<DeploymentResult>
  getEndpoint(result: DeploymentResult): string
}

class CSPAccess implements ICSPAccess {
  validateCredentials(credentials: CSPCredentials, platform: CloudPlatform): Promise<boolean>
  deploy(artifact: DeployableArtifact, target: DeploymentTarget, credentials: CSPCredentials): Promise<DeploymentResult>
  getEndpoint(result: DeploymentResult): string

  private getPlatformAdapter(platform: CloudPlatform, credentials: CSPCredentials): CSPAdapter
}
```

**Rules enforced**: Does NOT call `VCSAccess`. Platform differences handled internally.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-deployment-cli/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── cli-schema.md
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code

```text
src/
├── index.ts                        # Bun entry point — wires DI and calls DeployCLI.run()
│
├── client/
│   └── DeployCLI.ts                # Client layer
│
├── managers/
│   └── DeploymentManager.ts        # Manager layer
│
├── engines/
│   ├── OrchestratingEngine.ts      # Engine layer — pure pipeline planner
│   ├── ShippingEngine.ts           # Engine layer — pipeline coordinator ("Jenkins")
│   └── executors/                  # IPipelineExecutor implementations (Engine-level plugins)
│       ├── LocalPipelineExecutor.ts
│       ├── JenkinsPipelineExecutor.ts
│       └── TemporalPipelineExecutor.ts
│
├── access/
│   ├── VCSAccess.ts                # ResourceAccess — VCS providers
│   └── CSPAccess.ts                # ResourceAccess — Cloud providers
│
├── interfaces/                     # Layer boundary contracts (exposed upward)
│   ├── IDeploymentManager.ts
│   ├── IOrchestratingEngine.ts
│   ├── IShippingEngine.ts
│   ├── IPipelineExecutor.ts        # Engine-level strategy — NOT a ResourceAccess
│   ├── IVCSAccess.ts
│   └── ICSPAccess.ts
│
└── models/                         # Shared data entities (no logic)
    ├── DeploymentRequest.ts
    ├── DeploymentTarget.ts
    ├── Pipeline.ts
    ├── PipelineStep.ts
    ├── SourceArtifact.ts
    ├── DeployableArtifact.ts
    └── DeploymentOutcome.ts

tests/
├── unit/
│   ├── engines/
│   │   ├── OrchestratingEngine.test.ts
│   │   └── ShippingEngine.test.ts
│   └── managers/
│       └── DeploymentManager.test.ts
└── integration/
    ├── VCSAccess.test.ts
    └── CSPAccess.test.ts
```

**Structure Decision**: Single-project layout. No backend/frontend split — this is a pure CLI tool. DI wiring lives in `src/index.ts` so all classes receive their dependencies via constructor injection and remain independently testable.

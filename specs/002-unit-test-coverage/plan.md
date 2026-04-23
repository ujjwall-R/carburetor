# Implementation Plan: Unit Test Coverage

**Branch**: `ujjwal/baseSetup` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/002-unit-test-coverage/spec.md`

---

## Summary

Write a complete unit test suite for the Manager and Engine layers of the carburetor deployment CLI. Tests use Bun's built-in test runner (`bun test`) with `bun:test` mocking — no additional test packages required. Coverage is measured via `bun test --coverage` (V8-based), configured in `bunfig.toml`, with a shell script enforcing per-layer thresholds. Tests are organized to mirror the source tree under `tests/unit/`.

---

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode)  
**Runtime / Package Manager**: Bun (latest stable)  
**Testing**: `bun test` (built-in runner) + `bun:test` mocking — no additional devDependencies  
**Coverage**: `bun test --coverage` (Bun V8 coverage) + `bunfig.toml` thresholds + `scripts/check-coverage.sh`  
**Target Platform**: macOS / Linux developer machine and CI  
**Project Type**: CLI tool — pure unit tests, no I/O, no cloud calls  
**Performance Goals**: Full unit test suite completes in under 30 seconds (SC-001)  
**Constraints**: No external network calls in unit tests; shell commands in `LocalPipelineExecutor` tests use only `echo` and `exit 1`  
**Scale/Scope**: 4 test files, ~40-50 test cases total

---

## Constitution Check

*Constitution is currently a placeholder template — no ratified principles to gate against.*  
*Re-check when constitution is ratified.*

| Gate | Status | Notes |
|------|--------|-------|
| Layer separation (The Method) | PASS | Tests exercise each layer in isolation; mocks are injected at the interface boundary |
| No cross-layer violations in tests | PASS | Unit tests never import ResourceAccess or CSP/VCS SDKs directly |
| Interface-first design | PASS | All mocks are typed against layer interfaces (`IVCSAccess`, `ICSPAccess`, etc.) |
| OOP per layer | PASS | Each component under test is a class; tests target the public interface of that class |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-unit-test-coverage/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
tests/
├── helpers/
│   ├── fixtures.ts             ← shared test data builders (no test cases)
│   └── mocks.ts                ← shared interface mock factories (no test cases)
└── unit/
    ├── managers/
    │   └── DeploymentManager.test.ts
    ├── engines/
    │   ├── OrchestratingEngine.test.ts
    │   └── ShippingEngine.test.ts
    └── executors/
        └── LocalPipelineExecutor.test.ts

scripts/
└── check-coverage.sh           ← per-layer coverage threshold check

bunfig.toml                     ← Bun test + coverage configuration
```

**Structure Decision**: Flat single-project layout mirroring `src/`. `helpers/` is a shared utility layer for test fixtures and mocks — not a test suite itself. `LocalPipelineExecutor` tests live under `tests/unit/executors/` because the executor is an engine-level plugin, not a standalone engine.

---

## Implementation: `bunfig.toml`

```toml
[test]
coverageReporter = ["text", "lcov"]
coverageDir = "coverage"
```

No global threshold in `bunfig.toml` — threshold enforcement is handled per-layer by `scripts/check-coverage.sh` so coverage failures name the specific layer.

---

## Implementation: `package.json` scripts

Add to existing scripts:

```json
"test:coverage": "bun test --coverage",
"test:coverage:check": "bun test --coverage && bash scripts/check-coverage.sh"
```

---

## Implementation: `scripts/check-coverage.sh`

Parses `coverage/lcov.info` (written by `bun test --coverage`) and checks:

- Files under `src/managers/` → line coverage ≥ 90%, branch coverage ≥ 80%
- Files under `src/engines/` → line coverage ≥ 90%, branch coverage ≥ 80%
- Global across all covered files → line coverage ≥ 85%

Exits with code 0 on pass, code 1 on first threshold violation with a named error message.

---

## Implementation: `tests/helpers/fixtures.ts`

Exports factory functions for every shared test entity. Each factory accepts an optional `Partial<T>` override so individual tests can specialize only the fields they care about:

- `makeDeploymentRequest(overrides?)` — full `DeploymentRequest` with sensible defaults
- `makePipeline(overrides?)` — single-step NodeService pipeline
- `makePipelineStep(overrides?)` — Build step with `echo test` command
- `makeCompletedPipelineResult()` — `{ status: Completed, artifact: {...} }`
- `makePendingPipelineResult(trackingUrl?)` — `{ status: Pending, trackingUrl }`
- `makeFailedPipelineResult()` — `{ status: Failed, failedStep: {...} }`
- `makeDeploymentResult()` — CSP deploy result shape

---

## Implementation: `tests/helpers/mocks.ts`

Exports factory functions that return fresh mock instances. Each factory creates new `mock()` calls per invocation so test state does not bleed between `describe` blocks.

**`makeVCSAccessMock()`** → `IVCSAccess`:
- `validateCredentials` → resolves `true` by default
- `fetchSource` → resolves `{ localPath: '/tmp/carburetor-src-test', metadata: {} }`

**`makeCSPAccessMock()`** → `ICSPAccess`:
- `validateCredentials` → resolves `true`
- `deploy` → resolves `makeDeploymentResult()`
- `getEndpoint` → returns `'https://test-app.example.com'`

**`makeExecutorMock()`** → `IPipelineExecutor`:
- `execute` → resolves `makeCompletedPipelineResult()`

**`makeOrchestratingEngineMock()`** → `IOrchestratingEngine`:
- `buildPipeline` → returns `makePipeline()`

**`makeShippingEngineMock()`** → `IShippingEngine`:
- `validateCredentials` → resolves `{ valid: true, errors: [] }`
- `run` → resolves `{ status: Completed, endpoint: 'https://test-app.example.com', platform: AWS }`

---

## Implementation: `OrchestratingEngine.test.ts`

### Test cases

| # | Description | Input | Expected |
|---|-------------|-------|----------|
| 1 | Explicit ReactApp type → 3-step pipeline | `project.type = ReactApp` | 3 steps: install-deps, build-react, package-artifact |
| 2 | ReactApp pipeline step commands | `project.type = ReactApp` | Steps contain `npm install`, `npm run build`, `tar` |
| 3 | Explicit NodeService type → 3-step pipeline | `project.type = NodeService` | 3 steps: install-deps, build-node, package-artifact |
| 4 | NodeService uses custom outputDir | `buildConfig.outputDir = 'build'` | Package step command contains `build` not `dist` |
| 5 | Explicit Custom type → empty pipeline | `project.type = Custom` | `steps = []` |
| 6 | Custom buildScript overrides type steps | `buildConfig.buildScript = './deploy.sh'` | 1 step with command `./deploy.sh` |
| 7 | buildScript takes priority over ReactApp type | `type = ReactApp, buildScript = './build.sh'` | 1 step (not 3) |
| 8 | Auto-detect Docker via Dockerfile | `sourceDir` points to dir with `Dockerfile` | `projectType = Docker` |
| 9 | Auto-detect ReactApp via package.json + react dep | `sourceDir` with `package.json` containing react | `projectType = ReactApp` |
| 10 | Auto-detect NodeService via package.json without react | `sourceDir` with `package.json` no react | `projectType = NodeService` |
| 11 | Auto-detect Custom when no sourceDir provided | no `sourceDir`, no `project.type` | `projectType = Custom`, `steps = []` |
| 12 | Auto-detect Custom when package.json unreadable | `sourceDir` with malformed `package.json` | `projectType = NodeService` (parse error → fallback) |
| 13 | Docker type produces no steps (known gap — failing spec) | `project.type = Docker` | `steps = []` (documents current state) |

**Note on test 8**: Uses `tmp` directory with a real `Dockerfile` file created in test setup (`writeFileSync`). Cleaned up in `afterEach`.

---

## Implementation: `ShippingEngine.test.ts`

### `validateCredentials` test cases

| # | Description | VCS mock | CSP mock | Expected |
|---|-------------|----------|----------|----------|
| 1 | Both valid | resolves `true` | resolves `true` | `{ valid: true, errors: [] }` |
| 2 | VCS invalid | resolves `false` | resolves `true` | `{ valid: false, errors: ['VCS credentials invalid...'] }` |
| 3 | CSP invalid | resolves `true` | resolves `false` | `{ valid: false, errors: ['Cloud credentials invalid...'] }` |
| 4 | Both invalid | resolves `false` | resolves `false` | `valid: false`, errors contains both VCS and CSP messages |
| 5 | VCS throws | rejects with Error | resolves `true` | `valid: false`, errors contain thrown message |
| 6 | CSP throws | resolves `true` | rejects with Error | `valid: false`, errors contain thrown message |

### `run` test cases

| # | Description | Executor returns | Expected result |
|---|-------------|-----------------|-----------------|
| 7 | Completed → deploys to CSP | `Completed` with artifact | `status = Completed`, `endpoint` set, `cspAccess.deploy` called once |
| 8 | Pending → skips CSP deploy | `Pending` with trackingUrl | `status = Pending`, `trackingUrl` set, `cspAccess.deploy` NOT called |
| 9 | Failed → skips CSP deploy | `Failed` | `status = Failed`, `cspAccess.deploy` NOT called |
| 10 | Completed but no artifact → treats as failed | `Completed` with no artifact field | `status = Failed` |
| 11 | Fetches source before executing | any | `vcsAccess.fetchSource` called once with request VCS config |
| 12 | Executor called with sourceDir from VCS fetch | `Completed` | `executor.execute` called with `sourceDir` matching fetched path |

---

## Implementation: `DeploymentManager.test.ts`

### Test cases

| # | Description | Shipping mock | Orchestrating mock | Expected |
|---|-------------|---------------|--------------------|----------|
| 1 | Happy path — completed deployment | valid creds, `Completed` run result | returns pipeline | outcome `status = Completed`, `endpoint` set |
| 2 | Credential validation fails | `{ valid: false, errors: ['bad'] }` | (not called) | outcome `status = Failed`, `error` contains validation message |
| 3 | Credential invalid → orchestrating NOT called | invalid creds | — | `orchestrating.buildPipeline` call count = 0 |
| 4 | Pending executor path | valid creds, `Pending` run result | returns pipeline | outcome `status = Pending`, `trackingUrl` set |
| 5 | Failed executor path | valid creds, `Failed` run result | returns pipeline | outcome `status = Failed`, `error` = 'Pipeline execution failed' |
| 6 | `totalDurationMs` is set and positive | valid creds, `Completed` | returns pipeline | `outcome.totalDurationMs > 0` |
| 7 | Progress callback called — validate stage | any | any | callback called with message containing 'Validating' |
| 8 | Progress callback called — build pipeline stage | valid creds, any | any | callback called with message containing 'Building' |
| 9 | No progress callback — no error | valid creds, completed | any | does not throw when `onProgress` is undefined |
| 10 | `shipping.run` called with pipeline from orchestrating | valid creds, completed | returns custom pipeline | `shipping.run` first arg matches orchestrating output |

---

## Implementation: `LocalPipelineExecutor.test.ts`

### Test cases

| # | Description | Pipeline | Expected |
|---|-------------|---------|---------|
| 1 | Empty pipeline → completed with artifact | `steps = []` | `status = Completed`, `artifact` present |
| 2 | Single step, no command → treated as success | step with no `command` field | `status = Completed`, step result `success = true` |
| 3 | Single step, echo command → success | `command = 'echo hello'` | `status = Completed`, step `success = true`, output contains 'hello' |
| 4 | Single step, failing command → failed | `command = 'exit 1'` or `command = 'false'` | `status = Failed`, `failedStep` set with `error` |
| 5 | Multi-step all succeed → completed | 2 steps both `echo` | `status = Completed`, `completedSteps.length = 2` |
| 6 | Multi-step: first fails, second not run | step1=`false`, step2=`echo` | `status = Failed`, `completedSteps.length = 1` (only step1) |
| 7 | Env variables passed to step | `command = 'echo $TEST_VAR'`, `context.env = { TEST_VAR: 'hello' }` | output contains 'hello' |
| 8 | Artifact path is deterministic | any completing pipeline | `artifact.path` ends with `artifact.tar.gz` |
| 9 | Artifact `buildMetadata.executor` = 'local' | any completing pipeline | `artifact.buildMetadata.executor = 'local'` |

---

## Layer Boundary Enforcement: What Unit Tests Must NOT Do

- Must NOT import from `src/access/` (VCSAccess, CSPAccess) — use mocks only
- Must NOT import AWS SDK, GCP SDK, or Azure SDK
- Must NOT make network calls
- Must NOT read from real filesystem paths outside of temp directories in `LocalPipelineExecutor` tests
- Must NOT use `src/config/ConfigLoader.ts` — not in scope for unit tests

---

## Complexity Tracking

No constitution violations. No complexity to justify.

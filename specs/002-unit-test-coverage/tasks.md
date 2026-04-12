# Tasks: Unit Test Coverage

**Input**: Design documents from `specs/002-unit-test-coverage/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies between them)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the test directory skeleton, Bun coverage configuration, and `package.json` script additions. Nothing in this phase contains test logic — it only establishes structure.

- [x] T001 Create `tests/` directory tree: `tests/helpers/`, `tests/unit/managers/`, `tests/unit/engines/`, `tests/unit/executors/`
- [x] T002 [P] Create `bunfig.toml` at repository root with `[test]` section: set `coverageReporter = ["text", "lcov"]` and `coverageDir = "coverage"` (no global threshold — per-layer thresholds are enforced by the check script)
- [x] T003 [P] Add `"test:coverage": "bun test --coverage"` and `"test:coverage:check": "bun test --coverage && bash scripts/check-coverage.sh"` to the `scripts` block of `package.json`
- [x] T004 [P] Add `coverage/` entry to `.gitignore` so generated lcov artifacts are not committed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared test helpers that every test file imports. No test file can be written until both helpers exist.

**⚠️ CRITICAL**: No user story test files can be written until this phase is complete.

- [x] T005 Create `tests/helpers/fixtures.ts` — export the following factory functions typed against project interfaces (import types from `src/models/`):
  - `makeDeploymentRequest(overrides?: Partial<DeploymentRequest>): DeploymentRequest` — fills all required fields with safe defaults (platform AWS, region `us-east-1`, VCS GitHub, empty env)
  - `makePipeline(overrides?: Partial<Pipeline>): Pipeline` — single NodeService step pipeline
  - `makePipelineStep(overrides?: Partial<PipelineStep>): PipelineStep` — Build step with `command: 'echo test'`
  - `makeCompletedPipelineResult(): PipelineResult` — status Completed, artifact with `path: '/tmp/artifact.tar.gz'`
  - `makePendingPipelineResult(trackingUrl?: string): PipelineResult` — status Pending, trackingUrl defaults to `'https://jenkins.example.com/job/123'`
  - `makeFailedPipelineResult(): PipelineResult` — status Failed, failedStep with `error: 'Process exited with code 1'`
  - `makeDeploymentResult(): { resourceId: string; platform: CloudPlatform; region: string; deployedAt: string }` — minimal CSP deploy result shape
- [x] T006 Create `tests/helpers/mocks.ts` — export the following factory functions (each creates fresh `mock()` instances; import `mock` from `bun:test`, import fixture builders from `./fixtures.ts`, import interface types from `src/`):
  - `makeVCSAccessMock(): IVCSAccess` — `validateCredentials` resolves `true`, `fetchSource` resolves `{ localPath: '/tmp/carborator-src-test', metadata: {} }`
  - `makeCSPAccessMock(): ICSPAccess` — `validateCredentials` resolves `true`, `deploy` resolves `makeDeploymentResult()`, `getEndpoint` returns `'https://test-app.example.com'`
  - `makeExecutorMock(): IPipelineExecutor` — `execute` resolves `makeCompletedPipelineResult()`
  - `makeOrchestratingEngineMock(): IOrchestratingEngine` — `buildPipeline` returns `makePipeline()`
  - `makeShippingEngineMock(): IShippingEngine` — `validateCredentials` resolves `{ valid: true, errors: [] }`, `run` resolves `{ status: ExecutionStatus.Completed, endpoint: 'https://test-app.example.com', platform: CloudPlatform.AWS }`

**Checkpoint**: Helpers exist and TypeScript compiles — all test files can now be written.

---

## Phase 3: User Story 1 — Run Unit Tests and See Results (Priority: P1) 🎯 MVP

**Goal**: Developer runs `bun test` and gets clear pass/fail output for every component in the Manager and Engine layers.

**Independent Test**: Run `bun test` from repo root — all test cases in this phase pass, output names each suite, and the exit code is 0.

- [x] T007 [P] [US1] Create `tests/unit/engines/OrchestratingEngine.test.ts` — implement all 13 test cases from plan.md using `describe`/`it`/`expect` from `bun:test`:
  - Cases 1-7: `buildPipeline` with explicit `ProjectType` values — ReactApp (3 steps), NodeService (3 steps), Custom (0 steps), Docker (0 steps per current implementation — mark with `// known gap: Docker steps not yet implemented`); buildScript override produces 1 step; outputDir propagates to package step command; buildScript takes priority over ReactApp type
  - Cases 8-12 (filesystem detection): use `mkdtempSync` + `writeFileSync` in test setup to create real temp directories with `Dockerfile`, `package.json` (with react dep), `package.json` (without react), malformed `package.json`; clean up in `afterEach` with `rmSync`; assert `projectType` and `steps.length` on result
  - Case 11: when no `sourceDir` and no `project.type`, assert `projectType = Custom` and `steps = []`
- [x] T008 [P] [US1] Create `tests/unit/engines/ShippingEngine.test.ts` — implement all 12 test cases from plan.md:
  - Cases 1-6 (`validateCredentials`): use `makeVCSAccessMock()` and `makeCSPAccessMock()` from mocks.ts; override per-test using `mockReturnValueOnce` / `mockRejectedValueOnce`; assert `valid` and `errors` shape for all 5 branch combinations
  - Cases 7-12 (`run`): assert `cspAccess.deploy` is called exactly once when `Completed`, not called when `Pending` or `Failed`, not called when `Completed` but no artifact; verify `vcsAccess.fetchSource` is always called; verify `executor.execute` receives `sourceDir` matching the path returned by `fetchSource`
- [x] T009 [P] [US1] Create `tests/unit/managers/DeploymentManager.test.ts` — implement all 10 test cases from plan.md:
  - Cases 1-5: use `makeShippingEngineMock()` and `makeOrchestratingEngineMock()`; assert outcome status is `Completed`/`Failed`/`Pending` as appropriate; assert `orchestrating.buildPipeline` call count is 0 when credentials are invalid
  - Cases 6-7: assert `totalDurationMs > 0`; assert progress callback called with messages containing 'Validating' and 'Building' at the correct stages
  - Cases 8-9: pass `undefined` for `onProgress` — verify no error thrown; wire a custom pipeline from orchestrating mock and verify `shipping.run` first arg matches it
- [x] T010 [P] [US1] Create `tests/unit/executors/LocalPipelineExecutor.test.ts` — implement all 9 test cases from plan.md:
  - Cases 1-2: empty pipeline → `status = Completed` with `artifact`; step with no command → `success = true`, `output = '(no command)'`
  - Cases 3-4: `command: 'echo hello'` → `success = true`, output contains `hello`; `command: 'false'` → `status = Failed`, `failedStep.error` contains 'code'
  - Cases 5-6: multi-step all pass → `completedSteps.length = 2`; first step `false`, second `echo` → only 1 completed step (second not run)
  - Case 7: `command: 'echo $TEST_VAR'` with `context.env = { TEST_VAR: 'hello' }` → output contains `hello`
  - Cases 8-9: artifact `path` ends with `artifact.tar.gz`; `artifact.buildMetadata.executor = 'local'`
  - Use a real temp directory for `context.sourceDir` and `context.artifactDir` created in `beforeEach` with `mkdtempSync`; clean up in `afterEach` with `rmSync`

**Checkpoint**: `bun test` passes all tests, exit code 0, test names visible in output.

---

## Phase 4: User Story 2 — Coverage Report (Priority: P2)

**Goal**: Developer runs `bun test --coverage` and sees per-file line/branch/function percentages for all 4 tested components.

**Independent Test**: Run `bun test --coverage` — output includes a coverage table showing `src/engines/OrchestratingEngine.ts`, `src/engines/ShippingEngine.ts`, `src/managers/DeploymentManager.ts`, and `src/engines/executors/LocalPipelineExecutor.ts` with coverage ≥ the targets from spec SC-002 and SC-003.

- [x] T011 [US2] Verify `bunfig.toml` configuration produces `coverage/lcov.info` — run `bun test --coverage` and confirm: (a) lcov file is written to `coverage/`, (b) all 4 source components appear in the coverage table, (c) line coverage is displayed per file. If `coverage/` is not written, add `coverageDir = "coverage"` explicitly. Document any adjustments directly in `bunfig.toml` with a comment.
- [x] T012 [P] [US2] Create `scripts/` directory and add a `scripts/.gitkeep` placeholder so the directory is tracked before `check-coverage.sh` is written in Phase 5.

**Checkpoint**: `bun test --coverage` exits 0 and the coverage table is visible in terminal output with per-file line/branch/function percentages.

---

## Phase 5: User Story 3 — Enforce Coverage Thresholds (Priority: P3)

**Goal**: `bun run test:coverage:check` exits non-zero and names the specific layer when coverage drops below the configured minimum.

**Independent Test**: (1) Run `bun run test:coverage:check` with current tests — should exit 0. (2) Temporarily delete one test's assertions and re-run — should exit 1 with a message naming which layer fell short.

- [x] T013 [US3] Create `scripts/check-coverage.sh` — parse `coverage/lcov.info` using `awk` or line-by-line bash reads; enforce the following thresholds:
  - Files matching `src/managers/` → line coverage ≥ 90%, branch coverage ≥ 80%
  - Files matching `src/engines/` (including `src/engines/executors/`) → line coverage ≥ 90%, branch coverage ≥ 80%
  - Global across all covered files → line coverage ≥ 85%
  - On any violation: print `ERROR: [layer] line coverage X% is below threshold Y%` to stderr and exit with code 1
  - On all pass: print `✓ Coverage thresholds met` and exit with code 0
  - Make the script executable (`chmod +x scripts/check-coverage.sh`)
- [x] T014 [US3] Validate the check script works end-to-end: run `bun run test:coverage:check` — confirm exit code 0 with passing message. Then verify failure mode by temporarily lowering a threshold in the script to a value below current coverage and confirming exit code 1 with a layer-specific error message. Restore original threshold values.

**Checkpoint**: `bun run test:coverage:check` passes on current suite; deliberately dropping test count causes a named failure.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tighten the test configuration and document any known gaps.

- [x] T015 [P] Add a `/* istanbul ignore next */` comment above the `default:` branch in `OrchestratingEngine.buildStepsForType()` in `src/engines/OrchestratingEngine.ts` — this suppresses branch coverage for the intentionally unreachable Docker case until Docker step generation is implemented (prevents false branch coverage drop).
- [x] T016 [P] Add `"pretest": "echo 'Running unit tests'"` or equivalent no-op to `package.json` if CI pipelines need a hook — skip if not needed.
- [x] T017 Verify full execution: run `bun test`, `bun test --coverage`, and `bun run test:coverage:check` in sequence from a clean state; confirm all three exit with code 0 and coverage table is well-formed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001–T004 can start immediately
- **Foundational (Phase 2)**: Depends on T001 (directory structure exists)
  - T005 (fixtures) before T006 (mocks) — mocks import from fixtures
  - **BLOCKS all user story test files**
- **User Stories (Phase 3)**: All 4 test files depend on T005 + T006 — can then run in parallel [P]
- **Phase 4**: Depends on Phase 3 (tests must run to produce coverage output)
- **Phase 5**: Depends on Phase 4 (lcov.info must exist before check script can be validated)
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — no story-to-story dependencies
- **US2 (P2)**: Depends on US1 being complete (need test output to verify coverage report)
- **US3 (P3)**: Depends on US2 being complete (needs lcov.info to validate check script)

### Parallel Opportunities

- T002, T003, T004 (Phase 1) → all [P], different files
- T005 → T006 (Phase 2) → sequential (mocks depend on fixtures)
- T007, T008, T009, T010 (Phase 3) → all [P], different files
- T011, T012 (Phase 4) → [P] between each other
- T015, T016 (Phase 6) → [P]

---

## Parallel Example: Phase 3 (US1)

```bash
# After T005 + T006 complete, launch all 4 test files in parallel:
Task: "Create tests/unit/engines/OrchestratingEngine.test.ts (T007)"
Task: "Create tests/unit/engines/ShippingEngine.test.ts (T008)"
Task: "Create tests/unit/managers/DeploymentManager.test.ts (T009)"
Task: "Create tests/unit/executors/LocalPipelineExecutor.test.ts (T010)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only — ~4 files)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T006)
3. Complete Phase 3: US1 test files (T007–T010 in parallel)
4. **STOP and VALIDATE**: Run `bun test` — all tests pass
5. Increment: add coverage (Phase 4) then thresholds (Phase 5)

### Incremental Delivery

1. Phase 1 + 2 → infrastructure ready
2. Phase 3 → `bun test` works (MVP — US1 done)
3. Phase 4 → `bun test --coverage` works (US2 done)
4. Phase 5 → `bun run test:coverage:check` works (US3 done)
5. Phase 6 → polished, CI-ready

---

## Notes

- `[P]` tasks touch different files — safe to implement concurrently
- `[Story]` label maps each task to a specific user story for traceability
- `LocalPipelineExecutor` tests spawn real processes (`echo`, `false`) — this is intentional per research.md Decision 5; no network calls, completes in milliseconds
- Docker test case (T007, case 13) is written as a **known-failing spec** — comment in the test marks it as a gap; it should assert `steps = []` matching current behavior until Docker step generation is implemented
- All mock factories in `mocks.ts` return fresh `mock()` instances per call — always call the factory inside `beforeEach` to avoid state leakage between tests

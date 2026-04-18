# Tasks: Docker EC2 Deployment

**Input**: Design documents from `specs/006-docker-ec2-deploy/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story — each story is independently implementable and testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story label (US1, US2, US3) — only in user story phases

---

## Phase 1: Setup (Foundational Model Changes)

**Purpose**: Data model and config loader changes that every subsequent task depends on. Must be complete before any engine or CLI work begins.

- [x] T001 Add `dockerfilePath?: string` to `BuildConfig` interface in `src/models/DeploymentRequest.ts` (`containerPort` removed — container always binds port 80)
- [x] T002 Read `dockerfilePath` from the `build` section in `ConfigLoader.validate` in `src/config/ConfigLoader.ts`
- [x] T003 Make the `vcs` config section optional in `ConfigLoader.validate` when `project.type === 'docker'` in `src/config/ConfigLoader.ts` (depends on T001)

**Checkpoint**: `BuildConfig` carries `dockerfilePath`; config file no longer requires `vcs` for Docker projects. No engine changes yet.

---

## Phase 2: Foundational (Docker Pipeline Core)

**Purpose**: The `DockerOrchestration` and its wiring into `OrchestratingEngine`. Must be complete before US1–US3 work begins. These two tasks are independent of each other.

- [x] T004 [P] Create `DockerOrchestration` class implementing `IPipelineOrchestration` in `src/engines/orchestrations/DockerOrchestration.ts` — generates the 5-step pipeline: `docker-copy` (Build, copies Dockerfile as artifact), `docker-install` / `docker-build` / `docker-stop` / `docker-run` (Ship); build runs on EC2 with `--no-cache`; stop step frees port 80 by stopping nginx and removing old container; run always binds `-p 80:80`
- [x] T005 [P] Wire `ProjectType.Docker → new DockerOrchestration()` in `OrchestratingEngine.selectOrchestration` in `src/engines/OrchestratingEngine.ts`; remove the `/* istanbul ignore next */` comment on the Docker case

**Checkpoint**: `OrchestratingEngine.buildPipeline` for a Docker project produces the correct 5-step pipeline (1 local Build + 4 Ship). No deploy path wired yet.

---

## Phase 3: User Story 1 - Deploy Application from Dockerfile (Priority: P1) 🎯 MVP

**Goal**: A developer can run `carburetor deploy --dockerfile ./Dockerfile` against a configured EC2 instance and have the container running on EC2 at port 80.

**Independent Test**: Run `carburetor deploy --dockerfile <path>` with a real EC2 instance (or dry-run without an instance). Verify: (a) Dockerfile is copied locally as `artifact.tar.gz`, (b) SCP transfers it to EC2, (c) SSH steps install Docker, build the image on EC2, free port 80, and start the container.

### Implementation for User Story 1

- [x] T006 [US1] Add Docker validation at the start of `ShippingEngine.run` in `src/engines/ShippingEngine.ts`: when `pipeline.projectType === ProjectType.Docker`, verify `buildConfig.dockerfilePath` is set and the file exists (`existsSync`); return a `Failed` `ShippingResult` immediately if the check fails (depends on T001, T004)
- [x] T007 [US1] Add VCS bypass in `ShippingEngine.run` in `src/engines/ShippingEngine.ts`: when project type is Docker, skip `fetchSource` and instead create an empty temp dir with `mkdtempSync(join(tmpdir(), 'carburetor-src-'))` as `source.localPath`; set `metadata.commitSha` to `'local'` (depends on T006)
- [x] T008 [US1] Skip VCS credential validation in `ShippingEngine.validateCredentials` in `src/engines/ShippingEngine.ts` when `request.project.type === ProjectType.Docker` (depends on T001)
- [x] T009 [US1] Add `--dockerfile <path>` option to the `deploy` command in `src/client/DeployCLI.ts`; extend `CLIArgs` with `dockerfile?: string`; when `--dockerfile` is present: resolve to absolute path, set `project.type = ProjectType.Docker`, populate `buildConfig.dockerfilePath` on the constructed `DeploymentRequest`; no `--port` flag — container always binds port 80 (depends on T001, T002, T003)
- [x] T010 [US1] Skip VCS credential resolution in `DeployCLI.runDeploy` in `src/client/DeployCLI.ts` when `--dockerfile` is set (or `project.type === 'docker'` from config); pass empty `vcsCredentials` (`{ token: '' }`) and empty `vcsConfig` stubs so `DeploymentRequest` shape is preserved (depends on T009)

**Checkpoint**: `carburetor deploy --dockerfile ./Dockerfile` runs the full pipeline: copy Dockerfile → SCP to EC2 → install Docker → build image on EC2 (`--no-cache`) → free port 80 → start container → prints endpoint. User Story 1 is fully functional.

---

## Phase 4: User Story 2 - Monitor Deployment Progress (Priority: P2)

**Goal**: Progress banners printed to stdout for each pipeline stage, including SSH-executed Ship steps.

**Independent Test**: Run any Docker deployment and verify the terminal shows stage-prefixed lines for all 5 pipeline steps (both local Build/Package steps and remote Load/Stop/Run steps).

### Implementation for User Story 2

- [x] T011 [US2] Add per-step progress output to `CSPAccess.deployToEC2` in `src/access/CSPAccess.ts`: before calling `this.runCommand('ssh', ...)` for each Ship step, print `  → [${step.name}]\n` to `process.stdout`; after success, print `  ✓ ${step.name}\n`; on failure, print `  ✗ ${step.name}\n` to `process.stderr` (follows the same format as `LocalPipelineExecutor`)

**Checkpoint**: All 5 pipeline steps — local and remote — now display a `→` banner before execution and `✓`/`✗` after completion. User Story 2 is satisfied.

---

## Phase 5: User Story 3 - Redeploy Over an Existing Container (Priority: P3)

**Goal**: Re-running `carburetor deploy` against the same EC2 instance replaces the running container without error.

**Independent Test**: Run the deploy command twice against the same EC2 instance. Second run must complete without error. Verify via `docker ps` on EC2 that only one `carburetor-app` container is running.

**Implementation note**: The `docker-stop` Ship step stops nginx and force-removes the existing `carburetor-app` container before starting the new one. The `|| true` guard makes the step safe on first deploy (nothing to stop). This phase validates that successive deploys work cleanly.

- [x] T012 [US3] Verify `DockerOrchestration.buildSteps` in `src/engines/orchestrations/DockerOrchestration.ts` places `docker-stop` (StepType.Ship) before `docker-run` (StepType.Ship), that the stop step includes `systemctl stop nginx` to free port 80, and that the command ends with `|| true`; update the step if the order or guard is wrong (depends on T004)
- [x] T013 [US3] Update `carburetor.example.yml` to include a Docker deployment example showing `project.type: docker` and `project.build.dockerfilePath` with a comment explaining redeployment is automatic and always serves on port 80

**Checkpoint**: Two successive deploys to the same EC2 instance replace the container cleanly. User Story 3 is validated.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T014 [P] Write unit test for `DockerOrchestration.buildSteps` in `tests/unit/engines/DockerOrchestration.test.ts`: assert step IDs, types, and command strings match the data-model.md specification for a sample `BuildConfig`
- [x] T015 [P] Update `OrchestratingEngine.test.ts` in `tests/unit/engines/OrchestratingEngine.test.ts` to cover `ProjectType.Docker` returning a Docker pipeline (5 steps, correct types)
- [x] T016 Update `ShippingEngine.test.ts` in `tests/unit/engines/ShippingEngine.test.ts` to cover: (a) Docker validation failure when `dockerfilePath` is missing, (b) VCS bypass path (empty sourceDir created, fetchSource not called)
- [x] T017 [P] Run `bun test` and confirm all tests pass; fix any regressions in existing tests caused by the `ConfigLoader` VCS-optional change or `ShippingEngine` modifications
- [ ] T018 [P] Validate the quickstart.md walkthrough end-to-end on a real EC2 instance or document any gaps found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 complete (T001 needed for `BuildConfig` fields)
- **Phase 3 (US1)**: Depends on Phase 2 complete (T004, T005 needed)
- **Phase 4 (US2)**: Depends on Phase 2 complete; independent of Phase 3 (different file: `CSPAccess.ts`)
- **Phase 5 (US3)**: Depends on Phase 2 (T004); independent of Phase 3 and 4
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete

### User Story Dependencies

- **US1 (P1)**: Requires Phases 1 and 2 complete
- **US2 (P2)**: Requires Phase 2 complete; can be worked in parallel with US1 (different file)
- **US3 (P3)**: Requires Phase 2 complete; verification task only — no new engine code

### Within Phase 3 (US1)

- T006 before T007 (validation before bypass)
- T008 independent of T006/T007 (different method)
- T009 and T010 sequential (T010 extends T009's path)
- T006/T007/T008 can all be done before T009/T010 (engine before CLI)

### Parallel Opportunities

- T004 and T005 (Phase 2): different files — run in parallel
- T008 and T006 (Phase 3): different methods in ShippingEngine — can be batched
- T009 and T006/T007/T008 (Phase 3): different files (`DeployCLI.ts` vs `ShippingEngine.ts`) — run in parallel
- T011 (Phase 4) and T012/T013 (Phase 5): different files — run in parallel with each other and with Phase 3 finish
- T014, T015, T018 (Phase 6): all in different files — run in parallel

---

## Parallel Example: Phase 2 + early Phase 3

```bash
# Phase 2 (run together):
Task T004: "Create DockerOrchestration in src/engines/orchestrations/DockerOrchestration.ts"
Task T005: "Wire Docker type in src/engines/OrchestratingEngine.ts"

# Phase 3 can split across two workstreams once Phase 2 is done:
# Workstream A (engine):  T006 → T007, T008 (can batch)
# Workstream B (CLI):     T009 → T010
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Model + config (T001–T003)
2. Complete Phase 2: DockerOrchestration + wiring (T004–T005)
3. Complete Phase 3: ShippingEngine + CLI (T006–T010)
4. **STOP and VALIDATE**: `carburetor deploy --dockerfile ./Dockerfile --port 3000` deploys a running container to EC2
5. Ship MVP

### Incremental Delivery

1. Phase 1 + 2 → Docker pipeline exists (not yet wired to CLI)
2. Phase 3 → Full deploy works end-to-end (MVP)
3. Phase 4 → Progress output makes failures diagnosable
4. Phase 5 → Redeployment validated; example config shipped
5. Phase 6 → Test coverage, polish

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to implement concurrently
- No new runtime dependencies — Docker CLI invoked via existing `spawn` pattern
- `artifact.tar.gz` is always written to a temp `sourceDir`, never to the user's project directory
- VCS config (`CARBORATOR_VCS_TOKEN`) is not needed or checked for Docker deployments
- Container name `carburetor-app` and image name `carburetor-docker-image` are fixed in this MVP

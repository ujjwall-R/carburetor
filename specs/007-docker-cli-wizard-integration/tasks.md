# Tasks: Docker CLI and Wizard Integration

**Input**: Design documents from `specs/007-docker-cli-wizard-integration/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story — each story is independently implementable and testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story label (US1, US2)

---

## Phase 1: Foundational

**Purpose**: The `PROJECT_TYPE_OPTIONS` export is consumed by both `WizardSession` branches. Adding Docker here unblocks both US1 and US2.

- [x] T001 Add `{ value: ProjectType.Docker, label: 'Docker Container' }` to `PROJECT_TYPE_OPTIONS` in `src/client/wizard/prompts.ts` — insert after the `ReactApp` entry

**Checkpoint**: Docker is a valid wizard project type selection. No wizard logic changed yet.

---

## Phase 2: User Story 1 — Docker Wizard Path (Priority: P1) 🎯 MVP

**Goal**: Running `carburetor deploy --interactive` and selecting Docker Container collects Dockerfile path, EC2 instance ID, AWS credentials, and SSH details — no VCS credentials or deploy directory — then fires the existing Docker single-container pipeline.

**Independent Test**: Run `carburetor deploy --interactive`, select Docker Container, provide all prompts, confirm, and verify the deployment fires with `project.type === Docker` and `buildConfig.dockerfilePath` set. For unit testing: mock clack prompts with Docker inputs and assert request shape.

### Implementation for User Story 1

- [x] T002 [US1] Add Docker wizard branch to `WizardSession.run` in `src/client/wizard/WizardSession.ts`: after the project type `select`, add `if (projectType === ProjectType.Docker)` block; collect (1) Dockerfile path via `clack.text` with `existsSync` inline validation, (2) cloud platform via existing `CLOUD_PLATFORM_OPTIONS` select, (3) service type via `AWS_SERVICE_OPTIONS` select, (4) region/environment/instanceId via `clack.text`, (5) AWS access key + secret via `clack.password`, (6) SSH key mode via `clack.select` (inline/path), (7) SSH key value, (8) SSH username; show confirmation summary (include Dockerfile path, omit VCS and deploy dir); assemble and return `DeploymentRequest` with `project.type = ProjectType.Docker`, `buildConfig.dockerfilePath`, `vcsConfig`/`vcsCredentials` stubs, no `deployDir` in `cspCredentials` (depends on T001)
- [x] T003 [US1] Add Docker happy-path test to `tests/unit/client/wizard/WizardSession.test.ts`: select sequence `[ProjectType.Docker, CloudPlatform.AWS, 'ec2', 'path']`, text sequence `['./Dockerfile', 'us-east-1', 'production', 'i-0abc123def456', 'ec2-user', '~/.ssh/id_rsa']`, password sequence `['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG']`; assert `request.project.type === ProjectType.Docker`, `request.project.buildConfig.dockerfilePath` ends with `'Dockerfile'`, `request.vcsCredentials.token === ''`, and `request.cspCredentials['deployDir']` is `undefined` (depends on T002)

**Checkpoint**: Interactive wizard Docker path assembles a correct `DeploymentRequest` and hands it to the existing manager/engine pipeline. US1 fully functional.

---

## Phase 3: User Story 2 — React Wizard Uses Default Deploy Directory (Priority: P2)

**Goal**: Selecting React App in interactive mode no longer prompts for a deploy directory; `/var/www/html` is used automatically.

**Independent Test**: Run `carburetor deploy --interactive`, select React App, complete all prompts, verify no deploy directory question is shown and `cspCredentials['deployDir']` is `undefined` in the assembled request.

### Implementation for User Story 2

- [x] T004 [US2] Remove the `deployDir` text prompt from `WizardSession.run` in `src/client/wizard/WizardSession.ts`: delete the `clack.text({ message: 'Deployment directory on EC2 ...' })` call and its variable; remove `deployDir` from the confirmation summary `clack.note` lines; remove `deployDir` from `cspCredentials` assembly (depends on T002 — both edit `WizardSession.ts`)
- [x] T005 [US2] Update React fixtures in `tests/unit/client/wizard/WizardSession.test.ts`: remove `'/var/www/app'` from `HAPPY_INPUTS` (was index 15, array shrinks to 15 entries); remove the corresponding `textValues[6]` entry in `beforeEach`; remove the trailing `'/var/www/app'` from `textValuesPath` in the SSH-path-variant test; add assertion `expect(request.cspCredentials['deployDir']).toBeUndefined()` to the React happy-path test (depends on T004)

**Checkpoint**: React wizard no longer prompts for deploy directory. Both user stories independently functional.

---

## Phase 4: Polish

- [x] T006 [P] Run `bun test` and confirm all existing and new tests pass; fix any regressions caused by the `WizardSession` changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 (T001)
- **Phase 3 (US2)**: Depends on Phase 2 complete — T004 edits the same `WizardSession.ts` file as T002
- **Phase 4 (Polish)**: Depends on Phases 2–3 complete

### Within Phase 2

- T002 before T003 (wizard logic before test)

### Within Phase 3

- T004 before T005 (remove prompt before updating test fixture)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 — add Docker to options
2. T002 — Docker wizard branch
3. T003 — Docker test
4. **STOP and VALIDATE**: `carburetor deploy --interactive` → Docker Container → deploys

### Incremental Delivery

1. T001 → Docker selectable in wizard
2. T002 + T003 → Docker wizard path complete (MVP)
3. T004 + T005 → React wizard cleaned up
4. T006 → All tests green

---

## Notes

- No engine, access layer, model, or CLI flag changes — all work is in `WizardSession.ts`, `prompts.ts`, and `WizardSession.test.ts`
- The `--dockerfile` CLI flag path (via `carburetor.yml`) is unchanged
- Port 80 is fixed; `DockerOrchestration.ts` is not modified
- `deployDir` removed from wizard only; `carburetor_EC2_DEPLOY_DIR` env var path remains available for non-wizard users

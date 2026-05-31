---
description: "Task list for 004-interactive-wizard"
---

# Tasks: Interactive Deployment Wizard

**Input**: Design documents from `specs/004-interactive-wizard/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/wizard-interaction.md ✓

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: US1 = Complete Interactive Deployment, US2 = Credential Collection, US3 = Dry-Run Mode

---

## Phase 1: Setup

**Purpose**: Add the new dependency required by all wizard code.

- [x] T001 Add `@clack/prompts` dependency by running `bun add @clack/prompts` and verifying it appears in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the skeleton files that all three user stories build on. Must be complete before any US phase begins.

**⚠️ CRITICAL**: No user story work can start until this phase is complete.

- [x] T002 Create `src/client/wizard/prompts.ts` exporting four typed constant arrays: `PROJECT_TYPE_OPTIONS` (`[{ value: ProjectType.ReactApp, label: 'React App' }, { value: ProjectType.Custom, label: 'Other (experimental)' }]`), `VCS_PROVIDER_OPTIONS` (`[{ value: VCSProvider.GitHub, label: 'GitHub' }]`), `CLOUD_PLATFORM_OPTIONS` (`[{ value: CloudPlatform.AWS, label: 'AWS' }]`), `AWS_SERVICE_OPTIONS` (`[{ value: 'ec2', label: 'EC2 Instance' }]`); import enums from `../../models/enums.js`
- [x] T003 Create `src/client/wizard/WizardSession.ts` with class `WizardSession` containing a single public async method `run(dryRun: boolean, verbose: boolean): Promise<DeploymentRequest>` that throws `new Error('Not implemented')` as stub; add all necessary model imports from `../../models/`

**Checkpoint**: Both wizard files exist and compile. DeployCLI is unchanged.

---

## Phase 3: User Story 1 — Complete Interactive Deployment (Priority: P1) 🎯 MVP

**Goal**: A user with no `megalodon.yml` can run "`meg deploy --interactive`", navigate the selection menus and text prompts for project type, VCS, cloud platform, service, region, environment, and instance ID, confirm the summary, and trigger a deployment.

**Independent Test**: Run "`meg deploy --interactive`", answer all prompts (skip credential prompts by passing dummy values), confirm summary, observe deployment outcome — with no `megalodon.yml` present.

### Implementation

- [x] T004 [US1] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Step 1 (project type `select` using `PROJECT_TYPE_OPTIONS`), checking `isCancel` after each prompt and calling `clack.cancel('Wizard cancelled.')` + `process.exit(1)` on cancel
- [x] T005 [US1] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Steps 2–4 (repo URL `text`, branch `text` with default `main`, VCS provider `select` using `VCS_PROVIDER_OPTIONS`); add `validate: (v) => v.length === 0 ? 'This field is required.' : undefined` to each `text()` call; check `isCancel` after each
- [x] T006 [US1] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Steps 6–10 (cloud platform `select` using `CLOUD_PLATFORM_OPTIONS`, service type `select` using `AWS_SERVICE_OPTIONS`, region `text`, environment `text` with default `production`, EC2 instance ID `text`); check `isCancel` after each
- [x] T007 [US1] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Step 17 (confirmation summary using `clack.note()` to display all non-secret selections, then `clack.confirm({ message: 'Proceed with deployment?' })`); on cancel/no, call `clack.cancel('Deployment cancelled.')` + `process.exit(1)`
- [x] T008 [US1] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement `DeploymentRequest` assembly from collected session values and return it (leave credential fields as empty strings for now — US2 fills them in)
- [x] T009 [US1] In `src/client/DeployCLI.ts`, add `interactive: boolean` to the `CLIArgs` interface and add `.option('-i, --interactive', 'Launch interactive setup wizard', false)` to the `deploy` command builder
- [x] T010 [US1] In `src/client/DeployCLI.ts`, refactor the shared deploy execution tail (dry-run check + `manager.deploy` + `renderOutcome` + `process.exit`) from `runDeploy` into a new private method `executeRequest(request: DeploymentRequest, args: CLIArgs): Promise<void>`
- [x] T011 [US1] In `src/client/DeployCLI.ts`, add the interactive branch at the top of `runDeploy`: if `args.interactive` is true AND `args.config` equals `'./meg.yml'` (the default, meaning no explicit --config), dynamically import `WizardSession`, instantiate it, call `session.run(args.dryRun, args.verbose)` to get the request, then call `this.executeRequest(request, args)` and return

**Checkpoint**: "`meg deploy --interactive`" starts wizard, collects non-credential inputs, shows summary, and calls `manager.deploy`. Existing file-based path is unchanged.

---

## Phase 4: User Story 2 — Step-by-Step Credential Collection (Priority: P2)

**Goal**: All credential prompts (GitHub token, AWS keys, EC2 SSH) use masked input, validate non-empty inline, and enforce a 3-attempt limit with a clean exit on repeated failure.

**Independent Test**: Run the wizard to the credential section, press Enter on an empty required field three times, and confirm the wizard exits with code 1 and a "too many attempts" message — no deployment triggered.

### Implementation

- [x] T012 [US2] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Step 5 (GitHub token `password` prompt, label `GitHub Personal Access Token`, non-empty validation via 3-attempt helper); populate `request.vcsCredentials.token`
- [x] T013 [US2] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Steps 11–12 (AWS access key ID and secret access key as two separate `password` prompts with labels `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, each with 3-attempt non-empty validation); populate `request.cspCredentials.accessKeyId` and `.secretAccessKey`
- [x] T014 [US2] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Step 13 (SSH key input method `select`: "Paste inline" | "Path to key file"), then Step 14a (`password` prompt for inline SSH key) or Step 14b (`text` prompt for SSH key file path) depending on selection; populate `request.cspCredentials.sshKey` or `.sshKeyPath`
- [x] T015 [US2] In `WizardSession.run()` in `src/client/wizard/WizardSession.ts`, implement Steps 15–16 (SSH username `text` and deploy directory `text`, both with non-empty validation and 3-attempt limit); populate `request.cspCredentials.sshUser` and `.deployDir`
- [x] T016 [US2] In `src/client/wizard/WizardSession.ts`, extract a private helper method `promptWithRetry(promptFn: () => Promise<string | symbol>, maxAttempts: number): Promise<string>` that retries up to `maxAttempts` times on empty/invalid input, then calls `clack.cancel('Too many invalid attempts. See docs.')` + `process.exit(1)` on exhaustion; refactor Steps 5, 11–16 to use this helper

**Checkpoint**: All credential prompts are masked, validated non-empty, and protected by the 3-attempt limit. Secrets never appear in terminal output.

---

## Phase 5: User Story 3 — Wizard Dry-Run Mode (Priority: P3)

**Goal**: Running "`meg deploy --interactive --dry-run`" collects all wizard inputs and then calls `manager.validate()` instead of `manager.deploy()`, printing credential pass/fail without deploying.

**Independent Test**: Run "`meg deploy --interactive --dry-run`", complete all prompts, and verify output shows validation results with no deployment performed and exit code 0 on success.

### Implementation

- [x] T017 [US3] Verify in `src/client/DeployCLI.ts` that `executeRequest()` correctly passes `args.dryRun` to the dry-run branch (`manager.validate`) — this should already work since the `dryRun` flag is threaded via `args`; if any adjustment is needed make it here
- [x] T018 [US3] In `src/client/DeployCLI.ts`, add the `--interactive` + `--config` conflict path in `runDeploy`: if `args.interactive` is true AND `args.config` differs from `'./meg.yml'` (meaning `--config` was explicitly set), write a warning to `process.stderr` and fall through to the normal file-based path

**Checkpoint**: "`meg deploy --interactive --dry-run`" works end-to-end. "`meg deploy --interactive --config ./meg.yml`" prints warning and uses the config file.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Unit test coverage and final verification.

- [x] T019 [P] Create `tests/unit/client/wizard/WizardSession.test.ts` with a happy-path test: mock `@clack/prompts` to return predetermined non-cancel values for all 17 steps, call `new WizardSession().run(false, false)`, assert the returned `DeploymentRequest` has the expected `project.type`, `vcsConfig.provider`, `target.platform`, `vcsCredentials.token`, `cspCredentials.accessKeyId`
- [x] T020 [P] In `tests/unit/client/wizard/WizardSession.test.ts`, add a cancel test: mock the first `@clack/prompts` call to return the `cancel` symbol (use `Symbol()` matching `isCancel`), spy on `process.exit`, call `run()`, assert `process.exit(1)` was called
- [x] T021 In `tests/unit/client/wizard/WizardSession.test.ts`, add SSH key choice tests: one test where Step 13 returns `'inline'` (assert `cspCredentials.sshKey` is set, `.sshKeyPath` is undefined), one where it returns `'path'` (assert `.sshKeyPath` is set, `.sshKey` is undefined)
- [x] T022 Run `grep -r "IShippingEngine\|IOrchestratingEngine\|ShippingEngine\|OrchestratingEngine" src/client/wizard/` and verify zero results (SC-003 check)
- [x] T023 [P] Create `README.md` at the repository root with a customer-facing guide covering: what megalodon does (one-line description), installation (`bun build --compile`), the two usage modes (file-based with `megalodon.yml` sample and interactive with "`meg deploy --interactive`" annotated walkthrough showing each prompt step), the `--dry-run` flag, and a prerequisites section listing required env vars for each cloud platform
- [x] T024 Run `bun test` and verify all tests pass including new WizardSession tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (needs `@clack/prompts` installed to compile)
- **US1 (Phase 3)**: Depends on Phase 2 (needs `WizardSession` stub + `prompts.ts`)
- **US2 (Phase 4)**: Depends on Phase 3 (credential prompts are added to the existing `run()` method; requires Steps 1–17 structure from US1)
- **US3 (Phase 5)**: Depends on Phase 3 (needs `executeRequest` from T010 to exist)
- **Polish (Phase 6)**: T019–T021 depend on Phase 4 completion; T022–T023 require all phases done

### Within Phase 3

- T004 → T005 → T006 → T007 → T008 (sequential: each builds on the `run()` method)
- T009, T010, T011 can start once T003 is done (different methods of `DeployCLI.ts`) but T011 depends on T010 (needs `executeRequest` to exist)

### Parallel Opportunities

- T019, T020 can be written in parallel (different test cases, same file, no cross-dependency)
- T022 and T023 are fast verifications, run sequentially after all prior phases

---

## Parallel Example: Phase 6

```bash
# These two test tasks touch different test cases in the same file:
Task T019: "Happy-path WizardSession test in tests/unit/client/wizard/WizardSession.test.ts"
Task T020: "Cancel-at-first-prompt test in tests/unit/client/wizard/WizardSession.test.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 Only — no credentials)

1. Phase 1: Install `@clack/prompts` (T001)
2. Phase 2: Create `prompts.ts` + `WizardSession` stub (T002–T003)
3. Phase 3: Implement selection/text prompts, confirmation, request assembly, DeployCLI integration (T004–T011)
4. **STOP and VALIDATE**: Run "`meg deploy --interactive`" with dummy credential strings, confirm flow works end-to-end
5. Proceed to Phase 4 (credentials), Phase 5 (dry-run), Phase 6 (polish)

### Full Delivery

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 (sequential)
2. Each phase is independently testable at its checkpoint
3. Run `bun test` after Phase 6 for final gate

---

## Notes

- `@clack/prompts` must be mocked in unit tests — use Bun's `mock.module()` to replace the module with stub implementations
- T016 (`promptWithRetry` helper) retroactively refactors T012–T015; do T012–T015 first with inline retry logic, then extract
- Manager and Engine source files (`src/managers/`, `src/engines/`, `src/access/`) MUST NOT be modified — T022 verifies the Client-layer constraint
- T023 (README) can run in parallel with T019–T021 tests — different file, no code dependencies
- Total: 24 tasks across 6 files (1 package.json, 2 new wizard files, 1 modified DeployCLI, 1 new test file, 1 new README.md)

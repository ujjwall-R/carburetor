---
description: "Task list for 003-enforce-client-manager-boundary"
---

# Tasks: Enforce Client–Manager Layer Boundary

**Input**: Design documents from `specs/003-enforce-client-manager-boundary/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

No new project initialization required — repository structure and tooling are already in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the Manager interface and implementation with `validate`. These changes must be complete before either user story can be updated in `DeployCLI`.

**⚠️ CRITICAL**: Both user stories depend on this phase completing first.

- [x] T001 Add `validate(request: DeploymentRequest): Promise<ValidationResult>` signature to `IDeploymentManager` in `src/managers/IDeploymentManager.ts` (import `ValidationResult` from `../models/DeploymentOutcome.js`)
- [x] T002 Implement `validate` in `DeploymentManager` in `src/managers/DeploymentManager.ts`: add method body `return this.shipping.validateCredentials(request);` and add `ValidationResult` to the import from `../models/DeploymentOutcome.js`
- [x] T003 Remove `IShippingEngine` import, constructor parameter, and `private readonly shipping` field from `DeployCLI` in `src/client/DeployCLI.ts` (constructor becomes `(manager: IDeploymentManager, configLoader: ConfigLoader)`)
- [x] T004 Remove `shipping` argument from the `DeployCLI` constructor call in `src/index.ts` (line 22: `new DeployCLI(manager, shipping, configLoader)` → `new DeployCLI(manager, configLoader)`)

**Checkpoint**: `IDeploymentManager` has `validate`, `DeploymentManager` implements it, `DeployCLI` no longer compiles with an engine parameter — both user story tasks can now proceed.

---

## Phase 3: User Story 1 — Deploy Dry-Run (Priority: P1) 🎯 MVP

**Goal**: The `deploy --dry-run` path calls `this.manager.validate` instead of the removed `this.shipping` reference.

**Independent Test**: Run `carburetor deploy --dry-run` with valid and invalid credentials; verify exit code 0 / exit code 1 respectively. Confirm `grep -r "IShippingEngine" src/client/` returns no results.

### Implementation

- [x] T005 [US1] In `DeployCLI.runDeploy` in `src/client/DeployCLI.ts`, replace `this.shipping.validateCredentials(request)` with `this.manager.validate(request)` (dry-run branch, currently line 106)

**Checkpoint**: `deploy --dry-run` is fully functional and the Client no longer references any Engine interface.

---

## Phase 4: User Story 2 — Validate Subcommand (Priority: P2)

**Goal**: The `validate` subcommand calls `this.manager.validate` instead of the removed `this.shipping` reference.

**Independent Test**: Run `carburetor validate` with valid and invalid credentials; verify per-check output and exit codes are identical to pre-refactor behavior.

### Implementation

- [x] T006 [US2] In `DeployCLI.runValidate` in `src/client/DeployCLI.ts`, replace `this.shipping.validateCredentials(request)` with `this.manager.validate(request)` (currently line 151)

**Checkpoint**: Both `deploy --dry-run` and `carburetor validate` work correctly. `DeployCLI` has zero Engine references.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Test coverage for the new `validate` operation and final verification.

- [x] T007 [P] Add unit test `'returns valid=true when shipping.validateCredentials resolves valid'` to `tests/unit/managers/DeploymentManager.test.ts` under a new `// ─── validate ───` block (use existing `manager` and `shippingMock` fixtures)
- [x] T008 [P] Add unit test `'returns valid=false with errors when shipping.validateCredentials reports failure'` to `tests/unit/managers/DeploymentManager.test.ts` (mock `shippingMock.validateCredentials` to return `{ valid: false, errors: ['Missing AWS_ACCESS_KEY_ID'] }`)
- [x] T009 Run `grep -r "IShippingEngine" src/client/` and verify zero results (SC-001 acceptance criterion)
- [x] T010 Run `bun test` and confirm all tests pass with no assertion changes (SC-004 acceptance criterion)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **User Stories (Phase 3 & 4)**: Both depend on Phase 2 completion (T001–T004)
- **Polish (Phase 5)**: T007/T008 can start as soon as T002 is complete [P]; T009/T010 require all prior phases done

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 only — no dependency on US2
- **User Story 2 (P2)**: Depends on Phase 2 only — no dependency on US1 (different method in same file)

### Within Phase 2

- T001 → T002 (implement after interface is defined)
- T003 and T004 can start once T001 is complete [same file as T005/T006 so sequential in practice]

### Parallel Opportunities

- T007 and T008 (tests) can be written in parallel with T005 and T006 since they target a different file
- T009 and T010 are fast verification steps, can run back-to-back at the end

---

## Parallel Example: Phase 5

```bash
# These two test tasks can be written at the same time (different test cases, same file):
Task T007: "Add validate happy-path test to DeploymentManager.test.ts"
Task T008: "Add validate failure-path test to DeploymentManager.test.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T004) — ~10 min
2. Complete Phase 3: US1 dry-run fix (T005) — ~2 min
3. **STOP and VALIDATE**: Run `carburetor deploy --dry-run`, confirm output, confirm no engine import
4. Proceed to Phase 4 (US2) and Phase 5 (tests + verification)

### Full Delivery

1. Phase 2 → Phase 3 → Phase 4 → Phase 5 (sequential, ~30 min total)
2. All tasks are single-developer; no parallelism required
3. Run `bun test` after Phase 5 for final gate

---

## Notes

- T003 and T004 are prerequisites for the compiler to accept T005 and T006 — TypeScript will error if the `shipping` reference is still present after T003
- No new files are created — this is a pure edit-only refactor across 4 existing files
- Total: 10 tasks across 4 files

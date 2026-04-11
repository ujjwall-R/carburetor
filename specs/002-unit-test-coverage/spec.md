# Feature Specification: Unit Test Coverage

**Feature Branch**: `002-unit-test-coverage`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "lets write unit test for the project. specify the things for it and how coverage will be calculated etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Unit Tests and See Results (Priority: P1)

A developer makes changes to a component and wants to immediately verify that their changes don't break any existing behavior. They run a single command and get a clear pass/fail result with details on which tests failed and why.

**Why this priority**: This is the core utility of unit tests — instant feedback on correctness. Without this, all other test stories have no foundation.

**Independent Test**: Can be fully tested by running the test suite against the existing codebase and verifying the output clearly shows each test case name, its status (pass/fail), and any failure details.

**Acceptance Scenarios**:

1. **Given** the codebase is in a clean state, **When** the developer runs the test command, **Then** all tests pass and the output lists each test suite with a pass count and total execution time.
2. **Given** a component has a regression introduced, **When** the developer runs the test command, **Then** the failing test(s) are named explicitly and the assertion failure message pinpoints the mismatch.
3. **Given** a test file cannot be parsed or compiled, **When** the test command runs, **Then** the error is reported with file name and line number — other tests still execute.

---

### User Story 2 - View Code Coverage Report (Priority: P2)

A tech lead reviews a pull request and wants to know whether the new code is adequately tested. They generate a coverage report that shows which lines, branches, and functions are exercised by the test suite, and which are not.

**Why this priority**: Coverage reporting makes the quality of tests visible and auditable. It surfaces gaps before code ships to production.

**Independent Test**: Can be fully tested by generating a coverage report against the existing test suite and verifying it lists per-file and aggregate coverage percentages for lines, branches, and functions.

**Acceptance Scenarios**:

1. **Given** the test suite runs successfully, **When** the developer requests a coverage report, **Then** the report shows per-file coverage for every source file — lines covered, lines total, and percentage.
2. **Given** a source file has an untested branch, **When** the coverage report is generated, **Then** that file's branch coverage is below 100% and the uncovered branch is identifiable in the report.
3. **Given** a new file is added to the source tree but has no corresponding tests, **When** coverage is computed, **Then** the file appears in the report with 0% coverage — it is not silently excluded.

---

### User Story 3 - Enforce Coverage Thresholds (Priority: P3)

A CI pipeline runs on every pull request. If the test suite passes but coverage drops below defined thresholds, the pipeline fails so that low-coverage code cannot be merged.

**Why this priority**: Enforcement automates the quality gate — developers don't need to manually check coverage before merging.

**Independent Test**: Can be tested by deliberately removing a test and verifying the pipeline step that checks coverage exits with a failure code when the threshold is violated.

**Acceptance Scenarios**:

1. **Given** defined minimum coverage thresholds, **When** the test suite produces coverage above those thresholds, **Then** the coverage check passes and the pipeline continues.
2. **Given** defined minimum coverage thresholds, **When** coverage drops below a threshold, **Then** the coverage check exits with a non-zero code and names the threshold that was violated.
3. **Given** a threshold set for a specific layer (e.g., engines), **When** only that layer's coverage drops, **Then** the check reports specifically which layer failed — not just a global failure.

---

### Edge Cases

- What happens when no tests exist yet — does coverage report 0% or fail to run entirely?
- How does the system handle tests that are skipped (marked as pending/todo) — do they count against coverage?
- What if a source file imports a cloud SDK that is unavailable in the test environment — are those call sites excluded from coverage or counted as uncovered?
- What happens when a test file takes too long — does the runner time out and report cleanly?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST cover all public methods of the Manager layer (`DeploymentManager`) with unit tests that mock all Engine dependencies.
- **FR-002**: The test suite MUST cover all public methods of both Engine components (`OrchestratingEngine`, `ShippingEngine`) with unit tests that mock all ResourceAccess and strategy dependencies.
- **FR-003**: The test suite MUST verify that each layer component behaves correctly in its happy-path scenario (successful inputs produce expected outputs).
- **FR-004**: The test suite MUST verify each layer component's error handling — invalid inputs, dependency failures, and unexpected states must produce meaningful, typed errors rather than unhandled exceptions.
- **FR-005**: The test suite MUST verify the `OrchestratingEngine` produces correct pipeline step sequences for each supported project type (static frontend, containerized, custom-script).
- **FR-006**: The test suite MUST verify `ShippingEngine` skips the cloud deployment step when the pipeline executor returns a `pending` status, and proceeds when status is `completed`.
- **FR-007**: The test suite MUST verify `DeploymentManager` propagates the correct outcome in both the `completed` and `pending` executor paths.
- **FR-008**: Code coverage MUST be computed per source file and reported as: line coverage, branch coverage, and function coverage — each as a percentage.
- **FR-009**: A coverage threshold MUST be configurable per layer: one threshold for managers, one for engines, and one for the aggregate codebase.
- **FR-010**: The coverage check MUST exit with a non-zero status code when any configured threshold is violated.
- **FR-011**: All ResourceAccess components (`VCSAccess`, `CSPAccess`) MUST be covered by integration tests (separate from unit tests) that test against real or sandboxed external endpoints — these are out of scope for unit tests but the distinction between unit and integration tests MUST be enforced through directory structure.

### Key Entities

- **Test Suite**: The full collection of test cases organized by layer, each asserting a specific behavior of a component in isolation.
- **Coverage Report**: A per-file and aggregate summary of which lines, branches, and functions were executed during the test run.
- **Coverage Threshold**: A minimum acceptable coverage percentage defined per layer (managers, engines) and for the overall codebase.
- **Mock / Test Double**: A stand-in implementation of a dependency interface used in unit tests to isolate the component under test.
- **Test Case**: A single scenario that asserts a specific behavior — includes setup, action, and assertion.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The full unit test suite completes in under 30 seconds on a standard developer machine.
- **SC-002**: Line coverage for the Manager and Engine layers is at or above 90% after the initial test suite is written.
- **SC-003**: Branch coverage for the Manager and Engine layers is at or above 80% after the initial test suite is written.
- **SC-004**: Every public method on every Manager and Engine class has at least one dedicated test case — no public method is left entirely uncovered.
- **SC-005**: A developer can introduce a deliberate bug in any Manager or Engine method and at least one test case fails within the same run.
- **SC-006**: The coverage threshold check correctly blocks a pipeline run in 100% of cases where coverage is below the configured minimum.

---

## Assumptions

- The test runner (`bun test`) and coverage tooling are already available in the development environment via the project's existing package manager setup.
- Unit tests mock all external I/O — no real VCS calls or cloud API calls are made in unit tests; those are deferred to the existing integration test layer.
- The `LocalPipelineExecutor` is the only executor implementation that requires unit testing in this iteration; Jenkins and Temporal executors are tested once their implementations are complete.
- Coverage is computed at the time of the test run; there is no separate coverage-collection step required before reporting.
- The coverage thresholds defined here apply to source files under `src/managers/` and `src/engines/` — client layer and config loader are excluded from threshold enforcement in v1 as they have higher external coupling.
- Each test file corresponds to one source file and lives under a mirrored directory path in `tests/unit/`.

# Feature Specification: Functional Deployment Test (YAML Config + React App)

**Feature Branch**: `005-deploy-functional-test`  
**Created**: 2026-04-18  
**Status**: Done  
**Input**: User description: "we need to write the functional test of deploying using config yml and react app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real End-to-End Deployment via Root YAML Config (Priority: P1)

A developer runs the functional test suite against the actual `megalodon.yml` in the repo root. The test loads the config, reads real credentials from the root `.env` (which Bun loads automatically), and drives the full deployment stack — VCS fetch, build, package, ship — against real infrastructure. The test passes only if the app is live.

**Why this priority**: This is the only scenario. The point of the test is to validate that the entire deployment pipeline works for a real React app on real infrastructure. There is no value in a watered-down version.

**Independent Test**: Run `bun test tests/functional/` with valid credentials in `.env` and a reachable target in `megalodon.yml`.

**Acceptance Scenarios**:

1. **Given** a valid `megalodon.yml` at the repo root and a `.env` with real credentials, **When** the functional test runs, **Then** the deployment completes and `outcome.status` is `Completed`.

---

### Edge Cases

- What happens if `.env` is missing or a required credential is absent? The test throws at credential resolution before reaching the deployment step.
- What if the cloud target is unreachable? The test fails with a `Failed` outcome and the error is visible in test output.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The functional test MUST use the real `megalodon.yml` from the repo root — no fixture copy.
- **FR-002**: The functional test MUST use the real production stack with no mocks or stubs: `ConfigLoader`, `OrchestratingEngine`, `ShippingEngine`, `LocalPipelineExecutor`, `VCSAccess`, `CSPAccess`.
- **FR-003**: Credentials MUST be sourced from the root `.env` file, loaded automatically by Bun at test startup — no helper code required.
- **FR-004**: The test MUST assert `outcome.status === ExecutionStatus.Completed`.
- **FR-005**: No production source code is changed by this feature.

### Key Entities

- **`megalodon.yml`** (repo root): The real deployment config used in production and in the test.
- **`.env`** (repo root): Real credentials loaded automatically by Bun. Never committed.
- **`tests/functional/deploy-yml-react.test.ts`**: The single functional test file.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The test passes end-to-end against real infrastructure when valid credentials and config are present.
- **SC-002**: The test file contains exactly one test case.
- **SC-003**: No production source files are modified.

---

## Assumptions

- The developer has a valid `.env` at the repo root with all credentials required by the configured cloud platform.
- `megalodon.yml` points to a reachable React app repo and a live cloud target.
- The test is not run in CI without credentials — it is a developer-run integration test.

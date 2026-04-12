# Feature Specification: Enforce Client–Manager Layer Boundary

**Feature Branch**: `003-enforce-client-manager-boundary`
**Created**: 2026-04-12
**Status**: Draft
**Input**: User description: "All good and working but one thing I did not like. Client is calling shipping engine. client should only depend on manager. I added that in claude.md but you ignored."

## Overview

The system's layered architecture requires that the Client layer communicates exclusively with the Manager layer. The current implementation violates this rule: `DeployCLI` (Client) directly imports and calls `IShippingEngine` (Engine) for credential validation in both the `deploy --dry-run` path and the `validate` subcommand. This feature corrects that violation by routing all credential-validation requests through `IDeploymentManager`, preserving the architecture's separation of concerns and ensuring future changes to the Engine layer do not ripple up to the Client.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Run Deployment with Dry-Run Flag (Priority: P1)

A developer runs `carburetor deploy --dry-run` to verify their configuration and cloud credentials are valid before a real deployment. The system validates credentials and reports pass/fail without performing any deployment.

**Why this priority**: This is the primary validation flow. Broken dry-run immediately blocks users from safely confirming their setup.

**Independent Test**: Can be fully tested by running `carburetor deploy --dry-run` against a config file and verifying the process exits with 0 on valid credentials and non-zero on invalid — without any engine import visible in the Client source.

**Acceptance Scenarios**:

1. **Given** valid `carburetor.yml` and valid cloud credentials, **When** the user runs `deploy --dry-run`, **Then** the system prints "Config and credentials valid" and exits 0.
2. **Given** invalid credentials, **When** the user runs `deploy --dry-run`, **Then** the system prints a validation failure message listing errors and exits 1.
3. **Given** `DeployCLI` source code, **When** inspected for engine imports, **Then** no `IShippingEngine` or any other Engine interface appears as a constructor dependency or direct import.

---

### User Story 2 — Run `validate` Subcommand (Priority: P2)

A developer runs `carburetor validate` to check credentials without constructing a full deployment request. The system returns a pass/fail result with per-check detail.

**Why this priority**: The `validate` command is a standalone UX entry point for pre-flight checks; it must also respect the layer rule.

**Independent Test**: Can be fully tested by running `carburetor validate` and verifying the output shows per-credential results — while the Client source shows only a Manager dependency.

**Acceptance Scenarios**:

1. **Given** valid VCS and cloud credentials, **When** the user runs `carburetor validate`, **Then** the system prints "✓ VCS credentials valid", "✓ Cloud credentials valid", and exits 0.
2. **Given** invalid credentials, **When** the user runs `carburetor validate`, **Then** the system prints per-check failure lines and exits 1.
3. **Given** `DeployCLI` source code, **When** the `runValidate` method is inspected, **Then** it calls only `IDeploymentManager` — never an Engine interface.

---

### Edge Cases

- What happens when `validate` is called without a config file present? — Error message from config loading, not from credential validation; exits 1.
- What happens when the Manager's `validate` implementation itself throws? — Client surfaces the error message to stderr and exits 1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `IDeploymentManager` MUST expose a `validate` operation that accepts a deployment request and returns a structured result containing a validity flag and a list of error messages.
- **FR-002**: `DeploymentManager` MUST implement `validate` by delegating to the underlying Engine's credential-validation capability.
- **FR-003**: `DeployCLI` MUST depend only on `IDeploymentManager`; it MUST NOT import or hold a reference to any Engine interface.
- **FR-004**: The `deploy --dry-run` path in `DeployCLI` MUST call `IDeploymentManager.validate` instead of calling any Engine method directly.
- **FR-005**: The `validate` subcommand in `DeployCLI` MUST call `IDeploymentManager.validate` instead of calling any Engine method directly.
- **FR-006**: The constructor of `DeployCLI` MUST NOT accept any Engine as a constructor parameter.
- **FR-007**: All existing observable behaviors of `deploy --dry-run` and `validate` MUST be preserved after the refactor (same exit codes, same output messages).

### Key Entities

- **`IDeploymentManager`**: The Manager interface that is the sole point of contact between the Client and the business-logic layers. Extended with a `validate` operation.
- **`DeploymentManager`**: Concrete implementation; delegates `validate` to `IShippingEngine` internally.
- **`DeployCLI`**: The CLI Client; depends only on `IDeploymentManager` and `ConfigLoader` after this change.
- **`ValidationResult`**: The data structure returned by `validate`, containing `valid: boolean` and `errors: string[]`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `DeployCLI` source file contains zero imports of any Engine interface after the change is applied.
- **SC-002**: Running `carburetor deploy --dry-run` produces identical output and exit codes as before the refactor for both valid and invalid credential scenarios.
- **SC-003**: Running `carburetor validate` produces identical output and exit codes as before the refactor for both valid and invalid credential scenarios.
- **SC-004**: All existing unit tests pass without modification to test assertions (only wiring/injection changes are permitted).
- **SC-005**: The `IDeploymentManager` interface gains exactly one new operation (`validate`) with no breaking changes to existing callers of `deploy`.

## Assumptions

- The `ValidationResult` type is already defined in `DeploymentOutcome.ts` and can be reused as the return type for `IDeploymentManager.validate` without modification.
- `DeploymentManager` already receives `IShippingEngine` as a constructor dependency, so implementing `validate` there requires no new wiring at the composition root.
- The composition root (`src/index.ts`) wires `DeploymentManager` with `IShippingEngine`; after this change it no longer passes `IShippingEngine` to `DeployCLI`.
- No external consumers depend on the current `DeployCLI` constructor signature (it is internal to the binary).

# Research: Enforce Client–Manager Layer Boundary

**Phase 0 output** | All findings derived from codebase inspection.

## Decision 1: ValidationResult return type for IDeploymentManager.validate

**Decision**: Reuse the existing `ValidationResult` interface from `src/models/DeploymentOutcome.ts`.

**Rationale**: The type already has the exact shape needed (`valid: boolean`, `errors: string[]`). Adding a new type would introduce duplication.

**Alternatives considered**: Defining a new `ManagerValidationResult` type — rejected; identical shape with no new fields needed.

## Decision 2: Implementation location for validate in DeploymentManager

**Decision**: Add `validate(request: DeploymentRequest): Promise<ValidationResult>` directly to `DeploymentManager`; body delegates to `this.shipping.validateCredentials(request)`.

**Rationale**: `DeploymentManager` already holds `IShippingEngine` as `this.shipping`. No new constructor dependencies, no new wiring.

**Alternatives considered**: A dedicated `ValidationManager` — rejected; spec FR-001 specifies adding to `IDeploymentManager`, not a new Manager, and introducing a second Manager for a single delegating operation violates the Manager:Engine golden ratio.

## Decision 3: Composition root wiring change

**Decision**: In `src/index.ts`, remove `shipping` from the `DeployCLI` constructor call. The `manager` already encapsulates the shipping dependency.

**Rationale**: After the refactor the CLI's `validate` and dry-run paths both call `manager.validate`, so there is no remaining reason for `DeployCLI` to hold a reference to `ShippingEngine`.

**Alternatives considered**: Keeping the parameter but marking it unused — rejected; this would leave a dead dependency that still violates the layer rule.

## Decision 4: Test strategy

**Decision**: Add two new unit tests to `tests/unit/managers/DeploymentManager.test.ts` covering `validate` — one for a valid result, one for an invalid result. Do not modify existing test assertions.

**Rationale**: Spec SC-004 requires all existing tests to pass. The new operation needs its own coverage. `DeployCLI` does not need new tests because the observable behavior is identical (SC-002, SC-003).

**Alternatives considered**: Integration tests for the CLI — deferred; the CLI's behavior is unchanged, so unit coverage at the Manager level is sufficient.

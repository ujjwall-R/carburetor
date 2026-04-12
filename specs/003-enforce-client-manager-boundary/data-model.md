# Data Model: Enforce Client–Manager Layer Boundary

No new data entities are introduced. This is a pure structural/wiring refactor.

## Affected Interfaces

### IDeploymentManager (extended)

```
IDeploymentManager
  deploy(request: DeploymentRequest): Promise<DeploymentOutcome>   ← existing, unchanged
  validate(request: DeploymentRequest): Promise<ValidationResult>  ← NEW
```

### ValidationResult (unchanged, reused)

```
ValidationResult
  valid:  boolean     ← true if all credentials pass
  errors: string[]    ← human-readable error messages when valid=false
```

## Layer Dependency Graph (after change)

```
DeployCLI (Client)
  └── IDeploymentManager (Manager interface)
        └── DeploymentManager (Manager impl)
              ├── IOrchestratingEngine
              └── IShippingEngine
                    └── validateCredentials  ← called via manager.validate, never directly from Client
```

No storage, no new persistence, no new state transitions.

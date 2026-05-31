# Data Model: Functional Deployment Test (YAML Config + React App)

**Feature**: `005-deploy-functional-test`  
**Date**: 2026-04-18

No new data models or entities are introduced. The test uses existing types unchanged.

## Entities Used (from existing codebase)

- **`megalodonConfig`** — produced by `ConfigLoader.load('megalodon.yml')`
- **`DeploymentRequest`** — assembled from config + resolved credentials; passed to `DeploymentManager.deploy()`
- **`DeploymentOutcome`** — returned by `manager.deploy()`; test asserts `outcome.status === Completed`

## Pipeline Flow (real, no stubs)

```
megalodon.yml
  └─► ConfigLoader.load()  →  megalodonConfig
        └─► resolveVCSCredentials()  →  VCSCredentials   (from process.env via .env)
        └─► resolveCSPCredentials()  →  CSPCredentials   (from process.env via .env)
              └─► DeploymentManager.deploy(request)
                    └─► OrchestratingEngine.buildPipeline()  →  Pipeline
                    └─► ShippingEngine.validateCredentials()
                    └─► ShippingEngine.run()
                          └─► VCSAccess.fetchSource()       (real GitHub clone)
                          └─► LocalPipelineExecutor.execute()  (real npm build)
                          └─► CSPAccess.deploy()            (real AWS/GCP/Azure)
                    └─► DeploymentOutcome  →  assert Completed
```

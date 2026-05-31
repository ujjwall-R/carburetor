# Research: Docker CLI and Wizard Integration

**Feature**: `007-docker-cli-wizard-integration`  
**Date**: 2026-04-19

---

## Decision 1: Docker wizard uses same EC2/AWS path as React — no direct SSH host mode

**Decision**: The Docker wizard collects the same EC2 instance ID and AWS credentials (access key, secret key) that the React app wizard already collects. The existing `CSPAccess.deployToEC2` → `getEC2PublicDns` path is reused unchanged.

**Rationale**: The single-container Docker pipeline is already fully implemented through the engine and access layers. The wizard just needs to assemble the same `DeploymentRequest` shape, with `project.type = Docker` and `buildConfig.dockerfilePath` instead of VCS details. No access layer or engine changes are required.

**Alternatives considered**:
- Direct `--host` IP/DNS flag: rejected — adds complexity in the access layer (bypass EC2 API lookup) for no benefit given the existing instance ID path already works.

---

## Decision 2: What the Docker wizard collects (vs React wizard)

| Prompt | React wizard | Docker wizard |
|---|---|---|
| Project type | ✓ | ✓ |
| Repo URL | ✓ | ✗ (not needed) |
| Branch | ✓ | ✗ (not needed) |
| VCS provider | ✓ | ✗ (not needed) |
| VCS token | ✓ | ✗ (not needed) |
| Cloud platform | ✓ | ✓ |
| Service type | ✓ | ✓ |
| AWS region | ✓ | ✓ |
| Environment | ✓ | ✓ |
| EC2 instance ID | ✓ | ✓ |
| AWS access key | ✓ | ✓ |
| AWS secret key | ✓ | ✓ |
| SSH key mode | ✓ | ✓ |
| SSH key value | ✓ | ✓ |
| SSH username | ✓ | ✓ |
| Deploy directory | ✓ (removing) | ✗ (never needed) |
| Dockerfile path | ✗ | ✓ (new) |

**Rationale**: Docker deployments use the same EC2 infrastructure. The only differences are: Dockerfile path replaces VCS details, and no deploy directory is needed (Docker manages its own container root).

---

## Decision 3: Dockerfile path validation in wizard

**Decision**: Validate that the Dockerfile path exists on disk using `existsSync` inside the `validate` callback of the `clack.text` prompt. This gives inline feedback without exiting the wizard.

**Rationale**: Consistent with how `required` validation works in the existing wizard. Catches the error at the earliest possible moment.

---

## Decision 4: Deploy directory removal from React wizard

**Decision**: Remove the `clack.text` prompt for deploy directory entirely. Hardcode `'/var/www/html'` in `cspCredentials.deployDir` during request assembly — this is already the default in `ReactAppOrchestration.buildSteps`.

**Rationale**: The default is universally correct for wizard-initiated React deployments. The config-file path (`megalodon_EC2_DEPLOY_DIR` env var) remains available for non-wizard users who need a custom directory.

---

## Decision 5: Port is fixed at 80

**Decision**: No port prompt. `DockerOrchestration` already hardcodes `-p 80:80`. No change required.

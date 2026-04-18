# Data Model: Single Image Docker EC2 Deployment

**Feature**: `006-docker-ec2-deploy`  
**Phase**: 1 — Design  
**Date**: 2026-04-18

---

## Changes to Existing Models

### `BuildConfig` (src/models/DeploymentRequest.ts)

Two new optional fields. All existing fields are unchanged.

```
BuildConfig
├── buildScript?    : string                  — existing
├── outputDir?      : string                  — existing
├── env?            : Record<string, string>  — existing
├── dockerfilePath? : string                  — NEW: absolute or relative path to the Dockerfile
└── containerPort?  : number                  — NEW: port the container listens on; also mapped to the EC2 host port
```

**Validation rules** (enforced in `ShippingEngine.run` before pipeline execution):
- When `project.type === Docker`, `dockerfilePath` MUST be present and the file MUST exist on disk.
- When `project.type === Docker`, `containerPort` MUST be a positive integer in range 1–65535.
- Both fields are ignored when `project.type !== Docker`.

---

## No Changes to `Pipeline`

`Pipeline` is NOT modified. The Docker Package step writes `artifact.tar.gz` to the process working directory (the temp `sourceDir`) exactly like every other orchestration. `LocalPipelineExecutor` picks it up at `join(context.sourceDir, 'artifact.tar.gz')` with zero changes.

---

## VCS Bypass in `ShippingEngine`

For Docker deployments, VCS fetch is skipped. `ShippingEngine.run` branches on project type:

```
project.type === Docker && buildConfig.dockerfilePath is set
  → create empty temp dir as sourceDir (mkdtempSync)
  → skip fetchSource entirely
  → skip VCS credential validation

otherwise
  → existing fetchSource flow unchanged
```

This keeps `DeploymentRequest.vcsConfig` structurally present but unused for Docker, avoiding changes to the type system.

---

## New File: `DockerOrchestration`

Location: `src/engines/orchestrations/DockerOrchestration.ts`

Implements `IPipelineOrchestration`. Receives `buildConfig` (containing `dockerfilePath` and `containerPort`) and generates the following ordered steps:

| # | Step ID         | Name                    | StepType | Runs On   | Command (schematic) |
|---|-----------------|-------------------------|----------|-----------|---------------------|
| 1 | `docker-build`  | Build Docker image      | Build    | Local     | `docker build -t carburetor-docker-image -f <abs-dockerfile-path> <abs-context-dir>` |
| 2 | `docker-export` | Export image to archive | Package  | Local     | `docker save carburetor-docker-image \| gzip > artifact.tar.gz` |
| 3 | `docker-load`   | Load image on EC2       | Ship     | EC2 (SSH) | `docker load < /tmp/carburetor-artifact.tar.gz` |
| 4 | `docker-stop`   | Stop existing container | Ship     | EC2 (SSH) | `docker rm -f carburetor-app 2>/dev/null \|\| true` |
| 5 | `docker-run`    | Start container         | Ship     | EC2 (SSH) | `docker run -d --restart unless-stopped -p <port>:<port> --name carburetor-app carburetor-docker-image` |

**Notes on step commands**:
- Step 1: `<abs-dockerfile-path>` = `path.resolve(buildConfig.dockerfilePath)`. `<abs-context-dir>` = `path.dirname` of the same resolved path. Using absolute paths means the step executes correctly regardless of CWD.
- Step 2: Writes `artifact.tar.gz` to CWD (= temp `sourceDir`). This matches the existing artifact convention — `LocalPipelineExecutor` finds it at `join(sourceDir, 'artifact.tar.gz')`.
- Steps 3–5: Ship steps; `CSPAccess.deployToEC2` SCPs the artifact and then runs these via SSH in order.
- Step 4 always exits 0 (`|| true`) — no container running on first deploy is not an error.

---

## State Transitions

```
User invokes deploy --dockerfile <path> --port <port>
         │
         ▼
[Validate: dockerfilePath exists, containerPort in range]
         │ fail → Error reported; no pipeline run
         │ pass
         ▼
[Build Docker image locally] ──fail──► Error: build failed; stop
         │ pass
         ▼
[Export image to artifact.tar.gz (in temp dir)] ──fail──► Error: save failed; stop
         │ pass
         ▼
[SCP artifact to EC2 /tmp/carburetor-artifact.tar.gz] ──fail──► Error: transfer failed; stop
         │ pass
         ▼
[SSH: docker load] ──fail──► Error: load failed; stop
         │ pass
         ▼
[SSH: docker rm -f carburetor-app || true] — always continues
         │
         ▼
[SSH: docker run -d -p PORT:PORT] ──fail──► Error: run failed; stop
         │ pass
         ▼
Report endpoint: http://<ec2-public-dns>:<port>
```

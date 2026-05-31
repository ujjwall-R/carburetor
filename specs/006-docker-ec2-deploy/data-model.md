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

| # | Step ID            | Name                    | StepType | Runs On   | Command (schematic) |
|---|--------------------|-------------------------|----------|-----------|---------------------|
| 1 | `docker-copy`      | Prepare Dockerfile      | Build    | Local     | `cp <abs-dockerfile-path> artifact.tar.gz` |
| 2 | `docker-install`   | Install Docker on EC2   | Ship     | EC2 (SSH) | Idempotent: skips if `docker` already present; installs via yum or apt-get, starts daemon |
| 3 | `docker-build`     | Build Docker image on EC2 | Ship   | EC2 (SSH) | `sudo mkdir -p /tmp/carburetor-ctx && sudo docker build --no-cache -t carburetor-docker-image -f /tmp/carburetor-artifact.tar.gz /tmp/carburetor-ctx` |
| 4 | `docker-stop`      | Free port and remove old container | Ship | EC2 (SSH) | `sudo systemctl stop nginx 2>/dev/null \|\| true && sudo docker rm -f carburetor-app 2>/dev/null \|\| true` |
| 5 | `certbot-install`* | Install Certbot         | Ship     | EC2 (SSH) | Idempotent: installs certbot via pip if not present *(SSL only)* |
| 6 | `certbot-run`*     | Obtain SSL certificate  | Ship     | EC2 (SSH) | `certbot certonly --standalone -d <domain>` — skipped if cert already exists *(SSL only)* |
| 7 | `docker-run`       | Start container         | Ship     | EC2 (SSH) | Non-SSL: `docker run -d --restart unless-stopped -p <port>:<port> --name carburetor-app carburetor-docker-image`; SSL: same with `-p 80:80 -p 443:443 -v /etc/letsencrypt:/etc/letsencrypt:ro` |

\* Steps 5–6 are only included when `buildConfig.domain` and `buildConfig.sslEmail` are both set.

**Notes on step commands**:
- Step 1: The Dockerfile is copied to `artifact.tar.gz` locally, then SCPed to `/tmp/carburetor-artifact.tar.gz` on EC2 by `CSPAccess`.
- Step 2: Idempotent Docker install — uses `command -v docker` guard; supports both yum (Amazon Linux) and apt-get (Ubuntu/Debian).
- Step 3: The image is built on EC2 from the transferred Dockerfile. `--no-cache` ensures a clean build every deploy.
- Step 4: Stops nginx (to free port 80 if nginx is running) and removes the old container — always exits 0 (`|| true`), safe on first deploy.
- Step 7: `<port>` defaults to `containerPort ?? 80`. SSL mode always binds 80 and 443 regardless of `containerPort`.

---

## State Transitions

```
User invokes deploy --dockerfile <path>
         │
         ▼
[Validate: dockerfilePath exists]
         │ fail → Error reported; no pipeline run
         │ pass
         ▼
[Local: cp Dockerfile → artifact.tar.gz]
         │
         ▼
[SCP artifact to EC2 /tmp/carburetor-artifact.tar.gz] ──fail──► Error: transfer failed; stop
         │ pass
         ▼
[SSH: docker-install — idempotent] ──fail──► Error: install failed; stop
         │ pass
         ▼
[SSH: docker build --no-cache on EC2] ──fail──► Error: build failed; stop
         │ pass
         ▼
[SSH: stop nginx + docker rm -f carburetor-app || true] — always continues
         │
         ▼
[SSH: certbot-install + certbot-run] *(SSL only)* ──fail──► Error: certbot failed; stop
         │ pass (or skipped if no SSL)
         ▼
[SSH: docker run -d --restart unless-stopped -p PORT:PORT] ──fail──► Error: run failed; stop
         │ pass
         ▼
Report endpoint: http://<ec2-public-dns>:<port>
```

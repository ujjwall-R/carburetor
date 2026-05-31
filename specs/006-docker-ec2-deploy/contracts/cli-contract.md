# CLI Contract: Docker EC2 Deploy

**Feature**: `006-docker-ec2-deploy`  
**Command**: "`meg deploy`"  
**Date**: 2026-04-18

---

## New Flags Added to `deploy` Command

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--dockerfile <path>` | string | Conditional | Path to the Dockerfile. When provided, forces project type to `docker` and enables the Docker pipeline. |
| `--port <number>` | integer | Conditional | Port the container listens on; also bound as the EC2 host port. Required when `--dockerfile` is set. |

Both flags are optional at the parser level. If `--dockerfile` is set but `--port` is absent, the CLI exits with a validation error before any remote operation.

---

## Invocation Examples

**Minimal Docker deploy** (EC2 target configured in `megalodon.yml`):
```
meg deploy --dockerfile ./Dockerfile --port 3000
```

**Docker deploy with explicit config file**:
```
meg deploy -c ./my-megalodon.yml --dockerfile ./services/api/Dockerfile --port 8080
```

**Dry run**:
```
meg deploy --dockerfile ./Dockerfile --port 3000 --dry-run
```

---

## Config File (`megalodon.yml`) — Docker Fields

Alternatively, Dockerfile path and port can be specified in the config file instead of CLI flags. CLI flags take precedence over config file values.

```yaml
project:
  type: docker
  build:
    dockerfilePath: ./Dockerfile   # relative to config file location
    containerPort: 3000

target:
  platform: aws
  region: us-east-1
  environment: production
  resourceId: i-0123456789abcdef0   # EC2 instance ID

# vcs section is not required for docker deployments
```

---

## Required `megalodon.yml` Fields for Docker EC2 Deploy

| Field | Description |
|-------|-------------|
| `target.platform` | Must be `aws` |
| `target.region` | AWS region of the EC2 instance |
| `target.resourceId` | EC2 instance ID (must start with `i-`) |
| `project.build.dockerfilePath` | Path to Dockerfile (or via `--dockerfile` flag) |
| `project.build.containerPort` | Container/host port (or via `--port` flag) |

---

## Required Environment Variables for Docker EC2 Deploy

| Variable | Description |
|----------|-------------|
| `megalodon_AWS_ACCESS_KEY_ID` | AWS access key for EC2 instance lookup |
| `megalodon_AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `megalodon_EC2_SSH_KEY` | PEM key content (inline), **OR** |
| `megalodon_EC2_SSH_KEY_PATH` | Path to PEM key file (one of the two SSH key vars is required) |
| `megalodon_EC2_SSH_USER` | SSH username (default: `ec2-user`) |

VCS environment variables (`megalodon_VCS_TOKEN`, etc.) are **not required** for Docker deployments.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Deploy completed successfully |
| `1` | Configuration or validation error (before pipeline runs) |
| `2` | Pipeline step failed (during build, transfer, or container start) |

---

## Output (default human-readable)

```
→ [Build Docker image] $ docker build -t megalodon-docker-image -f /abs/Dockerfile /abs/context
✓ Build Docker image (12340ms)
→ [Export image to archive] $ docker save megalodon-docker-image | gzip > artifact.tar.gz
✓ Export image to archive (3210ms)

✓ Deployed successfully
  Endpoint: http://ec2-12-34-56-78.compute-1.amazonaws.com:3000
  Total time: 47.2s
```

## Output (`--json`)

```jsonl
{"type":"outcome","status":"completed","endpoint":"http://ec2-12-34-56-78.compute-1.amazonaws.com:3000","trackingUrl":null,"error":null,"totalDurationMs":47200}
```

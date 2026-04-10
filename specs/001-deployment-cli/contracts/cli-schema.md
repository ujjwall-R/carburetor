# CLI Contract: `carborator`

**Feature**: `001-deployment-cli`  
**Phase**: 1 — Design  
**Date**: 2026-04-11

This document defines the public contract for the `carborator` CLI tool — the interface the `DeployCLI` client exposes to users and CI systems.

---

## Command Structure

```
carborator <command> [options]
```

---

## Commands

### `carborator deploy`

Deploy an application to a cloud platform.

```
carborator deploy [options]

Options:
  -c, --config <path>      Path to carborator.yml (default: ./carborator.yml)
  -t, --target <platform>  Override target platform: aws | gcp | azure | lambda
  -e, --env <name>         Override environment: production | staging | preview
      --dry-run            Validate config and credentials without deploying
      --json               Emit newline-delimited JSON events (for CI/log aggregators)
  -v, --verbose            Show full command output for each step
  -h, --help               Show help
```

**Exit codes**:

| Code | Meaning |
|------|---------|
| 0 | Deployment succeeded |
| 1 | Configuration or credential validation failed |
| 2 | Deployment pipeline failed (step-level error) |
| 3 | Unexpected runtime error |

---

### `carborator validate`

Validate `carborator.yml` and cloud credentials without deploying.

```
carborator validate [options]

Options:
  -c, --config <path>   Path to carborator.yml (default: ./carborator.yml)
  -h, --help            Show help
```

---

### `carborator version`

Print the installed version.

```
carborator version
```

---

## Standard Output Contract

### Human-readable (default TTY mode)

```
Carborator v1.0.0

[1/5] Validating credentials...           ✓  (0.3s)
[2/5] Fetching source from GitHub...      ✓  (4.1s)
[3/5] Detecting project type...           ✓  React application
[4/5] Building application...             ✓  (45.2s)
[5/5] Shipping to AWS (us-east-1)...      ✓  (12.7s)

✓ Deployed successfully
  Endpoint: https://my-app.example.com
  Total time: 62.3s
```

On failure:

```
[1/5] Validating credentials...           ✓  (0.3s)
[2/5] Fetching source from GitHub...      ✗  Failed

Error: Repository not found or access denied
  → Check that CARBORATOR_VCS_TOKEN is set and has 'repo' scope
  → Repo: https://github.com/org/repo

Exit code: 1
```

### JSON mode (`--json`)

One JSON object per line (newline-delimited JSON / NDJSON):

```jsonc
// Step event
{ "type": "step", "step": 1, "total": 5, "name": "Validating credentials", "status": "started" }
{ "type": "step", "step": 1, "total": 5, "name": "Validating credentials", "status": "completed", "durationMs": 312 }

// Step failure
{ "type": "step", "step": 2, "total": 5, "name": "Fetching source", "status": "failed", "error": "Repository not found", "durationMs": 201 }

// Final outcome
{ "type": "outcome", "status": "success", "endpoint": "https://my-app.example.com", "totalDurationMs": 62300 }
{ "type": "outcome", "status": "failed", "failedStep": "Fetching source", "error": "Repository not found", "totalDurationMs": 513 }
```

---

## Configuration File Contract (`carborator.yml`)

```yaml
# All fields unless marked optional are required

project:
  type: react                    # react | node | docker | custom
  build:                         # optional block
    script: "npm run build"      # optional — overrides default build command
    outputDir: "dist"            # optional — overrides default output directory
    env:                         # optional — merged with process env at build time
      NODE_ENV: production

target:
  platform: aws                  # aws | gcp | azure | lambda
  region: us-east-1              # cloud-provider region string
  environment: production        # logical environment name (any string)
  resourceId: my-instance-id     # cloud resource identifier

vcs:
  provider: github               # github | gitlab | bitbucket
  repoUrl: "https://github.com/org/repo"
  branch: main
  ref: ""                        # optional — specific commit SHA or tag
```

**Credential environment variables** (never in config file):

| Platform | Variable | Description |
|----------|----------|-------------|
| All VCS | `CARBORATOR_VCS_TOKEN` | Personal access token |
| AWS | `AWS_ACCESS_KEY_ID` | AWS access key |
| AWS | `AWS_SECRET_ACCESS_KEY` | AWS secret |
| AWS | `AWS_SESSION_TOKEN` | Optional session token |
| GCP | `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON |
| Azure | `AZURE_CLIENT_ID` | Service principal client ID |
| Azure | `AZURE_CLIENT_SECRET` | Service principal secret |
| Azure | `AZURE_TENANT_ID` | Azure tenant ID |
| Azure | `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

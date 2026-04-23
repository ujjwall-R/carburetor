# Quickstart: Deployment CLI Tool

**Feature**: `001-deployment-cli`  
**Date**: 2026-04-11

---

## Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- Cloud credentials available as environment variables (see below)
- A `carburetor.yml` at your project root

---

## Install

```bash
# From source
git clone <repo>
cd carburetor
bun install
bun build --compile --outfile carburetor src/index.ts

# Add to PATH
mv carburetor /usr/local/bin/carburetor
```

---

## Setup: `carburetor.yml`

Place this at your project root:

```yaml
project:
  type: react

target:
  platform: aws
  region: us-east-1
  environment: production
  resourceId: i-0abc123def456

vcs:
  provider: github
  repoUrl: "https://github.com/your-org/your-app"
  branch: main
```

---

## Set credentials

```bash
export carburetor_VCS_TOKEN=ghp_xxxx
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

---

## Deploy

```bash
# Validate without deploying first
carburetor validate

# Deploy
carburetor deploy

# Deploy to a specific environment
carburetor deploy --env staging

# Watch full step output
carburetor deploy --verbose
```

---

## Development

```bash
# Run in dev mode (no compile step needed — Bun runs TS directly)
bun run src/index.ts deploy

# Run tests
bun test

# Build binary
bun build --compile --outfile carburetor src/index.ts
```

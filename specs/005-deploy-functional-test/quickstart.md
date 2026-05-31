# Quickstart: Functional Deployment Test

**Feature**: `005-deploy-functional-test`  
**Date**: 2026-04-18

---

## Prerequisites

1. `megalodon.yml` at repo root with a valid React app target
2. `.env` at repo root with real credentials (never commit this)

Minimum `.env` for an AWS EC2 target:
```
megalodon_VCS_TOKEN=ghp_...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
megalodon_EC2_SSH_KEY_PATH=~/.ssh/your-key.pem
```

---

## Run the functional test

```bash
bun test tests/functional/
```

The test has a 2-minute timeout. It performs a real git clone, npm build, and cloud deploy.

---

## Skip in CI

The test requires live credentials and infrastructure. Exclude it from CI runs that don't have secrets configured:

```bash
# Run only unit tests in CI
bun test tests/unit/
```

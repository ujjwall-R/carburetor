# Contract: Root `megalodon.yml` + `.env`

**Feature**: `005-deploy-functional-test`  
**Date**: 2026-04-18

---

## `megalodon.yml` (repo root)

The functional test reads this file directly — no copy or fixture. It must be a valid Megalodon config. See `megalodon.example.yml` for the full schema.

Minimum fields required for the test to reach the deployment step:

| Field | Example |
|-------|---------|
| `project.type` | `react` |
| `target.platform` | `aws` |
| `target.region` | `eu-north-1` |
| `target.resourceId` | `i-0b55c2ab36a972c56` |
| `vcs.provider` | `github` |
| `vcs.repoUrl` | `https://github.com/org/repo` |
| `vcs.branch` | `main` |

---

## `.env` (repo root)

Loaded automatically by Bun. Never committed to the repository.

Required variables depend on `target.platform` in `megalodon.yml`:

| Variable | Required for |
|----------|-------------|
| `megalodon_VCS_TOKEN` | All platforms |
| `AWS_ACCESS_KEY_ID` | aws, lambda |
| `AWS_SECRET_ACCESS_KEY` | aws, lambda |
| `megalodon_EC2_SSH_KEY` or `megalodon_EC2_SSH_KEY_PATH` | EC2 targets |
| `GOOGLE_APPLICATION_CREDENTIALS` | gcp |
| `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` + `AZURE_TENANT_ID` + `AZURE_SUBSCRIPTION_ID` | azure |

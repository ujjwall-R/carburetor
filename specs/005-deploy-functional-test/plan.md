# Implementation Plan: Functional Deployment Test (YAML Config + React App)

**Branch**: `005-deploy-functional-test` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)

## Summary

Add a single functional test that runs the full deployment pipeline against real infrastructure using the repo's root `megalodon.yml` and `.env`. No production code changes. No fixtures or test helpers needed — Bun loads `.env` automatically.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode)  
**Primary Dependencies**: `bun:test` (existing) — no new dependencies  
**Storage**: N/A  
**Testing**: `bun:test`  
**Target Platform**: Bun runtime  
**Project Type**: CLI tool  
**Constraints**: Test requires real credentials and a live cloud target; not suitable for CI without secrets

## Constitution Check

| Rule | Status |
|------|--------|
| No production code changes | PASS — test file only |
| Client must not call Engines directly | PASS — test is not a client layer |
| Layer boundaries unchanged | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/005-deploy-functional-test/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── yaml-config-contract.md
└── tasks.md
```

### Source Code

```text
tests/
  functional/
    deploy-yml-react.test.ts   ← NEW: one functional test

megalodon.yml                 ← existing (used as-is, not modified)
.env                           ← existing (loaded by Bun automatically)
```

No changes to `src/`.

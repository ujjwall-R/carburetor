# Implementation Plan: Docker CLI and Wizard Integration

**Branch**: `ujjwal/baseSetup` | **Date**: 2026-04-19 | **Spec**: [spec.md](spec.md)

## Summary

Add Docker Single Container as a project type in the interactive wizard, collecting the same EC2/AWS/SSH details already gathered for React deployments plus a Dockerfile path. Remove the deploy-directory prompt from the React wizard path. No engine, access layer, model, or CLI flag changes — all work is in `WizardSession.ts`, `prompts.ts`, and the corresponding test file.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode)  
**Primary Dependencies**: `@clack/prompts` (wizard), `commander` (CLI — unchanged)  
**Storage**: N/A — stateless per invocation  
**Testing**: `bun:test`  
**Target Platform**: macOS / Linux (compiled single binary via `bun build --compile`)  
**Project Type**: CLI tool  
**Constraints**: No new dependencies; no access/engine/model changes  
**Scale/Scope**: 2 source files modified, 1 test file updated

## Constitution Check

| Rule | Status |
|---|---|
| Client calls Manager only | PASS — `DeployCLI` unchanged |
| Engines never call each other | PASS — no engine changes |
| ResourceAccess services never call each other | PASS — no access layer changes |
| Volatility-based decomposition | PASS — wizard prompts are Client layer; Docker vs React branching is a client-layer concern |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-docker-cli-wizard-integration/
├── plan.md              ← this file
├── spec.md              ✓
├── research.md          ✓
├── data-model.md        ✓
├── quickstart.md        ✓
├── contracts/
│   └── cli-contract.md  ✓
└── tasks.md             ✓
```

### Source Code (affected files only)

```text
src/
└── client/
    └── wizard/
        ├── WizardSession.ts    ← add Docker branch; remove deployDir from React path
        └── prompts.ts          ← add Docker to PROJECT_TYPE_OPTIONS

tests/
└── unit/
    └── client/
        └── wizard/
            └── WizardSession.test.ts  ← update React fixtures; add Docker test
```

## Design

### `prompts.ts` change

Add `{ value: ProjectType.Docker, label: 'Docker Container' }` to `PROJECT_TYPE_OPTIONS` after the `ReactApp` entry.

### `WizardSession.ts` — Docker branch

After the project type `select`, add `if (projectType === ProjectType.Docker)` block. Collect:
1. Dockerfile path — `clack.text` with `existsSync` validation
2. Cloud platform — existing `CLOUD_PLATFORM_OPTIONS` select
3. Service type — existing `AWS_SERVICE_OPTIONS` select  
4. Region, environment, instance ID — same `clack.text` prompts as React
5. AWS access key + secret key — same `clack.password` prompts as React
6. SSH key mode — same `clack.select` (inline/path)
7. SSH key value — same `clack.password`/`clack.text` as React
8. SSH user — same `clack.text` as React
9. Confirmation summary — include Dockerfile path; exclude deploy dir and VCS details
10. Assemble `DeploymentRequest` with `project.type = Docker`, `buildConfig.dockerfilePath`, stubs for `vcsConfig`/`vcsCredentials`, no `deployDir` in `cspCredentials`

### `WizardSession.ts` — React path change

Remove the `deployDir` `clack.text` prompt (currently between SSH user and the confirmation summary). Remove `deployDir` from the summary note and from `cspCredentials` assembly.

### Test fixture update

- Remove `'/var/www/app'` from `HAPPY_INPUTS` (was index 15) and the matching `textValues` entry
- Remove trailing deploy-dir entry from SSH-path-variant test
- Add new Docker happy-path describe block with its own select/text/password sequences

# Implementation Plan: Interactive Deployment Wizard

**Branch**: `004-interactive-wizard` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)

## Summary

Add `--interactive` flag to `carborator deploy`. When present, a `WizardSession` in the Client layer prompts the user through project type, VCS, cloud platform, service, and all credentials step-by-step using `@clack/prompts`. The wizard assembles a `DeploymentRequest` and hands it to `IDeploymentManager.deploy` (or `.validate` for dry-run). Manager and Engine layers are untouched.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode)
**Runtime / Package Manager**: Bun
**Primary Dependencies**: `commander` (existing), `@clack/prompts` ^1.0.0 (new — zero transitive deps after leaves, Bun compile compatible, pin Bun ≥ 1.3.3)
**Storage**: N/A — wizard session is in-memory only; no persistence
**Testing**: `bun:test` — unit tests on `WizardSession` using mocked `@clack/prompts`
**Target Platform**: CLI binary (`bun build --compile`)
**Project Type**: CLI tool
**Performance Goals**: Wizard prompt response is synchronous on user input; no latency concern
**Constraints**: Manager and Engine source files MUST show zero diff (SC-004). All menu option constants MUST live in `src/client/wizard/prompts.ts` (SC-003).

## Constitution Check

*GATE: Must pass before proceeding to implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Client must not call Engines directly | PASS | Wizard calls only `IDeploymentManager`; no engine reference introduced |
| Client must not call multiple Managers for one use case | PASS | Single Manager call (`deploy` or `validate`) at end of wizard |
| All wizard UX choice logic in Client layer | PASS | `WizardSession` + `prompts.ts` are both in `src/client/wizard/` |
| Manager naming: `<NounOfVolatility>Manager` | PASS | No new managers |
| Engine naming: `<Gerund>Engine` | PASS | No new engines |
| Manager:Engine ratio | PASS | Unchanged; 1:2 |
| Engines never call each other | PASS | Unchanged |
| ResourceAccess never calls each other | PASS | Unchanged |

No violations. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-interactive-wizard/
├── plan.md                          ← this file
├── research.md                      ← Phase 0 complete
├── data-model.md                    ← Phase 1 complete
├── contracts/
│   └── wizard-interaction.md        ← Phase 1 complete
└── tasks.md                         ← Phase 2 output (/speckit.tasks)
```

### Source Code (files added or modified)

```text
src/
├── client/
│   ├── DeployCLI.ts                 ← modified: add --interactive flag; branch to WizardSession
│   └── wizard/
│       ├── WizardSession.ts         ← NEW: orchestrates full prompt sequence; returns DeploymentRequest
│       └── prompts.ts               ← NEW: hardcoded menu option arrays (the volatile choice lists)

tests/
└── unit/
    └── client/
        └── wizard/
            └── WizardSession.test.ts  ← NEW: unit tests with mocked @clack/prompts

package.json                           ← modified: add @clack/prompts dependency
```

**No changes to**: `src/managers/`, `src/engines/`, `src/access/`, `src/models/`, `src/index.ts`

## Implementation Steps

### Step 1 — Install `@clack/prompts`

```bash
bun add @clack/prompts
```

---

### Step 2 — Create `src/client/wizard/prompts.ts`

Exports four typed constant arrays — the only file to edit when new options are added:

```typescript
import { ProjectType, VCSProvider, CloudPlatform } from '../../models/enums.js';

export const PROJECT_TYPE_OPTIONS = [
  { value: ProjectType.ReactApp, label: 'React App' },
  { value: ProjectType.Custom,   label: 'Other (experimental)' },
] as const;

export const VCS_PROVIDER_OPTIONS = [
  { value: VCSProvider.GitHub, label: 'GitHub' },
] as const;

export const CLOUD_PLATFORM_OPTIONS = [
  { value: CloudPlatform.AWS, label: 'AWS' },
] as const;

export const AWS_SERVICE_OPTIONS = [
  { value: 'ec2', label: 'EC2 Instance' },
] as const;
```

---

### Step 3 — Create `src/client/wizard/WizardSession.ts`

Class with a single public method `run(dryRun: boolean, verbose: boolean): Promise<DeploymentRequest>`.

Internally calls `@clack/prompts` in the exact sequence defined in `contracts/wizard-interaction.md` (Steps 1–17). After every prompt result, checks `isCancel(result)` and exits cleanly if true. Validates non-empty on text/password fields using the `validate` option of `clack.text()`. Assembles and returns `DeploymentRequest` on confirmation.

Key implementation points:
- Import only from `@clack/prompts` and `../../models/` — never from managers or engines
- `password()` for: VCS token, AWS secret key, SSH key (inline)
- `text()` with `validate: (v) => v.length === 0 ? 'This field is required.' : undefined` for all text fields
- Three-attempt counter tracked per field; on third failure call `cancel()` + `process.exit(1)`
- Confirmation summary (Step 17) prints all non-secret selections via `clack.note()`; then `clack.confirm()`

---

### Step 4 — Modify `src/client/DeployCLI.ts`

Two changes only:

**a) Extend `CLIArgs`**:
```typescript
interface CLIArgs {
  config: string;
  interactive: boolean;   // ← new
  target?: string;
  env?: string;
  dryRun: boolean;
  verbose: boolean;
  json: boolean;
}
```

**b) Add `--interactive` option to the `deploy` command**:
```typescript
.option('-i, --interactive', 'Launch interactive setup wizard', false)
```

**c) Branch at the top of `runDeploy`**:
```typescript
if (args.interactive) {
  if (args.config !== './carborator.yml') {
    process.stderr.write('Warning: --interactive ignored when --config is provided. Using config file.\n');
  } else {
    const { WizardSession } = await import('./wizard/WizardSession.js');
    const session = new WizardSession();
    const request = await session.run(args.dryRun, args.verbose);
    // identical handling from here: dryRun branch or deploy branch
    await this.executeRequest(request, args);
    return;
  }
}
// existing file-based path unchanged below
```

Refactor the shared deploy execution tail (dry-run check + `manager.deploy` + `renderOutcome`) into a private `executeRequest(request, args)` method to avoid duplication between the wizard and file-based paths.

---

### Step 5 — Add unit tests

**File**: `tests/unit/client/wizard/WizardSession.test.ts`

Mock `@clack/prompts` module to return predetermined values. Test:
- Happy path: all prompts answered → correct `DeploymentRequest` assembled
- Cancel at first prompt → `process.exit(1)` called
- Empty field → validation message returned (re-prompt)
- SSH inline vs path key choice produces correct credential fields

---

## Verification Checklist

- [ ] `grep -r "IShippingEngine\|IOrchestratingEngine\|ShippingEngine\|OrchestratingEngine" src/client/` returns zero results
- [ ] `git diff --name-only HEAD | grep -E "src/(managers|engines|access)/"` returns zero files
- [ ] `bun test` passes (all existing + new tests)
- [ ] `carborator deploy --interactive` starts wizard without `carborator.yml` present
- [ ] `carborator deploy --interactive --dry-run` runs wizard then validation only
- [ ] `carborator deploy --interactive --config ./carborator.yml` prints warning and uses file
- [ ] Ctrl-C mid-wizard exits with code 1 and "Wizard cancelled." message

# Research: Interactive Deployment Wizard

**Phase 0 output** | All findings from dependency analysis and codebase inspection.

## Decision 1: Interactive prompt library

**Decision**: Use `@clack/prompts` v1.x.

**Rationale**:
- 6 total packages (all zero-dependency leaves); far lighter than `@inquirer/prompts` (10+ packages, documented Bun `AsyncResource` incompatibilities that cause silent no-output bugs — GitHub issues #4787, #3205).
- Pure ESM, TypeScript-native (ships `.d.ts`).
- `bun build --compile` confirmed working; the 1.3.2 stdin EPERM regression is resolved (Bun ≥ 1.3.3, clack#170 closed).
- First-class exports for all four required prompt types: `select`, `text`, `password`, `confirm`.
- Provides `isCancel()` helper and `cancel()` utility for clean Ctrl-C handling — directly satisfies FR-010.

**Alternatives considered**:
- `@inquirer/prompts` — rejected; documented Bun incompatibilities.
- `prompts` — rejected; CJS-only, stale (last published 2022).
- Node.js `readline` — rejected; would require hand-rolling select, confirm, and masked input from scratch.

**Pin requirement**: Bun ≥ 1.3.3 in CI and release docs.

## Decision 2: Wizard placement in source tree

**Decision**: New `src/client/wizard/` subdirectory with two files:
- `WizardSession.ts` — orchestrates the full prompt sequence; returns a `DeploymentRequest`.
- `prompts.ts` — exports the hardcoded menu option arrays (project types, VCS providers, platforms, services); this is the single file where all volatile choice lists live.

**Rationale**: Keeps all interactive UX code inside the Client layer as required by FR-011 and SC-003. The `WizardSession` class is a pure Client concern: it prompts, assembles, and returns — it never calls any Manager or Engine method. Separating menu option constants into `prompts.ts` makes future expansion (new project type, new cloud provider) a single-file edit with zero impact on Manager/Engine.

**Alternatives considered**: Adding wizard logic inline in `DeployCLI.ts` — rejected; would bloat the class and mix routing concerns with UX concerns.

## Decision 3: How `DeployCLI.runDeploy` branches

**Decision**: Add `interactive: boolean` to `CLIArgs`. In `runDeploy`, check `args.interactive` first:
- If true AND `--config` was explicitly provided → print warning to stderr, fall through to file-based path.
- If true AND no explicit `--config` → instantiate `WizardSession`, await `session.run()`, which returns `DeploymentRequest`; skip `configLoader.load()` and `resolveVCSCredentials/resolveCSPCredentials`.
- Then proceed identically: dry-run branch calls `manager.validate(request)`, normal branch calls `manager.deploy(request)`.

**Rationale**: The branching is localized entirely to `DeployCLI.runDeploy`. The `manager` reference is already in scope; the wizard just produces the same `DeploymentRequest` shape that the config path produces. Manager and Engine are untouched.

**Detecting "explicit --config"**: Commander sets the default for `--config` to `'./carborator.yml'`. To distinguish "user passed --config" from "default used", we can check whether `commander` parsed the option as provided by inspecting `program.opts()` option source or simply set the interactive default to only activate wizard when `--config` was not explicitly set. Practical approach: if `args.interactive` is true, run wizard regardless; the wizard result fully replaces what `configLoader.load()` would have produced.

## Decision 4: Credential masking

**Decision**: Use `@clack/prompts`'s `password()` prompt for all secret fields (VCS token, AWS secret access key, SSH private key inline). Non-secret fields use `text()`.

**Rationale**: `password()` masks input with `•` characters and never echoes to stdout. This directly satisfies FR-006's "masked input" requirement and US2 AC4 ("never printed to the terminal in plain text").

## Decision 5: Ctrl-C / cancellation handling

**Decision**: Wrap the entire `WizardSession.run()` body in a check after each `@clack/prompts` call using `isCancel(value)`. On cancel, call `clack.cancel('Wizard cancelled.')`, then `process.exit(1)`.

**Rationale**: `@clack/prompts` returns a `Symbol` (the `cancel` symbol) when the user presses Ctrl-C. The `isCancel()` utility detects this. Checking after every prompt step ensures no partial state is passed to the deployment flow — satisfying FR-010 and the Ctrl-C edge case.

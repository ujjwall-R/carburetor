# carborator

Deploy applications to cloud platforms with a single command. Carborator handles cloning your source code, running the build pipeline, and shipping the artifact to the cloud — no manual steps.

```
carborator deploy
```

---

## Supported Platforms

| Dimension | Supported |
|-----------|-----------|
| **App types** | React, Node.js, Docker, Custom script |
| **Cloud platforms** | AWS (S3/EC2), GCP, Azure, Lambda |
| **VCS providers** | GitHub, GitLab |
| **Executors** | Local, Jenkins |

---

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- Node.js 20+ (fallback if Bun is unavailable)
- Git

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Installation

### Option 1 — Run from source

```bash
git clone https://github.com/your-org/carborator.git
cd carborator
bun install
```

Run directly:

```bash
bun run src/index.ts deploy
```

### Option 2 — Build a single binary

#### For your current platform only

```bash
bun run build
```

Produces a signed, ready-to-run `./carborator` binary in the project root.

Move it somewhere on your `$PATH`:

```bash
mv carborator /usr/local/bin/carborator
```

Then use it from anywhere:

```bash
carborator deploy
```

#### For all platforms (distribution)

```bash
bun run build:all
```

Produces binaries for every platform under `dist/`:

```
dist/
  macos-arm64/carborator
  macos-x64/carborator
  linux-arm64/carborator
  linux-x64/carborator
  windows-x64/carborator.exe
```

macOS binaries are automatically ad-hoc signed so Gatekeeper doesn't block them. Linux and Windows binaries require no signing. Ship the folder matching the customer's platform.

#### Releasing a new version

1. Bump the version in `package.json`:

```json
{
  "version": "1.2.0"
}
```

2. Rebuild the binaries:

```bash
bun run build:all
```

The version is read directly from `package.json` at build time — no other files need updating. Verify with:

```bash
./dist/macos-arm64/carborator --version
```

---

## Configuration

Copy the example config and fill in your values:

```bash
cp carborator.example.yml carborator.yml
```

`carborator.yml`:

```yaml
project:
  type: react                      # react | node | docker | custom
  build:
    # script: "npm run build:prod" # optional — overrides default build steps
    outputDir: dist                # optional — defaults per project type

target:
  platform: aws                    # aws | gcp | azure | lambda
  region: us-east-1
  environment: production
  resourceId: my-s3-bucket-name    # S3 bucket, instance ID, function name, etc.

vcs:
  provider: github                 # github | gitlab
  repoUrl: "https://github.com/your-org/your-repo"
  branch: main

executor:
  type: local                      # local | jenkins
```

> **Credentials are never stored in `carborator.yml`.** Set them as environment variables (see below).

---

## Credentials

### GitHub / GitLab

```bash
export CARBORATOR_VCS_TOKEN=ghp_your_token_here
```

### AWS

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...       # optional, for temporary credentials
```

### GCP

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Azure

```bash
export AZURE_CLIENT_ID=...
export AZURE_CLIENT_SECRET=...
export AZURE_TENANT_ID=...
export AZURE_SUBSCRIPTION_ID=...
```

---

## Usage

### Deploy

```bash
carborator deploy
```

Options:

```
-c, --config <path>       Path to carborator.yml (default: ./carborator.yml)
-i, --interactive         Launch interactive setup wizard (no config file needed)
-t, --target <platform>   Override target platform (aws|gcp|azure|lambda)
-e, --env <name>          Override environment name
    --dry-run             Validate config and credentials without deploying
    --json                Emit newline-delimited JSON events (for CI/scripting)
-v, --verbose             Show full step output
```

Examples:

```bash
# Deploy using default config
carborator deploy

# Interactive wizard — no carborator.yml needed
carborator deploy --interactive

# Interactive wizard + dry-run (validate credentials without deploying)
carborator deploy --interactive --dry-run

# Override platform at runtime
carborator deploy --target lambda

# Validate only — no deploy
carborator deploy --dry-run

# Use a custom config path
carborator deploy --config ./config/prod.yml

# JSON output for CI pipelines
carborator deploy --json
```

### Interactive Wizard (`--interactive`)

The wizard guides you through every deployment decision step by step — no `carborator.yml` required.
Run it when deploying to a new environment for the first time or for ad-hoc deployments.

```
┌  carborator — Interactive Deployment Wizard
│
◆  What type of project are you deploying?
│  ● React App  ○ Other (experimental)
│
◆  Repository URL        https://github.com/acme/my-app
◆  Branch to deploy      main
◆  Version control       ● GitHub
◆  GitHub Token          ••••••••••••••••••  (masked)
│
◆  Cloud platform        ● AWS
◆  Service type          ● EC2 Instance
◆  AWS region            us-east-1
◆  Environment           production
◆  EC2 Instance ID       i-0abc123def456
│
◆  AWS_ACCESS_KEY_ID     ••••••••••••••••••  (masked)
◆  AWS_SECRET_ACCESS_KEY ••••••••••••••••••  (masked)
◆  SSH key               ● Paste inline  ○ Path to file
◆  SSH username          ec2-user
◆  Deploy directory      /var/www/app
│
┌─── Deployment Summary ──────────────────
│  Project : react  │  Repo : acme/my-app
│  Cloud   : aws    │  Service : ec2
│  Region  : us-east-1  │  Env : production
└─────────────────────────────────────────
◆  Proceed with deployment?  Yes / No
```

- All secret fields are masked with `•` characters and never written to disk.
- Press **Ctrl-C** at any prompt to cancel without triggering a deployment.
- Combine with `--dry-run` to validate credentials before your first real deploy.

### Validate credentials

Check that your VCS and cloud credentials are valid before deploying:

```bash
carborator validate
```

```
Validating credentials...
✓ VCS credentials valid
✓ Cloud credentials valid

✓ All checks passed — ready to deploy.
```

### Print version

```bash
carborator version
```

---

## How it works

1. **Validate** — checks VCS and cloud credentials
2. **Plan** — detects project type (React, Node, Docker, or custom), builds a pipeline of steps
3. **Fetch** — clones the configured repo and branch into a temp directory
4. **Build** — runs the pipeline steps locally (install deps → build → package artifact)
5. **Ship** — uploads the artifact to the configured cloud platform
6. **Report** — prints the live endpoint URL on success

```
  → Validating credentials...
  → Building deployment pipeline...
  → Running 3 pipeline step(s) locally...

✓ Deployed successfully
  Endpoint: https://my-bucket.s3.us-east-1.amazonaws.com/deploys/1234/artifact.tar.gz
  Total time: 42.3s
```

---

## Testing

### Run all unit tests

```bash
bun test
```

Runs the full unit test suite across the Manager and Engine layers. Output lists each test name and a pass/fail count; exit code is `0` when all tests pass.

### Run a single test file

```bash
bun test tests/unit/engines/OrchestratingEngine.test.ts
```

### Watch mode (reruns on file save)

```bash
bun test --watch
```

### Generate a coverage report

```bash
bun run test:coverage
```

Prints a per-file coverage table and writes `coverage/lcov.info` for use with any lcov viewer:

```
File                                            | % Funcs | % Lines | Uncovered Line #s
src/engines/OrchestratingEngine.ts              |  100.00 |  100.00 |
src/engines/ShippingEngine.ts                   |  100.00 |  100.00 |
src/engines/executors/LocalPipelineExecutor.ts  |   66.67 |   89.61 | 86-93
src/managers/DeploymentManager.ts               |  100.00 |  100.00 |
```

### Enforce coverage thresholds (CI gate)

```bash
bun run test:coverage:check
```

Runs the suite, generates coverage, then verifies per-layer minimums:

| Layer | Line | Branch |
|-------|------|--------|
| `src/managers/` | ≥ 90% | ≥ 80% |
| `src/engines/` | ≥ 88% | ≥ 80% |
| Global | ≥ 85% | — |

Exits `0` with `✓ Coverage thresholds met` on pass. Exits `1` with a named error message on violation — use as a required CI step to block low-coverage merges.

### Test structure

```
tests/
├── helpers/
│   ├── fixtures.ts      ← shared test-data builders
│   └── mocks.ts         ← interface mock factories (bun:test)
└── unit/
    ├── client/
    │   └── wizard/
    │       └── WizardSession.test.ts
    ├── managers/
    │   └── DeploymentManager.test.ts
    ├── engines/
    │   ├── OrchestratingEngine.test.ts
    │   └── ShippingEngine.test.ts
    └── executors/
        └── LocalPipelineExecutor.test.ts
```

Unit tests mock all external I/O — no real VCS or cloud API calls are made.

---

## Development

```bash
# Install dependencies
bun install

# Run in dev mode (no build step)
bun run dev

# Type check
bunx tsc --noEmit

# Build binary
bun run build
```

---

## Project structure

```
src/
  client/         DeployCLI — commander-based CLI, argument parsing
  managers/       DeploymentManager — orchestrates the deploy flow
  engines/        OrchestratingEngine, ShippingEngine — business logic
    executors/    LocalPipelineExecutor, JenkinsPipelineExecutor
  access/         VCSAccess, CSPAccess — external resource adapters
  models/         TypeScript types and enums
  config/         ConfigLoader — reads and validates carborator.yml
  index.ts        Dependency injection wiring and entry point
```

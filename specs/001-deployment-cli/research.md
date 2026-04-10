# Research: Deployment CLI Tool

**Feature**: `001-deployment-cli`  
**Phase**: 0 — Research & Decisions  
**Date**: 2026-04-11

---

## Decision 1: CLI Parsing Library

**Decision**: Use `commander` (npm package)  
**Rationale**: De-facto standard for Node/Bun CLI tools. Handles subcommands, typed options, auto-generated `--help`. Minimal overhead, no runtime not covered by Bun's built-ins.  
**Alternatives considered**:
- `yargs` — heavier, more convention-over-config; overkill for a single `deploy` command
- Raw `process.argv` — fragile; not worth the manual parsing for option/flag handling
- `citty` — lighter but smaller ecosystem; `commander` is better documented

---

## Decision 2: Bun as Runtime and Build Tool

**Decision**: Bun (runtime + bundler + test runner)  
**Rationale**: Native TypeScript execution without a transpile step during development. `bun build --compile` produces a self-contained binary — ideal for a CLI tool users install and run without Node. Built-in test runner eliminates a test framework dependency.  
**Alternatives considered**:
- Node + `tsc` + `pkg` — three tools doing what Bun does in one
- Deno — smaller ecosystem; SDK compatibility with AWS/GCP/Azure SDKs less proven

---

## Decision 3: Cloud SDK Strategy

**Decision**: Official SDKs per platform, wrapped behind `ICSPAccess`  
**Rationale**: Official SDKs have the best API coverage, type definitions, and auth integrations (IAM, ADC, Managed Identity). The `CSPAccess` adapter layer means SDK upgrades or new platform additions don't leak into Engine code.  
**SDKs**:
- AWS: `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `@aws-sdk/client-elastic-beanstalk` (v3 modular)
- GCP: `@google-cloud/storage`, `@google-cloud/run`
- Azure: `@azure/storage-blob`, `@azure/arm-appservice`
**Alternatives considered**:
- Terraform/Pulumi SDK — infrastructure provisioning; out of scope for v1 (deploy-only, not provision)
- Generic REST calls — loses type safety and auth helpers

---

## Decision 4: VCS Integration Strategy

**Decision**: Git clone via `simple-git` + GitHub REST API for validation  
**Rationale**: `simple-git` wraps `git` CLI calls with a clean async API — handles private repos, SSH keys, and PATs uniformly. GitHub REST API used only for credential validation (one lightweight `GET /user` call before cloning).  
**Alternatives considered**:
- `@octokit/rest` — full GitHub API client; adds ~200KB for features we don't need in v1
- Raw `git` subprocess — works but no error structure; `simple-git` gives typed errors

---

## Decision 5: Dependency Injection Approach

**Decision**: Manual constructor injection — no DI framework  
**Rationale**: Only 6 classes in the component graph (see system diagram). A DI container (InversifyJS, tsyringe) adds ~10KB and requires decorator configuration. Manual wiring in `src/index.ts` is ~20 lines and keeps the code readable. Interfaces still enable test mocking.  
**Alternatives considered**:
- InversifyJS — good for large graphs; overkill here
- `tsyringe` — lighter but still requires `reflect-metadata` polyfill under Bun

---

## Decision 6: Configuration File Format

**Decision**: YAML (`carborator.yml`) parsed with `js-yaml`  
**Rationale**: YAML is human-friendly for multi-line deployment config (env vars, platform settings). `js-yaml` is well-maintained and small. JSON would work but is noisier for config files.  
**Alternatives considered**:
- TOML — equally readable but less tooling ecosystem on Node/Bun
- JSON — valid but verbose for config with nested sections
- HCL (Terraform-style) — overkill; users don't need full expression language

---

## Decision 7: Progress Reporting

**Decision**: Inline TTY output with step name + status indicator; structured JSON on `--json` flag  
**Rationale**: Developers want live feedback during a multi-minute deploy. TTY output shows `[1/5] Fetching source... ✓` style lines. For CI environments, `--json` emits newline-delimited JSON events that log aggregators can parse.  
**Alternatives considered**:
- Spinner libraries (`ora`) — nice UX but adds dependency; can implement minimal version natively
- Silent until completion — bad for long-running deploys (SC-001 requirement: visible progress)

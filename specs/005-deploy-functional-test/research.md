# Research: Functional Deployment Test (YAML Config + React App)

**Feature**: `005-deploy-functional-test`  
**Date**: 2026-04-18

---

## Decision 1: Scope — One Real Test, No Stubs

**Decision**: One test case, full real stack, no mocks or stubs at any layer.  
**Rationale**: A functional test that stubs the access layer doesn't prove the deployment works — it proves the business logic wires together. The value of this test is end-to-end confidence: real VCS fetch, real build, real cloud deploy.  
**Alternatives considered**: Stubbed `VCSAccess` + `CSPAccess` (was implemented first, then rejected by the user as not a real functional test).

---

## Decision 2: Config Source — Root `megalodon.yml`

**Decision**: Hardcode the path to `megalodon.yml` at the repo root.  
**Rationale**: The test validates the actual deployment configuration the developer uses. Using a copy/fixture would test a different config and miss integration issues. Hardcoding the path is intentional — this test is tied to the repo's real setup.  
**Alternatives considered**: A fixture YAML in `tests/fixtures/` — rejected because it would not validate the real config.

---

## Decision 3: Credential Loading — Bun's Automatic `.env`

**Decision**: No helper code for `.env` loading. Bun automatically loads the root `.env` at process startup, making all credentials available in `process.env` by the time the test runs.  
**Rationale**: Zero boilerplate, no test-only utilities. The same mechanism used when running `bun run src/index.ts` applies to `bun test`.  
**Alternatives considered**: An `applyEnvFile` helper (was implemented first, then removed when Bun's built-in loading was confirmed sufficient).

---

## Decision 4: Timeout — 120 seconds

**Decision**: Set the test timeout to 120,000 ms.  
**Rationale**: A real deployment involves a git clone, an npm build, and a cloud upload over the network. 2 minutes is a reasonable ceiling for this on a standard connection.

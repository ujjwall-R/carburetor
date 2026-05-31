# Tasks: Functional Deployment Test (YAML Config + React App)

**Input**: Design documents from `specs/005-deploy-functional-test/`

---

## Phase 1: Implementation

- [x] T001 Create `tests/functional/deploy-yml-react.test.ts` — one test case wiring the full real stack (`ConfigLoader` + `OrchestratingEngine` + `ShippingEngine` + `LocalPipelineExecutor` + `VCSAccess` + `CSPAccess`) against the root `megalodon.yml`, with a 120-second timeout

---

## Phase 2: Verification

- [x] T002 Confirm TypeScript compiles with no errors (`bun run tsc --noEmit`)
- [ ] T003 Run `bun test tests/functional/` with valid `.env` and confirm `Completed` outcome

---

## Notes

- No production source files changed
- No fixtures, no helpers, no stubs
- Bun loads root `.env` automatically — no setup code needed
- T003 requires real credentials and a live cloud target; run manually, not in CI

# Research: Unit Test Coverage

**Branch**: `ujjwal/baseSetup` | **Date**: 2026-04-11 | **Plan**: [plan.md](./plan.md)

---

## Decision 1: Test Runner

**Decision**: Use `bun test` (Bun's built-in test runner) — no additional packages needed.

**Rationale**: The project already uses Bun as runtime and package manager. `bun test` ships with Jest-compatible `describe`/`it`/`expect` API and built-in mocking via `bun:test`. Adding Jest, Vitest, or Mocha would introduce redundant dependencies for identical functionality.

**Alternatives considered**:
- Vitest — excellent Jest compatibility but requires installing as a devDependency; no benefit over Bun's native runner.
- Jest — slower, requires ts-jest or Babel transform; not idiomatic for Bun projects.

---

## Decision 2: Mocking Strategy

**Decision**: Use `bun:test`'s `mock()` function to create typed stub objects that satisfy TypeScript interfaces. No third-party mock library needed.

**Pattern**:
```typescript
import { mock } from 'bun:test';
import type { IVCSAccess } from '../../src/access/IVCSAccess.js';

const makeVCSAccessMock = (): IVCSAccess => ({
  validateCredentials: mock(() => Promise.resolve(true)),
  fetchSource: mock(() => Promise.resolve({ localPath: '/tmp/src', metadata: {} })),
});
```

`mock()` returns a function spy compatible with `expect(fn).toHaveBeenCalled()` and `expect(fn).toHaveBeenCalledWith(...)`. For returning different values per-test, use `mockReturnValueOnce()` / `mockResolvedValueOnce()`.

**Alternatives considered**:
- `jest-mock-extended` — generates typed deep mocks from interfaces but requires jest as peer dep; incompatible with Bun natively.
- Manual stub classes — verbose; no call-tracking without additional spy infrastructure.

---

## Decision 3: Code Coverage Tool

**Decision**: Use `bun test --coverage` (Bun's built-in V8 coverage). Configure thresholds in `bunfig.toml`.

**Rationale**: Bun 1.1+ includes native coverage via V8. Outputs line, function, and branch percentages. No additional tools (nyc, istanbul, c8) required.

**Coverage configuration** (`bunfig.toml`):
```toml
[test]
coverageReporter = ["text", "lcov"]
```

**Running coverage**:
```bash
bun test --coverage                          # all tests with coverage
bun test --coverage tests/unit/managers/    # managers layer only
bun test --coverage tests/unit/engines/     # engines layer only
```

**Threshold enforcement**: `bunfig.toml` supports a global `coverageThreshold`. For per-layer enforcement, a lightweight shell script (`scripts/check-coverage.sh`) parses the `lcov.info` output and verifies thresholds per directory. This avoids pulling in a heavier reporter.

**Alternatives considered**:
- `c8` / `nyc` — Istanbul-based; work with Node but require extra config in Bun.
- `vitest --coverage` — would need to switch test runner; not warranted.

---

## Decision 4: Test File Naming and Location

**Decision**: Mirror `src/` under `tests/unit/`. Each source class gets exactly one test file.

```
tests/unit/
  managers/DeploymentManager.test.ts
  engines/OrchestratingEngine.test.ts
  engines/ShippingEngine.test.ts
  executors/LocalPipelineExecutor.test.ts
tests/helpers/
  fixtures.ts      ← shared test data builders
  mocks.ts         ← shared interface mock factories
```

**Rationale**: Mirrors the source tree so coverage gaps are immediately obvious. `helpers/` contains no test cases — just shared factories that avoid fixture duplication across test files.

---

## Decision 5: LocalPipelineExecutor Testing Approach

**Decision**: Test `LocalPipelineExecutor` with trivially simple shell commands (`echo`, `exit 1`, `false`) rather than mocking `spawn`. These run in under 100ms and are available on all target platforms (macOS/Linux).

**Rationale**: `LocalPipelineExecutor` is a thin coordinator around `Bun.spawn`/Node `child_process.spawn`. Its value is in the orchestration logic (step-by-step execution, failure propagation, artifact construction) — testing that logic requires real process spawning. Mocking `spawn` would verify wiring, not behavior.

**Alternatives considered**:
- Mock `spawn` at module level — tests wiring but not the async event handling logic; misses real edge cases (exit code vs error event).
- Write a fake child process — high maintenance; still doesn't test real OS behavior.

---

## Implementation Notes

### `OrchestratingEngine` — Known Gap

`ProjectType.Docker` is detected by `detectProjectType()` but is not handled in the `buildStepsForType()` switch — it falls to `default: return []`. Docker step generation needs to be implemented before the Docker test case can pass. The test for Docker should be written now and will serve as the failing spec until implementation.

### `bunfig.toml` per-layer threshold approach

Bun 1.x does not support per-directory thresholds natively. The practical solution is two `package.json` scripts:

```json
"test:coverage": "bun test --coverage",
"test:coverage:check": "bash scripts/check-coverage.sh"
```

`check-coverage.sh` parses `lcov.info` (written to `coverage/`) and checks:
- All files under `src/managers/` → ≥ 90% line, ≥ 80% branch
- All files under `src/engines/` → ≥ 90% line, ≥ 80% branch
- Global → ≥ 85% line (lower because `src/access/` and `src/client/` are excluded from threshold)

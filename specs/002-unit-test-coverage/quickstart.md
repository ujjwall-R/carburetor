# Quickstart: Unit Tests

## Running tests

```bash
# Run all unit tests
bun test

# Run with coverage report
bun test --coverage

# Run a specific test file
bun test tests/unit/engines/OrchestratingEngine.test.ts

# Run a specific layer
bun test tests/unit/managers/
bun test tests/unit/engines/

# Watch mode (re-runs on file change)
bun test --watch
```

## Coverage thresholds

```bash
# Check coverage with thresholds enforced (uses bunfig.toml + scripts/check-coverage.sh)
bun run test:coverage:check
```

Thresholds:
- `src/managers/` — line ≥ 90%, branch ≥ 80%
- `src/engines/` — line ≥ 90%, branch ≥ 80%
- Global — line ≥ 85%

## File structure

```
tests/
├── helpers/
│   ├── fixtures.ts          ← test data builders (DeploymentRequest, Pipeline, etc.)
│   └── mocks.ts             ← interface mock factories
└── unit/
    ├── managers/
    │   └── DeploymentManager.test.ts
    ├── engines/
    │   ├── OrchestratingEngine.test.ts
    │   └── ShippingEngine.test.ts
    └── executors/
        └── LocalPipelineExecutor.test.ts
```

## Writing a new test

1. Import from `bun:test` and the component under test:
   ```typescript
   import { describe, it, expect, mock, beforeEach } from 'bun:test';
   import { MyComponent } from '../../src/path/MyComponent.js';
   import { makeMockDependency } from '../helpers/mocks.js';
   ```

2. Create fresh mocks per test using `beforeEach` to prevent state leakage.

3. Assert call arguments with `expect(mockFn).toHaveBeenCalledWith(...)`.

4. Use `mockResolvedValueOnce` / `mockReturnValueOnce` for per-test return values.

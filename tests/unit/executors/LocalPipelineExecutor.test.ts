import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalPipelineExecutor } from '../../../src/engines/executors/LocalPipelineExecutor.js';
import { ExecutionStatus, ProjectType, StepType } from '../../../src/models/enums.js';
import type { ExecutionContext, PipelineStep } from '../../../src/models/Pipeline.js';
import { makePipeline, makePipelineStep } from '../../helpers/fixtures.js';

describe('LocalPipelineExecutor', () => {
  let executor: LocalPipelineExecutor;
  let sourceDir: string;
  let artifactDir: string;

  beforeEach(() => {
    executor = new LocalPipelineExecutor();
    sourceDir = mkdtempSync(join(tmpdir(), 'carborator-test-src-'));
    artifactDir = mkdtempSync(join(tmpdir(), 'carborator-test-artifacts-'));
  });

  afterEach(() => {
    rmSync(sourceDir, { recursive: true, force: true });
    rmSync(artifactDir, { recursive: true, force: true });
  });

  const makeContext = (env: Record<string, string> = {}): ExecutionContext => ({
    sourceDir,
    artifactDir,
    env,
  });

  // ─── Empty pipeline ───────────────────────────────────────────────────────

  it('returns Completed with an artifact when the pipeline has no steps', async () => {
    const result = await executor.execute(makePipeline({ steps: [] }), makeContext());
    expect(result.status).toBe(ExecutionStatus.Completed);
    expect(result.artifact).toBeDefined();
  });

  // ─── Step without a command ───────────────────────────────────────────────

  it('treats a step with no command as a success with output "(no command)"', async () => {
    const step: PipelineStep = { id: 'no-cmd', name: 'No command step', type: StepType.Build };
    const result = await executor.execute(makePipeline({ steps: [step] }), makeContext());
    expect(result.status).toBe(ExecutionStatus.Completed);
    expect(result.completedSteps[0]?.success).toBe(true);
    expect(result.completedSteps[0]?.output).toBe('(no command)');
  });

  // ─── Successful command ───────────────────────────────────────────────────

  it('captures stdout from a successful command', async () => {
    const pipeline = makePipeline({ steps: [makePipelineStep({ command: 'echo hello' })] });
    const result = await executor.execute(pipeline, makeContext());
    expect(result.status).toBe(ExecutionStatus.Completed);
    expect(result.completedSteps[0]?.success).toBe(true);
    expect(result.completedSteps[0]?.output).toContain('hello');
  });

  // ─── Failing command ──────────────────────────────────────────────────────

  it('returns Failed status and populates failedStep when a command exits non-zero', async () => {
    const pipeline = makePipeline({ steps: [makePipelineStep({ command: 'exit 1' })] });
    const result = await executor.execute(pipeline, makeContext());
    expect(result.status).toBe(ExecutionStatus.Failed);
    expect(result.failedStep).toBeDefined();
    expect(result.failedStep?.success).toBe(false);
    expect(result.failedStep?.error).toContain('code');
  });

  // ─── Multi-step — all succeed ─────────────────────────────────────────────

  it('all steps complete when all commands succeed', async () => {
    const steps = [
      makePipelineStep({ id: 'step1', name: 'Step 1', command: 'echo step1' }),
      makePipelineStep({ id: 'step2', name: 'Step 2', command: 'echo step2' }),
    ];
    const result = await executor.execute(makePipeline({ steps }), makeContext());
    expect(result.status).toBe(ExecutionStatus.Completed);
    expect(result.completedSteps).toHaveLength(2);
  });

  // ─── Multi-step — first fails ─────────────────────────────────────────────

  it('halts at the first failing step and does not run subsequent steps', async () => {
    const steps = [
      makePipelineStep({ id: 'step1', name: 'Fail', command: 'exit 1' }),
      makePipelineStep({ id: 'step2', name: 'Should not run', command: 'echo unreachable' }),
    ];
    const result = await executor.execute(makePipeline({ steps }), makeContext());
    expect(result.status).toBe(ExecutionStatus.Failed);
    expect(result.completedSteps).toHaveLength(1);
    expect(result.completedSteps[0]?.stepId).toBe('step1');
  });

  // ─── Environment variables ────────────────────────────────────────────────

  it('passes context env variables to the spawned process', async () => {
    const pipeline = makePipeline({
      steps: [makePipelineStep({ command: 'echo $TEST_VAR' })],
    });
    const result = await executor.execute(pipeline, makeContext({ TEST_VAR: 'hello-env' }));
    expect(result.status).toBe(ExecutionStatus.Completed);
    expect(result.completedSteps[0]?.output).toContain('hello-env');
  });

  // ─── Artifact shape ───────────────────────────────────────────────────────

  it('artifact path ends with artifact.tar.gz', async () => {
    const result = await executor.execute(makePipeline({ steps: [] }), makeContext());
    expect(result.artifact?.path).toMatch(/artifact\.tar\.gz$/);
  });

  it('artifact buildMetadata marks executor as "local"', async () => {
    const result = await executor.execute(makePipeline({ steps: [] }), makeContext());
    expect(result.artifact?.buildMetadata['executor']).toBe('local');
  });
});

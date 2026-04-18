import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ExecutionStatus, ProjectType, StepType } from '../../models/enums.js';
import type { Pipeline, ExecutionContext, PipelineResult, StepResult, PipelineStep } from '../../models/Pipeline.js';
import type { DeployableArtifact } from '../../models/DeployableArtifact.js';
import type { IPipelineExecutor } from './IPipelineExecutor.js';

export class LocalPipelineExecutor implements IPipelineExecutor {
  async execute(pipeline: Pipeline, context: ExecutionContext): Promise<PipelineResult> {
    mkdirSync(context.artifactDir, { recursive: true });

    const completedSteps: StepResult[] = [];

    // Ship steps run on the remote host via CSPAccess — skip them here.
    const localSteps = pipeline.steps.filter(s => s.type !== StepType.Ship);

    for (const step of localSteps) {
      const stepLabel = step.command ? `[${step.name}] $ ${step.command}` : `[${step.name}]`;
      process.stdout.write(`  → ${stepLabel}\n`);

      const result = await this.runStep(step, context.sourceDir, context.env);
      completedSteps.push(result);

      if (!result.success) {
        process.stderr.write(`  ✗ Step failed: ${step.name} (exit: ${result.error ?? 'unknown'})\n`);
        if (result.output.trim()) {
          process.stderr.write(`  Output:\n${result.output.trim().split('\n').map(l => `    ${l}`).join('\n')}\n`);
        }
        return {
          status: ExecutionStatus.Failed,
          completedSteps,
          failedStep: result,
        };
      }

      process.stdout.write(`  ✓ ${step.name} (${result.durationMs}ms)\n`);
    }

    const artifact: DeployableArtifact = {
      path: join(context.sourceDir, 'artifact.tar.gz'),
      type: pipeline.projectType,
      buildMetadata: { executor: 'local', steps: String(localSteps.length) },
      builtAt: new Date().toISOString(),
    };

    return {
      status: ExecutionStatus.Completed,
      completedSteps,
      artifact,
    };
  }

  private runStep(step: PipelineStep, cwd: string, env: Record<string, string>): Promise<StepResult> {
    return new Promise((resolve) => {
      const start = Date.now();
      const output: string[] = [];

      if (!step.command) {
        resolve({
          stepId: step.id,
          stepName: step.name,
          success: true,
          output: '(no command)',
          durationMs: 0,
        });
        return;
      }

      const child = spawn(step.command, {
        cwd,
        shell: true,
        env: { ...process.env, ...env },
      });

      child.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString()));

      child.on('close', (code) => {
        const durationMs = Date.now() - start;
        const outputStr = output.join('');

        if (code === 0) {
          resolve({ stepId: step.id, stepName: step.name, success: true, output: outputStr, durationMs });
        } else {
          resolve({
            stepId: step.id,
            stepName: step.name,
            success: false,
            output: outputStr,
            error: `Process exited with code ${code}`,
            durationMs,
          });
        }
      });

      /* istanbul ignore next — spawn error fires only if the shell itself fails to launch, untestable in a standard env */
      child.on('error', (err) => {
        resolve({
          stepId: step.id,
          stepName: step.name,
          success: false,
          output: output.join(''),
          error: err.message,
          durationMs: Date.now() - start,
        });
      });
    });
  }
}

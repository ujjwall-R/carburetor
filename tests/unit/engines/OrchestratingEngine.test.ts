import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { OrchestratingEngine } from '../../../src/engines/OrchestratingEngine.js';
import { ProjectType, StepType } from '../../../src/models/enums.js';

describe('OrchestratingEngine', () => {
  let engine: OrchestratingEngine;

  beforeEach(() => {
    engine = new OrchestratingEngine();
  });

  // ─── Explicit project type ────────────────────────────────────────────────

  describe('buildPipeline — explicit project type', () => {
    it('ReactApp produces a 4-step pipeline (install → build → package → ship)', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.projectType).toBe(ProjectType.ReactApp);
      expect(pipeline.steps).toHaveLength(4);
    });

    it('ReactApp steps are install-deps → build-react → package-artifact → ship', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.steps[0]?.id).toBe('install-deps');
      expect(pipeline.steps[1]?.id).toBe('build-react');
      expect(pipeline.steps[2]?.id).toBe('package-artifact');
      expect(pipeline.steps[3]?.id).toBe('ship');
    });

    it('ReactApp ship step has StepType.Ship', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.steps[3]?.type).toBe(StepType.Ship);
    });

    it('ReactApp ship step uses default deployDir /var/www/html', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.steps[3]?.command).toContain('/var/www/html');
    });

    it('ReactApp ship step uses custom deployDir when provided', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} }, undefined, '/srv/app');
      expect(pipeline.steps[3]?.command).toContain('/srv/app');
      expect(pipeline.steps[3]?.command).not.toContain('/var/www/html');
    });

    it('ReactApp ship step command includes nginx setup', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      const shipCmd = pipeline.steps[3]?.command ?? '';
      expect(shipCmd).toContain('nginx');
      expect(shipCmd).toContain('systemctl');
    });

    it('ReactApp package step uses default output dir "dist"', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.steps[2]?.command).toContain('dist');
    });

    it('NodeService produces a 3-step pipeline with no Ship step', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.NodeService, buildConfig: {} });
      expect(pipeline.projectType).toBe(ProjectType.NodeService);
      expect(pipeline.steps).toHaveLength(3);
      expect(pipeline.steps.every(s => s.type !== StepType.Ship)).toBe(true);
    });

    it('NodeService uses custom outputDir as the primary candidate in package step', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.NodeService, buildConfig: { outputDir: 'build' } });
      const packageStep = pipeline.steps[2];
      expect(packageStep?.command).toMatch(/for d in "build"/);
      expect(packageStep?.command).toContain('"dist"');
    });

    it('Custom type produces an empty pipeline with no Ship step', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.Custom, buildConfig: {} });
      expect(pipeline.projectType).toBe(ProjectType.Custom);
      expect(pipeline.steps).toHaveLength(0);
    });

    it('buildScript override produces 1-step pipeline regardless of type', () => {
      const pipeline = engine.buildPipeline({
        type: ProjectType.ReactApp,
        buildConfig: { buildScript: './build.sh' },
      });
      expect(pipeline.steps).toHaveLength(1);
      expect(pipeline.steps[0]?.command).toBe('./build.sh');
      expect(pipeline.steps[0]?.type).toBe(StepType.Build);
    });

    it('buildScript takes priority over ReactApp type — only 1 step emitted, no Ship step', () => {
      const pipeline = engine.buildPipeline({
        type: ProjectType.ReactApp,
        buildConfig: { buildScript: './ci/build.sh' },
      });
      expect(pipeline.steps).toHaveLength(1);
      expect(pipeline.steps.every(s => s.type !== StepType.Ship)).toBe(true);
    });

    it('Docker type with valid buildConfig produces a 5-step pipeline', () => {
      const pipeline = engine.buildPipeline({
        type: ProjectType.Docker,
        buildConfig: { dockerfilePath: '/app/Dockerfile' },
      });
      expect(pipeline.projectType).toBe(ProjectType.Docker);
      expect(pipeline.steps).toHaveLength(5);
    });
  });

  // ─── Auto-detection via filesystem ───────────────────────────────────────

  describe('buildPipeline — auto-detection via filesystem', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'megalodon-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('detects Docker when Dockerfile is present', () => {
      const dockerfilePath = join(tmpDir, 'Dockerfile');
      writeFileSync(dockerfilePath, 'FROM node:20\n');
      const pipeline = engine.buildPipeline(
        { buildConfig: { dockerfilePath } },
        tmpDir
      );
      expect(pipeline.projectType).toBe(ProjectType.Docker);
      expect(pipeline.steps).toHaveLength(5);
    });

    it('detects ReactApp when react is in dependencies', () => {
      writeFileSync(
        join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } })
      );
      const pipeline = engine.buildPipeline({ buildConfig: {} }, tmpDir);
      expect(pipeline.projectType).toBe(ProjectType.ReactApp);
    });

    it('detects ReactApp when react is in devDependencies', () => {
      writeFileSync(
        join(tmpDir, 'package.json'),
        JSON.stringify({ devDependencies: { react: '^18.0.0' } })
      );
      const pipeline = engine.buildPipeline({ buildConfig: {} }, tmpDir);
      expect(pipeline.projectType).toBe(ProjectType.ReactApp);
    });

    it('detects NodeService when package.json has no react', () => {
      writeFileSync(
        join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.0.0' } })
      );
      const pipeline = engine.buildPipeline({ buildConfig: {} }, tmpDir);
      expect(pipeline.projectType).toBe(ProjectType.NodeService);
    });

    it('falls back to NodeService when package.json is malformed', () => {
      writeFileSync(join(tmpDir, 'package.json'), 'not valid json {{{');
      const pipeline = engine.buildPipeline({ buildConfig: {} }, tmpDir);
      expect(pipeline.projectType).toBe(ProjectType.NodeService);
    });

    it('falls back to Custom when no recognisable project files are present', () => {
      const pipeline = engine.buildPipeline({ buildConfig: {} }, tmpDir);
      expect(pipeline.projectType).toBe(ProjectType.Custom);
      expect(pipeline.steps).toHaveLength(0);
    });
  });

  // ─── Docker ───────────────────────────────────────────────────────────────

  describe('buildPipeline — Docker', () => {
    it('Docker produces a 5-step pipeline', () => {
      const pipeline = engine.buildPipeline({
        type: ProjectType.Docker,
        buildConfig: { dockerfilePath: '/app/Dockerfile' },
      });
      expect(pipeline.projectType).toBe(ProjectType.Docker);
      expect(pipeline.steps).toHaveLength(5);
    });

    it('Docker pipeline has 1 local step and 4 Ship steps', () => {
      const pipeline = engine.buildPipeline({
        type: ProjectType.Docker,
        buildConfig: { dockerfilePath: '/app/Dockerfile' },
      });
      const shipSteps = pipeline.steps.filter(s => s.type === StepType.Ship);
      const localSteps = pipeline.steps.filter(s => s.type !== StepType.Ship);
      expect(shipSteps).toHaveLength(4);
      expect(localSteps).toHaveLength(1);
    });
  });

  // ─── No sourceDir fallback ────────────────────────────────────────────────

  describe('buildPipeline — no sourceDir fallback', () => {
    it('defaults to Custom type when no sourceDir and no project.type are provided', () => {
      const pipeline = engine.buildPipeline({ buildConfig: {} });
      expect(pipeline.projectType).toBe(ProjectType.Custom);
      expect(pipeline.steps).toHaveLength(0);
    });
  });
});

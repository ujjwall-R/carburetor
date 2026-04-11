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
    it('ReactApp produces a 3-step pipeline', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.projectType).toBe(ProjectType.ReactApp);
      expect(pipeline.steps).toHaveLength(3);
    });

    it('ReactApp steps are install-deps → build-react → package-artifact', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.steps[0]?.id).toBe('install-deps');
      expect(pipeline.steps[1]?.id).toBe('build-react');
      expect(pipeline.steps[2]?.id).toBe('package-artifact');
    });

    it('ReactApp package step uses default output dir "dist"', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.ReactApp, buildConfig: {} });
      expect(pipeline.steps[2]?.command).toContain('dist');
    });

    it('NodeService produces a 3-step pipeline', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.NodeService, buildConfig: {} });
      expect(pipeline.projectType).toBe(ProjectType.NodeService);
      expect(pipeline.steps).toHaveLength(3);
    });

    it('NodeService uses custom outputDir in package step', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.NodeService, buildConfig: { outputDir: 'build' } });
      const packageStep = pipeline.steps[2];
      expect(packageStep?.command).toContain('build');
      expect(packageStep?.command).not.toContain(' dist');
    });

    it('Custom type produces an empty pipeline', () => {
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

    it('buildScript takes priority over ReactApp type — only 1 step emitted', () => {
      const pipeline = engine.buildPipeline({
        type: ProjectType.ReactApp,
        buildConfig: { buildScript: './ci/build.sh' },
      });
      expect(pipeline.steps).toHaveLength(1);
    });

    // known gap: Docker step generation not yet implemented
    it('Docker type falls to default — produces empty pipeline (known gap: Docker steps not yet implemented)', () => {
      const pipeline = engine.buildPipeline({ type: ProjectType.Docker, buildConfig: {} });
      expect(pipeline.projectType).toBe(ProjectType.Docker);
      // TODO: update this test when Docker step generation is implemented
      expect(pipeline.steps).toHaveLength(0);
    });
  });

  // ─── Auto-detection via filesystem ───────────────────────────────────────

  describe('buildPipeline — auto-detection via filesystem', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'carborator-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('detects Docker when Dockerfile is present', () => {
      writeFileSync(join(tmpDir, 'Dockerfile'), 'FROM node:20\n');
      const pipeline = engine.buildPipeline({ buildConfig: {} }, tmpDir);
      expect(pipeline.projectType).toBe(ProjectType.Docker);
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
      // tmpDir is empty — no Dockerfile, no package.json
      const pipeline = engine.buildPipeline({ buildConfig: {} }, tmpDir);
      expect(pipeline.projectType).toBe(ProjectType.Custom);
      expect(pipeline.steps).toHaveLength(0);
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

import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import { DockerOrchestration } from '../../../src/engines/orchestrations/DockerOrchestration.js';
import { StepType } from '../../../src/models/enums.js';

describe('DockerOrchestration', () => {
  const orchestration = new DockerOrchestration();
  const buildConfig = { dockerfilePath: '/project/Dockerfile', containerPort: 80 };

  it('produces exactly 5 steps', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps).toHaveLength(5);
  });

  it('steps have correct IDs in order', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[0]?.id).toBe('docker-copy');
    expect(steps[1]?.id).toBe('docker-install');
    expect(steps[2]?.id).toBe('docker-build');
    expect(steps[3]?.id).toBe('docker-stop');
    expect(steps[4]?.id).toBe('docker-run');
  });

  it('first step is local Build (copy Dockerfile)', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[0]?.type).toBe(StepType.Build);
  });

  it('last four steps are Ship (remote on EC2)', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[1]?.type).toBe(StepType.Ship);
    expect(steps[2]?.type).toBe(StepType.Ship);
    expect(steps[3]?.type).toBe(StepType.Ship);
    expect(steps[4]?.type).toBe(StepType.Ship);
  });

  it('copy step uses resolved absolute dockerfile path', () => {
    const steps = orchestration.buildSteps(buildConfig);
    const absPath = path.resolve('/project/Dockerfile');
    expect(steps[0]?.command).toBe(`cp ${absPath} artifact.tar.gz`);
  });

  it('install step is idempotent (no-op when docker already present)', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[1]?.command).toContain('command -v docker');
    expect(steps[1]?.command).toContain('>/dev/null 2>&1 ||');
  });

  it('install step handles both yum and apt-get', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[1]?.command).toContain('yum install -y docker');
    expect(steps[1]?.command).toContain('apt-get install -y docker.io');
  });

  it('build step runs docker build on EC2 with --no-cache', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[2]?.command).toContain('docker build');
    expect(steps[2]?.command).toContain('--no-cache');
    expect(steps[2]?.command).toContain('-f /tmp/carburetor-artifact.tar.gz');
    expect(steps[2]?.command).toContain('carburetor-docker-image');
  });

  it('stop step frees port 80 and removes old container, ends with || true', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[3]?.command).toContain('systemctl stop nginx');
    expect(steps[3]?.command).toContain('docker rm -f carburetor-app');
    expect(steps[3]?.command).toMatch(/\|\| true$/);
  });

  it('stop step comes before run step', () => {
    const steps = orchestration.buildSteps(buildConfig);
    const stopIdx = steps.findIndex(s => s.id === 'docker-stop');
    const runIdx = steps.findIndex(s => s.id === 'docker-run');
    expect(stopIdx).toBeLessThan(runIdx);
  });

  it('run step always binds port 80 on host and container', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[4]?.command).toContain('-p 80:80');
  });

  it('run step names the container carburetor-app', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[4]?.command).toContain('--name carburetor-app');
  });

  it('run step uses the fixed image name carburetor-docker-image', () => {
    const steps = orchestration.buildSteps(buildConfig);
    expect(steps[4]?.command).toContain('carburetor-docker-image');
  });
});

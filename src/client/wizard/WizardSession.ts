import * as clack from '@clack/prompts';
import { isCancel } from '@clack/prompts';
import { existsSync } from 'fs';
import type { DeploymentRequest, VCSCredentials, CSPCredentials } from '../../models/DeploymentRequest.js';
import { ProjectType, VCSProvider, CloudPlatform } from '../../models/enums.js';
import {
  PROJECT_TYPE_OPTIONS,
  VCS_PROVIDER_OPTIONS,
  CLOUD_PLATFORM_OPTIONS,
  AWS_SERVICE_OPTIONS,
} from './prompts.js';

const required = (v: string | undefined): string | undefined =>
  !v || v.trim().length === 0 ? 'This field is required.' : undefined;

export class WizardSession {
  async run(dryRun: boolean, verbose: boolean): Promise<DeploymentRequest> {
    clack.intro('  carburetor — Interactive Deployment Wizard  ');

    // ── Step 1: Project type ────────────────────────────────────────────────
    const projectType = await clack.select({
      message: 'What type of project are you deploying?',
      options: PROJECT_TYPE_OPTIONS as unknown as Array<{ value: string; label: string }>,
    });
    this.assertNotCancel(projectType);

    // ── Docker single-container path ───────────────────────────────────────
    if (projectType === ProjectType.Docker) {
      return this.runDockerWizard(dryRun, verbose);
    }

    if (projectType === ProjectType.Custom) {
      clack.note('Note: "Other" projects use a generic build configuration. This mode is experimental.');
    }

    // ── Steps 2–3: VCS details ─────────────────────────────────────────────
    const repoUrl = await this.promptWithRetry(() =>
      clack.text({ message: 'Repository URL (e.g. https://github.com/org/repo)', validate: required })
    );

    const branch = await this.promptWithRetry(() =>
      clack.text({ message: 'Branch to deploy', defaultValue: 'main', validate: required })
    );

    // ── Step 4: VCS provider ───────────────────────────────────────────────
    const vcsProvider = await clack.select({
      message: 'Version control provider',
      options: VCS_PROVIDER_OPTIONS as unknown as Array<{ value: string; label: string }>,
    });
    this.assertNotCancel(vcsProvider);

    // ── Step 5: VCS token ──────────────────────────────────────────────────
    const vcsToken = await this.promptWithRetry(() =>
      clack.password({ message: 'GitHub Personal Access Token', validate: required })
    );

    // ── Step 6: Cloud platform ─────────────────────────────────────────────
    const platform = await clack.select({
      message: 'Cloud platform',
      options: CLOUD_PLATFORM_OPTIONS as unknown as Array<{ value: string; label: string }>,
    });
    this.assertNotCancel(platform);

    // ── Step 7: Service type ───────────────────────────────────────────────
    const serviceType = await clack.select({
      message: 'Service type',
      options: AWS_SERVICE_OPTIONS as unknown as Array<{ value: string; label: string }>,
    });
    this.assertNotCancel(serviceType);

    // ── Steps 8–10: Target details ─────────────────────────────────────────
    const region = await this.promptWithRetry(() =>
      clack.text({ message: 'AWS region (e.g. us-east-1)', validate: required })
    );

    const environment = await this.promptWithRetry(() =>
      clack.text({ message: 'Environment name (e.g. production, staging)', defaultValue: 'production', validate: required })
    );

    const resourceId = await this.promptWithRetry(() =>
      clack.text({ message: 'EC2 Instance ID (e.g. i-0abc123def456)', validate: required })
    );

    // ── Steps 11–12: AWS credentials ───────────────────────────────────────
    const awsAccessKeyId = await this.promptWithRetry(() =>
      clack.password({ message: 'AWS_ACCESS_KEY_ID', validate: required })
    );

    const awsSecretKey = await this.promptWithRetry(() =>
      clack.password({ message: 'AWS_SECRET_ACCESS_KEY', validate: required })
    );

    // ── Steps 13–14: SSH key ───────────────────────────────────────────────
    const sshKeyMode = await clack.select({
      message: 'How do you want to provide the EC2 SSH key?',
      options: [
        { value: 'inline', label: 'Paste inline' },
        { value: 'path',   label: 'Path to key file' },
      ],
    });
    this.assertNotCancel(sshKeyMode);

    let sshKey: string | undefined;
    let sshKeyPath: string | undefined;

    if (sshKeyMode === 'inline') {
      sshKey = await this.promptWithRetry(() =>
        clack.password({ message: 'Paste your SSH private key', validate: required })
      );
    } else {
      sshKeyPath = await this.promptWithRetry(() =>
        clack.text({ message: 'Path to SSH private key file (e.g. ~/.ssh/id_rsa)', validate: required })
      );
    }

    // ── Step 15: SSH user ──────────────────────────────────────────────────
    const sshUser = await this.promptWithRetry(() =>
      clack.text({ message: 'SSH username on EC2 instance (e.g. ec2-user, ubuntu)', validate: required })
    );

    // ── Step 16: Confirmation summary ─────────────────────────────────────
    clack.note(
      [
        `Project type : ${String(projectType)}`,
        `Repository   : ${repoUrl} (${branch})`,
        `VCS provider : ${String(vcsProvider)}`,
        `Cloud        : ${String(platform)} — ${String(serviceType)}`,
        `Region       : ${region}`,
        `Environment  : ${environment}`,
        `Instance ID  : ${resourceId}`,
        `SSH user     : ${sshUser}`,
        sshKeyPath ? `SSH key file : ${sshKeyPath}` : 'SSH key      : (inline — hidden)',
      ].join('\n'),
      'Deployment Summary'
    );

    const confirmed = await clack.confirm({ message: 'Proceed with deployment?' });
    if (isCancel(confirmed) || !confirmed) {
      clack.cancel('Deployment cancelled.');
      process.exit(1);
    }

    clack.outro('Starting deployment…');

    // ── Assemble DeploymentRequest ─────────────────────────────────────────
    const vcsCredentials: VCSCredentials = { token: vcsToken };

    const cspCredentials: CSPCredentials = {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretKey,
      sshUser,
      ...(sshKey      ? { sshKey }     : {}),
      ...(sshKeyPath  ? { sshKeyPath } : {}),
    };

    return {
      project: { type: projectType as ProjectType, buildConfig: {} },
      target: {
        platform: platform as CloudPlatform,
        region,
        environment,
        resourceId,
      },
      vcsConfig: {
        provider: vcsProvider as VCSProvider,
        repoUrl,
        branch,
      },
      vcsCredentials,
      cspCredentials,
      dryRun,
      verbose,
    };
  }

  // ── Docker wizard ──────────────────────────────────────────────────────────

  private async runDockerWizard(dryRun: boolean, verbose: boolean): Promise<DeploymentRequest> {
    // ── Dockerfile path ────────────────────────────────────────────────────
    const dockerfilePath = await this.promptWithRetry(() =>
      clack.text({
        message: 'Dockerfile path (e.g. ./Dockerfile)',
        validate: (v) => {
          if (!v || v.trim().length === 0) return 'This field is required.';
          if (!existsSync(v.trim())) return `Dockerfile not found: ${v.trim()}`;
          return undefined;
        },
      })
    );

    // ── Cloud platform + service type ──────────────────────────────────────
    const platform = await clack.select({
      message: 'Cloud platform',
      options: CLOUD_PLATFORM_OPTIONS as unknown as Array<{ value: string; label: string }>,
    });
    this.assertNotCancel(platform);

    const serviceType = await clack.select({
      message: 'Service type',
      options: AWS_SERVICE_OPTIONS as unknown as Array<{ value: string; label: string }>,
    });
    this.assertNotCancel(serviceType);

    // ── Target details ─────────────────────────────────────────────────────
    const region = await this.promptWithRetry(() =>
      clack.text({ message: 'AWS region (e.g. us-east-1)', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
    );

    const environment = await this.promptWithRetry(() =>
      clack.text({ message: 'Environment name (e.g. production, staging)', defaultValue: 'production', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
    );

    const resourceId = await this.promptWithRetry(() =>
      clack.text({ message: 'EC2 Instance ID (e.g. i-0abc123def456)', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
    );

    // ── AWS credentials ────────────────────────────────────────────────────
    const awsAccessKeyId = await this.promptWithRetry(() =>
      clack.password({ message: 'AWS_ACCESS_KEY_ID', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
    );

    const awsSecretKey = await this.promptWithRetry(() =>
      clack.password({ message: 'AWS_SECRET_ACCESS_KEY', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
    );

    // ── SSH key ────────────────────────────────────────────────────────────
    const sshKeyMode = await clack.select({
      message: 'How do you want to provide the EC2 SSH key?',
      options: [
        { value: 'inline', label: 'Paste inline' },
        { value: 'path',   label: 'Path to key file' },
      ],
    });
    this.assertNotCancel(sshKeyMode);

    let sshKey: string | undefined;
    let sshKeyPath: string | undefined;

    if (sshKeyMode === 'inline') {
      sshKey = await this.promptWithRetry(() =>
        clack.password({ message: 'Paste your SSH private key', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
      );
    } else {
      sshKeyPath = await this.promptWithRetry(() =>
        clack.text({ message: 'Path to SSH private key file (e.g. ~/.ssh/id_rsa)', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
      );
    }

    // ── SSH user ───────────────────────────────────────────────────────────
    const sshUser = await this.promptWithRetry(() =>
      clack.text({ message: 'SSH username on EC2 instance (e.g. ec2-user, ubuntu)', validate: (v) => (!v || !v.trim() ? 'This field is required.' : undefined) })
    );

    // ── Confirmation summary ───────────────────────────────────────────────
    clack.note(
      [
        `Project type : docker`,
        `Dockerfile   : ${dockerfilePath}`,
        `Cloud        : ${String(platform)} — ${String(serviceType)}`,
        `Region       : ${region}`,
        `Environment  : ${environment}`,
        `Instance ID  : ${resourceId}`,
        `SSH user     : ${sshUser}`,
        sshKeyPath ? `SSH key file : ${sshKeyPath}` : 'SSH key      : (inline — hidden)',
        `Port         : 80 (fixed)`,
      ].join('\n'),
      'Deployment Summary'
    );

    const confirmed = await clack.confirm({ message: 'Proceed with deployment?' });
    if (isCancel(confirmed) || !confirmed) {
      clack.cancel('Deployment cancelled.');
      process.exit(1);
    }

    clack.outro('Starting deployment…');

    const cspCredentials: CSPCredentials = {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretKey,
      sshUser,
      ...(sshKey     ? { sshKey }     : {}),
      ...(sshKeyPath ? { sshKeyPath } : {}),
    };

    return {
      project: { type: ProjectType.Docker, buildConfig: { dockerfilePath } },
      target: {
        platform: platform as CloudPlatform,
        region,
        environment,
        resourceId,
      },
      vcsConfig: {
        provider: VCSProvider.GitHub,
        repoUrl: '',
        branch: 'main',
      },
      vcsCredentials: { token: '' },
      cspCredentials,
      dryRun,
      verbose,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private assertNotCancel(value: unknown): void {
    if (isCancel(value)) {
      clack.cancel('Wizard cancelled.');
      process.exit(1);
    }
  }

  private async promptWithRetry(
    promptFn: () => Promise<string | symbol>,
    maxAttempts = 3
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const value = await promptFn();
      if (isCancel(value)) {
        clack.cancel('Wizard cancelled.');
        process.exit(1);
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    clack.cancel('Too many invalid attempts. See the docs for configuration guidance.');
    process.exit(1);
  }
}

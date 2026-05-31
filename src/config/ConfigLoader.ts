import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { CloudPlatform, ProjectType, VCSProvider } from '../models/enums.js';
import type { BuildConfig, CSPCredentials, DeploymentTarget, VCSConfig, VCSCredentials } from '../models/DeploymentRequest.js';
import type { JenkinsConfig, TemporalConfig } from '../models/ExecutorConfig.js';

export type ExecutorType = 'local' | 'jenkins' | 'temporal';

export interface megalodonConfig {
  project: {
    type?: ProjectType;
    build: BuildConfig;
  };
  target: DeploymentTarget;
  vcs: VCSConfig;
  executor: {
    type: ExecutorType;
    jenkins?: JenkinsConfig;
    temporal?: TemporalConfig;
  };
}

export class ConfigLoader {
  load(configPath: string): megalodonConfig {
    const absPath = resolve(configPath);
    if (!existsSync(absPath)) {
      throw new Error(`Config file not found: ${absPath}`);
    }

    const raw = readFileSync(absPath, 'utf-8');
    const parsed = yaml.load(raw) as Record<string, unknown>;

    return this.validate(parsed);
  }

  resolveVCSCredentials(): VCSCredentials {
    const token = process.env['megalodon_VCS_TOKEN'];
    if (!token) {
      throw new Error('Missing required env var: megalodon_VCS_TOKEN');
    }
    return { token };
  }

  resolveCSPCredentials(platform: CloudPlatform): CSPCredentials {
    switch (platform) {
      case CloudPlatform.AWS:
      case CloudPlatform.Lambda: {
        const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
        const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
        if (!accessKeyId || !secretAccessKey) {
          throw new Error('Missing required env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
        }
        const creds: CSPCredentials = { accessKeyId, secretAccessKey };
        const sessionToken = process.env['AWS_SESSION_TOKEN'];
        if (sessionToken) creds['sessionToken'] = sessionToken;
        // EC2 SSH credentials (only required when deploying to an EC2 instance)
        const sshKey = process.env['megalodon_EC2_SSH_KEY'];
        const sshKeyPath = process.env['megalodon_EC2_SSH_KEY_PATH'];
        const sshUser = process.env['megalodon_EC2_SSH_USER'];
        const deployDir = process.env['megalodon_EC2_DEPLOY_DIR'];
        if (sshKey) creds['sshKey'] = sshKey;
        if (sshKeyPath) creds['sshKeyPath'] = sshKeyPath;
        if (sshUser) creds['sshUser'] = sshUser;
        if (deployDir) creds['deployDir'] = deployDir;
        return creds;
      }
      case CloudPlatform.GCP: {
        const keyFile = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
        if (!keyFile) {
          throw new Error('Missing required env var: GOOGLE_APPLICATION_CREDENTIALS');
        }
        return { keyFile };
      }
      case CloudPlatform.Azure: {
        const clientId = process.env['AZURE_CLIENT_ID'];
        const clientSecret = process.env['AZURE_CLIENT_SECRET'];
        const tenantId = process.env['AZURE_TENANT_ID'];
        const subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
        if (!clientId || !clientSecret || !tenantId || !subscriptionId) {
          throw new Error('Missing required env vars: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID');
        }
        return { clientId, clientSecret, tenantId, subscriptionId };
      }
    }
  }

  private validate(raw: Record<string, unknown>): megalodonConfig {
    const project = raw['project'] as Record<string, unknown> | undefined;
    const target = raw['target'] as Record<string, unknown> | undefined;
    const vcs = raw['vcs'] as Record<string, unknown> | undefined;
    const executor = raw['executor'] as Record<string, unknown> | undefined;

    if (!project) throw new Error('Config missing required section: project');
    if (!target) throw new Error('Config missing required section: target');

    const resolvedProjectType = project['type'] ? (String(project['type']) as ProjectType) : undefined;
    const isDocker = resolvedProjectType === ProjectType.Docker;

    if (!isDocker && !vcs) throw new Error('Config missing required section: vcs');

    const platform = String(target['platform'] ?? '') as CloudPlatform;
    if (!Object.values(CloudPlatform).includes(platform)) {
      throw new Error(`Invalid target.platform: "${platform}". Must be one of: ${Object.values(CloudPlatform).join(', ')}`);
    }

    let provider: VCSProvider | undefined;
    if (!isDocker) {
      provider = String(vcs!['provider'] ?? '') as VCSProvider;
      if (!Object.values(VCSProvider).includes(provider)) {
        throw new Error(`Invalid vcs.provider: "${provider}". Must be one of: ${Object.values(VCSProvider).join(', ')}`);
      }
    }

    const build = (project['build'] as Record<string, unknown> | undefined) ?? {};

    const buildScript = build['script'] as string | undefined;
    const outputDir = build['outputDir'] as string | undefined;
    const env = build['env'] as Record<string, string> | undefined;
    const dockerfilePath = build['dockerfilePath'] as string | undefined;
    const containerPort = build['containerPort'] as number | undefined;
    const domain = build['domain'] as string | undefined;
    const sslEmail = build['sslEmail'] as string | undefined;
    const vcsRef = vcs?.['ref'] as string | undefined;
    const jenkins = executor?.['jenkins'] as JenkinsConfig | undefined;
    const temporal = executor?.['temporal'] as TemporalConfig | undefined;

    return {
      project: {
        ...(resolvedProjectType ? { type: resolvedProjectType } : {}),
        build: {
          ...(buildScript ? { buildScript } : {}),
          ...(outputDir ? { outputDir } : {}),
          ...(env ? { env } : {}),
          ...(dockerfilePath ? { dockerfilePath } : {}),
          ...(containerPort !== undefined ? { containerPort } : {}),
          ...(domain ? { domain } : {}),
          ...(sslEmail ? { sslEmail } : {}),
        },
      },
      target: {
        platform,
        region: String(target['region'] ?? ''),
        environment: String(target['environment'] ?? 'production'),
        resourceId: String(target['resourceId'] ?? ''),
      },
      vcs: {
        provider: provider ?? VCSProvider.GitHub,
        repoUrl: String(vcs?.['repoUrl'] ?? ''),
        branch: String(vcs?.['branch'] ?? 'main'),
        ...(vcsRef ? { ref: vcsRef } : {}),
      },
      executor: {
        type: executor ? (String(executor['type'] ?? 'local') as ExecutorType) : 'local',
        ...(jenkins ? { jenkins } : {}),
        ...(temporal ? { temporal } : {}),
      },
    };
  }
}

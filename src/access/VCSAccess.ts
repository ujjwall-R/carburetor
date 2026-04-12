import { simpleGit } from 'simple-git';
import { VCSProvider } from '../models/enums.js';
import type { VCSConfig, VCSCredentials } from '../models/DeploymentRequest.js';
import type { SourceMetadata } from '../models/SourceArtifact.js';
import type { IVCSAccess } from './IVCSAccess.js';

export class VCSAccess implements IVCSAccess {
  async validateCredentials(credentials: VCSCredentials, provider: VCSProvider): Promise<boolean> {
    switch (provider) {
      case VCSProvider.GitHub: {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            'User-Agent': 'carburetor/0.1.0',
          },
        });
        return res.ok;
      }
      case VCSProvider.GitLab: {
        const res = await fetch('https://gitlab.com/api/v4/user', {
          headers: { 'PRIVATE-TOKEN': credentials.token },
        });
        return res.ok;
      }
      default:
        return false;
    }
  }

  async fetchSource(config: VCSConfig, credentials: VCSCredentials, destDir: string): Promise<SourceMetadata> {
    const authenticatedUrl = this.buildAuthenticatedUrl(config.repoUrl, credentials.token, config.provider);

    const git = simpleGit();
    await git.clone(authenticatedUrl, destDir, ['--branch', config.branch, '--depth', '1']);

    const cloneGit = simpleGit(destDir);
    const log = await cloneGit.log({ maxCount: 1 });
    const commitHash = log.latest?.hash ?? 'unknown';

    return {
      provider: config.provider,
      repoUrl: config.repoUrl,
      branch: config.branch,
      commitHash,
      fetchedAt: new Date().toISOString(),
    };
  }

  private buildAuthenticatedUrl(repoUrl: string, token: string, provider: VCSProvider): string {
    try {
      const url = new URL(repoUrl);
      url.username = token;
      url.password = 'x-oauth-basic';
      return url.toString();
    } catch {
      return repoUrl;
    }
  }
}

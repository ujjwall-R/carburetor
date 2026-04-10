import type { VCSConfig, VCSCredentials } from '../models/DeploymentRequest.js';
import type { VCSProvider } from '../models/enums.js';
import type { SourceMetadata } from '../models/SourceArtifact.js';

export interface IVCSAccess {
  validateCredentials(credentials: VCSCredentials, provider: VCSProvider): Promise<boolean>;
  fetchSource(config: VCSConfig, credentials: VCSCredentials, destDir: string): Promise<SourceMetadata>;
}

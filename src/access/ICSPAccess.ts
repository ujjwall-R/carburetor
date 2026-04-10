import type { DeploymentTarget, CSPCredentials } from '../models/DeploymentRequest.js';
import type { DeployableArtifact } from '../models/DeployableArtifact.js';
import type { CloudPlatform } from '../models/enums.js';

export interface DeploymentResult {
  resourceId: string;
  endpoint: string;
  platform: CloudPlatform;
}

export interface ICSPAccess {
  validateCredentials(credentials: CSPCredentials, platform: CloudPlatform): Promise<boolean>;
  deploy(artifact: DeployableArtifact, target: DeploymentTarget, credentials: CSPCredentials): Promise<DeploymentResult>;
  getEndpoint(result: DeploymentResult): string;
}

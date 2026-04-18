import type { CloudPlatform, VCSProvider } from './enums.js';

export interface BuildConfig {
  buildScript?: string;
  outputDir?: string;
  env?: Record<string, string>;
  dockerfilePath?: string;
  containerPort?: number;
}

export interface Project {
  type?: import('./enums.js').ProjectType;
  buildConfig: BuildConfig;
}

export interface DeploymentTarget {
  platform: CloudPlatform;
  region: string;
  environment: string;
  resourceId: string;
}

export interface VCSConfig {
  provider: VCSProvider;
  repoUrl: string;
  branch: string;
  ref?: string;
}

export interface VCSCredentials {
  token: string;
}

export interface CSPCredentials {
  [key: string]: string;
}

export interface DeploymentRequest {
  project: Project;
  target: DeploymentTarget;
  vcsConfig: VCSConfig;
  vcsCredentials: VCSCredentials;
  cspCredentials: CSPCredentials;
  dryRun: boolean;
  verbose: boolean;
}

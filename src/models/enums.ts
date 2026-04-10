export enum ProjectType {
  ReactApp = 'react',
  NodeService = 'node',
  Docker = 'docker',
  Custom = 'custom',
}

export enum CloudPlatform {
  AWS = 'aws',
  GCP = 'gcp',
  Azure = 'azure',
  Lambda = 'lambda',
}

export enum VCSProvider {
  GitHub = 'github',
  GitLab = 'gitlab',
  Bitbucket = 'bitbucket',
}

export enum StepType {
  ValidateCredentials = 'validate-credentials',
  FetchSource = 'fetch-source',
  DetectProject = 'detect-project',
  Build = 'build',
  Package = 'package',
  Ship = 'ship',
  Verify = 'verify',
}

export enum ExecutionStatus {
  Completed = 'completed',
  Pending = 'pending',
  Failed = 'failed',
}

export enum DeploymentStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Success = 'success',
  Failed = 'failed',
}

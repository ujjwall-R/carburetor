# Data Model: Interactive Deployment Wizard

No new persistent data entities. The wizard is a stateless, in-memory session.

## In-Memory Session State

The `WizardSession` collects values through the prompt sequence and assembles them into a `DeploymentRequest` at the end. These fields exist only for the duration of the wizard — they are never written to disk.

```
WizardSession (transient, in-memory only)
  projectType:     ProjectType          ← from select prompt
  buildScript?:    string               ← from text prompt (optional)
  outputDir?:      string               ← from text prompt (optional)
  vcsProvider:     VCSProvider          ← from select prompt (GitHub only)
  repoUrl:         string               ← from text prompt
  branch:          string               ← from text prompt (default: main)
  platform:        CloudPlatform        ← from select prompt (AWS only)
  serviceType:     'ec2'                ← from select prompt
  region:          string               ← from text prompt
  environment:     string               ← from text prompt (default: production)
  resourceId:      string               ← from text prompt (EC2 instance ID)
  vcsToken:        string               ← from password prompt (masked)
  awsAccessKeyId:  string               ← from password prompt (masked)
  awsSecretKey:    string               ← from password prompt (masked)
  sshKeyMode:      'inline' | 'path'    ← from select prompt
  sshKey?:         string               ← from password prompt if inline
  sshKeyPath?:     string               ← from text prompt if path
  sshUser:         string               ← from text prompt
  deployDir:       string               ← from text prompt
```

## Assembled Output (existing model, unchanged)

```
DeploymentRequest
  project:
    type:         ProjectType
    buildConfig:
      buildScript?:  string
      outputDir?:    string
  target:
    platform:     CloudPlatform
    region:       string
    environment:  string
    resourceId:   string
  vcsConfig:
    provider:     VCSProvider
    repoUrl:      string
    branch:       string
  vcsCredentials:
    token:        string            ← from vcsToken
  cspCredentials:
    accessKeyId:  string            ← from awsAccessKeyId
    secretAccessKey: string         ← from awsSecretKey
    sshKey?:      string
    sshKeyPath?:  string
    sshUser?:     string
    deployDir?:   string
  dryRun:         boolean
  verbose:        boolean
```

## Menu Option Constants (static, Client-owned)

These are the hardcoded choice arrays that live in `src/client/wizard/prompts.ts`. They are the "volatile" lists — the only file to change when new options are added.

```
PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType, label: string }>
  { value: 'react',  label: 'React App' }
  { value: 'custom', label: 'Other (experimental)' }

VCS_PROVIDER_OPTIONS: Array<{ value: VCSProvider, label: string }>
  { value: 'github', label: 'GitHub' }

CLOUD_PLATFORM_OPTIONS: Array<{ value: CloudPlatform, label: string }>
  { value: 'aws', label: 'AWS' }

AWS_SERVICE_OPTIONS: Array<{ value: string, label: string }>
  { value: 'ec2', label: 'EC2 Instance' }
```

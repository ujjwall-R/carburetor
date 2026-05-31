# Data Model: Docker CLI and Wizard Integration

**Feature**: `007-docker-cli-wizard-integration`  
**Date**: 2026-04-19

---

## No model changes required

`BuildConfig`, `CSPCredentials`, `DeploymentRequest`, and all enums are unchanged. The Docker wizard assembles the existing `DeploymentRequest` shape with `project.type = ProjectType.Docker` and `buildConfig.dockerfilePath` set — exactly as `runDockerDeploy` in `DeployCLI` already does when reading from `megalodon.yml`.

---

## Wizard Session Shape Changes

### `PROJECT_TYPE_OPTIONS` (`src/client/wizard/prompts.ts`)

Add one entry after `ReactApp`:

```ts
{ value: ProjectType.Docker, label: 'Docker Container' }
```

### Docker wizard path — `DeploymentRequest` assembly

```ts
{
  project: { type: ProjectType.Docker, buildConfig: { dockerfilePath } },
  target: { platform, region, environment, resourceId },  // same as React
  vcsConfig: { provider: VCSProvider.GitHub, repoUrl: '', branch: 'main' },  // stubs
  vcsCredentials: { token: '' },                                               // stub
  cspCredentials: { accessKeyId, secretAccessKey, sshUser, ...sshKey or sshKeyPath },
  dryRun,
  verbose,
}
```

Key differences from the React wizard assembly:
- `project.type = ProjectType.Docker` instead of `ProjectType.ReactApp`
- `project.buildConfig = { dockerfilePath }` instead of `{}`
- `vcsConfig` and `vcsCredentials` are stubs (not collected from user)
- `cspCredentials` has no `deployDir` key

### React wizard path — change to `cspCredentials` assembly

Remove: `deployDir` key from `cspCredentials`  
`ReactAppOrchestration.buildSteps` already defaults to `'/var/www/html'` when `deployDir` is `undefined`.

---

## Files changed

| File | Change |
|---|---|
| `src/client/wizard/prompts.ts` | Add Docker to `PROJECT_TYPE_OPTIONS` |
| `src/client/wizard/WizardSession.ts` | Add Docker branch; remove `deployDir` prompt from React path |
| `tests/unit/client/wizard/WizardSession.test.ts` | Remove `deployDir` fixture entry; add Docker happy-path test |

No engine, access, model, or CLI flag changes.

---

## Test impact

### `WizardSession.test.ts` fixture update

Current `HAPPY_INPUTS`:
- Index 15: `'/var/www/app'` (deploy dir) — **remove**

Current `textValues` in `beforeEach`:
- Index 6: `HAPPY_INPUTS[14]` (SSH user) — becomes index 5 after removal *(check indices)*
- Index 7 (was deploy dir): **remove**

SSH-path-variant test `textValuesPath`:
- Remove the trailing `'/var/www/app'` entry

New Docker happy-path test sequence:
- `select`: `[ProjectType.Docker, CloudPlatform.AWS, 'ec2', 'path']`
- `text`: `['./Dockerfile', 'us-east-1', 'production', 'i-0abc123def456', 'ec2-user', '~/.ssh/id_rsa']`
- `password`: `['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG']`

# Contract: Wizard Interaction Sequence

This document defines the complete prompt sequence a user experiences when running `carburetor deploy --interactive`. Each step shows the prompt type, label, available choices (for selects), validation rule, and which `DeploymentRequest` field it populates.

---

## Prompt Sequence

### Step 1 — Project Type
| Field | Value |
|-------|-------|
| Prompt type | `select` |
| Label | `What type of project are you deploying?` |
| Choices | React App, Other (experimental) |
| Validation | Required (selection) |
| Populates | `request.project.type` |

### Step 2 — Repository URL
| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `Repository URL (e.g. https://github.com/org/repo)` |
| Validation | Non-empty |
| Populates | `request.vcsConfig.repoUrl` |

### Step 3 — Branch
| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `Branch to deploy` |
| Default | `main` |
| Validation | Non-empty |
| Populates | `request.vcsConfig.branch` |

### Step 4 — VCS Provider
| Field | Value |
|-------|-------|
| Prompt type | `select` |
| Label | `Version control provider` |
| Choices | GitHub |
| Validation | Required (selection) |
| Populates | `request.vcsConfig.provider` |

### Step 5 — GitHub Token
| Field | Value |
|-------|-------|
| Prompt type | `password` (masked) |
| Label | `GitHub Personal Access Token` |
| Validation | Non-empty |
| Populates | `request.vcsCredentials.token` |

### Step 6 — Cloud Platform
| Field | Value |
|-------|-------|
| Prompt type | `select` |
| Label | `Cloud platform` |
| Choices | AWS |
| Validation | Required (selection) |
| Populates | `request.target.platform` |

### Step 7 — Service Type *(shown after Step 6; choices depend on platform)*
| Field | Value |
|-------|-------|
| Prompt type | `select` |
| Label | `Service type` |
| Choices (AWS) | EC2 Instance |
| Validation | Required (selection) |
| Populates | `request.target.resourceId` (service type drives subsequent credential steps) |

### Step 8 — Region
| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `AWS region (e.g. us-east-1)` |
| Validation | Non-empty |
| Populates | `request.target.region` |

### Step 9 — Environment
| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `Environment name (e.g. production, staging)` |
| Default | `production` |
| Validation | Non-empty |
| Populates | `request.target.environment` |

### Step 10 — EC2 Instance ID
| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `EC2 Instance ID (e.g. i-0abc123def456)` |
| Validation | Non-empty |
| Populates | `request.target.resourceId` |

### Step 11 — AWS Access Key ID
| Field | Value |
|-------|-------|
| Prompt type | `password` (masked) |
| Label | `AWS_ACCESS_KEY_ID` |
| Validation | Non-empty |
| Populates | `request.cspCredentials.accessKeyId` |

### Step 12 — AWS Secret Access Key
| Field | Value |
|-------|-------|
| Prompt type | `password` (masked) |
| Label | `AWS_SECRET_ACCESS_KEY` |
| Validation | Non-empty |
| Populates | `request.cspCredentials.secretAccessKey` |

### Step 13 — SSH Key Input Method
| Field | Value |
|-------|-------|
| Prompt type | `select` |
| Label | `How do you want to provide the EC2 SSH key?` |
| Choices | Paste inline, Path to key file |
| Validation | Required (selection) |
| Drives | Step 14a or 14b |

### Step 14a — SSH Key (inline)
*Shown only when Step 13 = "Paste inline"*

| Field | Value |
|-------|-------|
| Prompt type | `password` (masked) |
| Label | `Paste your SSH private key` |
| Validation | Non-empty |
| Populates | `request.cspCredentials.sshKey` |

### Step 14b — SSH Key Path
*Shown only when Step 13 = "Path to key file"*

| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `Path to SSH private key file (e.g. ~/.ssh/id_rsa)` |
| Validation | Non-empty |
| Populates | `request.cspCredentials.sshKeyPath` |

### Step 15 — SSH Username
| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `SSH username on EC2 instance (e.g. ec2-user, ubuntu)` |
| Validation | Non-empty |
| Populates | `request.cspCredentials.sshUser` |

### Step 16 — Deploy Directory
| Field | Value |
|-------|-------|
| Prompt type | `text` |
| Label | `Deployment directory on EC2 (e.g. /var/www/app)` |
| Validation | Non-empty |
| Populates | `request.cspCredentials.deployDir` |

### Step 17 — Confirmation Summary
| Field | Value |
|-------|-------|
| Prompt type | `confirm` |
| Label | Summary of all non-secret selections (project type, repo, branch, VCS, platform, service, region, environment, instance ID); secrets omitted |
| On confirm | Proceed to deploy / dry-run |
| On cancel | Exit with code 1, message "Deployment cancelled." |

---

## Cancellation Contract

At any step, if the user presses Ctrl-C:
- `@clack/prompts` returns the `cancel` symbol
- `isCancel(value)` returns `true`
- Wizard calls `clack.cancel('Wizard cancelled.')` and `process.exit(1)`
- No `DeploymentRequest` is assembled; no Manager method is called

## Validation Contract

For `text` and `password` prompts:
- Empty string → re-prompt with inline message "This field is required."
- After 3 consecutive invalid attempts → `clack.cancel()` + `process.exit(1)` + message directing user to docs

For `select` prompts:
- Arrow key navigation; Enter to confirm; no empty-selection possible

# Quickstart: Docker CLI and Wizard Integration

**Feature**: `007-docker-cli-wizard-integration`  
**Date**: 2026-04-19

---

## Prerequisites

- `carburetor` CLI built and on `$PATH`
- A provisioned EC2 instance (Docker already installed, public IP assigned, port 80 open in security group)
- AWS credentials with EC2 describe permissions
- SSH key pair for the EC2 instance

---

## Deploy a Docker Container via Interactive Wizard

```bash
carburetor deploy --interactive
```

Select **Docker Container** at the project type prompt. The wizard collects all connection details:

```
? What type of project are you deploying? › Docker Container
? Dockerfile path (e.g. ./Dockerfile) › ./Dockerfile
? Cloud platform › AWS
? Service type › EC2 Instance
? AWS region (e.g. us-east-1) › us-east-1
? Environment name (e.g. production, staging) › production
? EC2 Instance ID (e.g. i-0abc123def456) › i-0abc123def456
? AWS_ACCESS_KEY_ID › ••••••••••••••••
? AWS_SECRET_ACCESS_KEY › ••••••••••••••••
? How do you want to provide the EC2 SSH key? › Path to key file
? Path to SSH private key file (e.g. ~/.ssh/id_rsa) › ~/.ssh/mykey.pem
? SSH username on EC2 instance (e.g. ec2-user, ubuntu) › ec2-user
```

After confirming the summary, the tool runs the full pipeline and reports:

```
✓ Deployed successfully
  Endpoint: http://ec2-54-123-45-67.compute-1.amazonaws.com
  Total time: 42.3s
```

---

## Deploy via Config File (unchanged)

The existing `carburetor.yml` + `--dockerfile` path continues to work as before:

```bash
carburetor deploy --dockerfile ./Dockerfile
```

With `carburetor.yml` containing:
```yaml
project:
  type: docker
  build:
    dockerfilePath: ./Dockerfile
target:
  platform: aws
  region: us-east-1
  environment: production
  resourceId: i-0abc123def456
```

---

## React App Wizard (updated — no directory prompt)

```bash
carburetor deploy --interactive
```

Select **React App**. The wizard no longer asks for a deployment directory — `/var/www/html` is used automatically.

---

## Error Scenarios

**Invalid Dockerfile path**:
```
? Dockerfile path (e.g. ./Dockerfile) › ./nonexistent
  Dockerfile not found: ./nonexistent
? Dockerfile path (e.g. ./Dockerfile) › _   ← re-prompted inline
```

**Redeployment** — run the wizard again with the same instance ID. The existing container is stopped and replaced automatically.

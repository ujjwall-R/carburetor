# CLI Contract: Docker Wizard Integration

**Feature**: `007-docker-cli-wizard-integration`  
**Date**: 2026-04-19

---

## No new CLI flags

The "`meg deploy`" command flags are unchanged. The `--dockerfile` flag (added in spec 006) continues to work with `megalodon.yml` exactly as before.

The change is entirely within the `--interactive` mode wizard flow.

---

## Interactive Wizard — Docker Project Type (new)

When "`meg deploy --interactive`" is used and the user selects **Docker Container**, the wizard collects:

1. Dockerfile path (validated: file must exist on disk)
2. Cloud platform (AWS)
3. Service type (EC2 Instance)
4. AWS region
5. Environment name
6. EC2 instance ID
7. AWS access key ID
8. AWS secret access key
9. SSH key mode (path or inline)
10. SSH key (path to file, or inline PEM content)
11. SSH username
12. Confirmation summary

No VCS token, repo URL, branch, or deploy directory is requested.  
Container always binds to port 80.

---

## Interactive Wizard — React App Change

The `Deploy directory` prompt is **removed** from the React App wizard path.  
`/var/www/html` is used automatically — no user input required.

---

## Example wizard session (Docker)

```
  megalodon — Interactive Deployment Wizard

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

┌─────────────────────────────────────┐
│ Deployment Summary                  │
│ Project type  : docker              │
│ Dockerfile    : ./Dockerfile        │
│ Cloud         : aws — ec2           │
│ Region        : us-east-1           │
│ Environment   : production          │
│ Instance ID   : i-0abc123def456     │
│ SSH user      : ec2-user            │
│ SSH key file  : ~/.ssh/mykey.pem    │
│ Port          : 80 (fixed)          │
└─────────────────────────────────────┘
? Proceed with deployment? › Yes
```

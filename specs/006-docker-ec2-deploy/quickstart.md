# Quickstart: Docker EC2 Deployment

**Feature**: `006-docker-ec2-deploy`  
**Date**: 2026-04-18

---

## Prerequisites

- Docker installed and running locally
- Docker installed and running on the target EC2 instance
- EC2 instance provisioned, running, and reachable via SSH on port 22
- AWS credentials with at least `ec2:DescribeInstances` permission
- SSH PEM key for the EC2 instance

---

## 1. Configure `carburetor.yml`

```yaml
project:
  type: docker
  build:
    dockerfilePath: ./Dockerfile
    containerPort: 3000

target:
  platform: aws
  region: us-east-1
  environment: production
  resourceId: i-0123456789abcdef0   # Your EC2 instance ID
```

---

## 2. Set Environment Variables

```bash
export carburetor_AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
export carburetor_AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export carburetor_EC2_SSH_KEY_PATH=/path/to/your-key.pem
export carburetor_EC2_SSH_USER=ec2-user       # default; omit if using ec2-user
```

---

## 3. Deploy

```bash
carburetor deploy
```

Or override the Dockerfile and port at the command line:

```bash
carburetor deploy --dockerfile ./services/api/Dockerfile --port 8080
```

---

## 4. Verify

The tool prints the container endpoint on success:

```
✓ Deployed successfully
  Endpoint: http://ec2-12-34-56-78.compute-1.amazonaws.com:3000
  Total time: 47.2s
```

Open the endpoint in a browser or curl it:

```bash
curl http://ec2-12-34-56-78.compute-1.amazonaws.com:3000
```

> Ensure your EC2 security group allows inbound TCP on the container port from your IP or `0.0.0.0/0`.

---

## 5. Redeploy After Code Changes

Run the same command again. The tool automatically stops and removes the previous container before starting the new one:

```bash
carburetor deploy --dockerfile ./Dockerfile --port 3000
```

---

## What the Tool Does (pipeline steps)

| Step | Runs On | What Happens |
|------|---------|--------------|
| Build Docker image | Local | `docker build` from your Dockerfile |
| Export image to archive | Local | `docker save \| gzip` into a temp file |
| Transfer archive | Local → EC2 | SCP to `/tmp/carburetor-artifact.tar.gz` on EC2 |
| Load image | EC2 | `docker load` from the archive |
| Stop existing container | EC2 | `docker rm -f carburetor-app` (safe no-op if none running) |
| Start container | EC2 | `docker run -d -p PORT:PORT --name carburetor-app` |

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `docker build` fails | Bad Dockerfile or missing files | Fix the Dockerfile; run `docker build` locally to confirm |
| SCP fails | Wrong SSH key or EC2 unreachable | Check `carburetor_EC2_SSH_KEY_PATH`, security groups, and EC2 state |
| `docker load` fails on EC2 | Docker not installed on EC2 | Install Docker: `sudo yum install docker && sudo systemctl start docker` |
| Container not reachable | Security group blocks the port | Add inbound rule for the container port in the EC2 security group |
| `i-xxx has no public DNS` | EC2 has no public IP | Assign an Elastic IP or enable auto-assign public IP in the subnet |

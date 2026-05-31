import * as path from 'path';
import { StepType } from '../../models/enums.js';
import type { BuildConfig } from '../../models/DeploymentRequest.js';
import type { PipelineStep } from '../../models/Pipeline.js';
import { BasePipelineOrchestration } from './BasePipelineOrchestration.js';

export class DockerOrchestration extends BasePipelineOrchestration {
  buildSteps(buildConfig: BuildConfig, _deployDir?: string): PipelineStep[] {
    const dockerfilePath = path.resolve(buildConfig.dockerfilePath!);

    return [
      {
        id: 'docker-copy',
        name: 'Prepare Dockerfile',
        type: StepType.Build,
        command: `cp ${dockerfilePath} artifact.tar.gz`,
      },
      {
        id: 'docker-install',
        name: 'Install Docker on EC2',
        type: StepType.Ship,
        command: `command -v docker >/dev/null 2>&1 || (sudo yum install -y docker 2>/dev/null || sudo apt-get install -y docker.io 2>/dev/null; sudo systemctl start docker 2>/dev/null; sudo service docker start 2>/dev/null; true)`,
      },
      {
        id: 'docker-build',
        name: 'Build Docker image on EC2',
        type: StepType.Ship,
        command: `sudo mkdir -p /tmp/megalodon-ctx && sudo docker build --no-cache -t megalodon-docker-image -f /tmp/megalodon-artifact.tar.gz /tmp/megalodon-ctx`,
      },
      {
        id: 'docker-stop',
        name: 'Free port 80 and remove old container',
        type: StepType.Ship,
        command: `sudo systemctl stop nginx 2>/dev/null || true && sudo docker rm -f megalodon-app 2>/dev/null || true`,
      },
      ...(buildConfig.domain && buildConfig.sslEmail ? [{
        id: 'certbot-install',
        name: 'Install Certbot',
        type: StepType.Ship,
        command: `command -v certbot >/dev/null 2>&1 || (sudo yum install -y python3-pip 2>/dev/null || sudo apt-get install -y python3-pip 2>/dev/null; sudo pip3 install certbot 2>/dev/null; true)`,
      }, {
        id: 'certbot-run',
        name: 'Obtain SSL certificate',
        type: StepType.Ship,
        command: `sudo test -f /etc/letsencrypt/live/${buildConfig.domain}/fullchain.pem || sudo certbot certonly --standalone -d ${buildConfig.domain} --non-interactive --agree-tos -m ${buildConfig.sslEmail}`,
      }] : []),
      {
        id: 'docker-run',
        name: 'Start container',
        type: StepType.Ship,
        command: buildConfig.domain && buildConfig.sslEmail
          ? `sudo docker run -d --restart unless-stopped -p 80:80 -p 443:443 -v /etc/letsencrypt:/etc/letsencrypt:ro --name megalodon-app megalodon-docker-image`
          : `sudo docker run -d --restart unless-stopped -p ${buildConfig.containerPort ?? 80}:${buildConfig.containerPort ?? 80} --name megalodon-app megalodon-docker-image`,
      },
    ];
  }
}

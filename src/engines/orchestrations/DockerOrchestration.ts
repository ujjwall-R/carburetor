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
        command: `sudo mkdir -p /tmp/carburetor-ctx && sudo docker build --no-cache -t carburetor-docker-image -f /tmp/carburetor-artifact.tar.gz /tmp/carburetor-ctx`,
      },
      {
        id: 'docker-stop',
        name: 'Free port 80 and remove old container',
        type: StepType.Ship,
        command: `sudo systemctl stop nginx 2>/dev/null || true && sudo docker rm -f carburetor-app 2>/dev/null || true`,
      },
      {
        id: 'docker-run',
        name: 'Start container',
        type: StepType.Ship,
        command: `sudo docker run -d --restart unless-stopped -p 80:80 --name carburetor-app carburetor-docker-image`,
      },
    ];
  }
}

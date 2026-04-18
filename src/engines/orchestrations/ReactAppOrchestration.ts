import { StepType } from '../../models/enums.js';
import type { BuildConfig } from '../../models/DeploymentRequest.js';
import type { PipelineStep } from '../../models/Pipeline.js';
import { BasePipelineOrchestration } from './BasePipelineOrchestration.js';

export class ReactAppOrchestration extends BasePipelineOrchestration {
  buildSteps(buildConfig: BuildConfig, deployDir = '/var/www/html'): PipelineStep[] {
    if (buildConfig.buildScript) {
      return [
        {
          id: 'custom-build',
          name: 'Run custom build script',
          type: StepType.Build,
          command: buildConfig.buildScript,
        },
      ];
    }

    return [
      {
        id: 'install-deps',
        name: 'Install dependencies',
        type: StepType.Build,
        command: 'npm ci',
      },
      {
        id: 'build-react',
        name: 'Build React application',
        type: StepType.Build,
        command: 'npm run build',
      },
      {
        id: 'package-artifact',
        name: 'Package build output',
        type: StepType.Package,
        command: this.buildPackageCommand(buildConfig.outputDir ?? 'dist'),
      },
      {
        id: 'ship',
        name: 'Deploy to server',
        type: StepType.Ship,
        command: [
          // Install nginx if missing — works on Amazon Linux (dnf/yum) and Debian/Ubuntu (apt)
          'command -v nginx >/dev/null 2>&1 || (' +
            'if command -v dnf >/dev/null 2>&1; then sudo dnf install nginx -y; ' +
            'elif command -v yum >/dev/null 2>&1; then sudo yum install nginx -y; ' +
            'else sudo apt-get install nginx -y; fi)',
          // Write carburetor nginx config: correct document root + SPA routing
          `printf 'server {\\n    listen 80 default_server;\\n    server_name _;\\n    root ${deployDir};\\n    index index.html;\\n    location / { try_files $uri $uri/ /index.html; }\\n}\\n' | sudo tee /etc/nginx/conf.d/carburetor.conf > /dev/null`,
          // Start and enable nginx
          'sudo systemctl enable nginx',
          'sudo systemctl start nginx',
          // Ensure deploy directory exists
          `sudo mkdir -p ${deployDir}`,
          // Clear old files before extracting so stale assets don't linger
          `sudo find ${deployDir} -mindepth 1 -delete`,
          // Extract artifact (strip top-level folder from the tar, e.g. build/ -> deployDir/)
          `sudo tar -xzf /tmp/carburetor-artifact.tar.gz --strip-components=1 -C ${deployDir}`,
          // Clean up
          `rm /tmp/carburetor-artifact.tar.gz`,
          // Validate config then reload nginx
          'sudo nginx -t && sudo systemctl reload nginx',
        ].join(' && '),
      },
    ];
  }
}

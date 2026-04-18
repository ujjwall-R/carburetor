import { readFileSync, writeFileSync, unlinkSync, mkdtempSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { CloudPlatform, StepType } from '../models/enums.js';
import type { DeploymentTarget, CSPCredentials } from '../models/DeploymentRequest.js';
import type { DeployableArtifact } from '../models/DeployableArtifact.js';
import type { PipelineStep } from '../models/Pipeline.js';
import type { ICSPAccess, DeploymentResult } from './ICSPAccess.js';

export class CSPAccess implements ICSPAccess {
  async validateCredentials(credentials: CSPCredentials, platform: CloudPlatform): Promise<boolean> {
    switch (platform) {
      case CloudPlatform.AWS:
      case CloudPlatform.Lambda: {
        try {
          const sts = this.buildSTSClient(credentials);
          await sts.send(new GetCallerIdentityCommand({}));
          return true;
        } catch {
          return false;
        }
      }
      default:
        throw new Error(`Platform not yet supported: ${platform}`);
    }
  }

  async deploy(
    artifact: DeployableArtifact,
    target: DeploymentTarget,
    credentials: CSPCredentials,
    steps: PipelineStep[]
  ): Promise<DeploymentResult> {
    switch (target.platform) {
      case CloudPlatform.AWS:
        return target.resourceId.startsWith('i-')
          ? this.deployToEC2(artifact, target, credentials, steps)
          : this.deployToS3(artifact, target, credentials);
      default:
        throw new Error(`Platform not yet supported: ${target.platform}`);
    }
  }

  getEndpoint(result: DeploymentResult): string {
    return result.endpoint;
  }

  private async deployToS3(
    artifact: DeployableArtifact,
    target: DeploymentTarget,
    credentials: CSPCredentials
  ): Promise<DeploymentResult> {
    const s3 = this.buildS3Client(credentials, target.region);
    const bucketName = target.resourceId;
    const key = `deploys/${Date.now()}/artifact.tar.gz`;

    await this.ensureBucketExists(s3, bucketName, target.region);

    const artifactContent = readFileSync(artifact.path);
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: artifactContent,
      ContentType: 'application/gzip',
    }));

    const endpoint = `https://${bucketName}.s3.${target.region}.amazonaws.com/${key}`;

    return {
      resourceId: `${bucketName}/${key}`,
      endpoint,
      platform: CloudPlatform.AWS,
    };
  }

  private async ensureBucketExists(s3: S3Client, bucketName: string, region: string): Promise<void> {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
      await s3.send(new CreateBucketCommand({
        Bucket: bucketName,
        ...(region !== 'us-east-1' ? {
          CreateBucketConfiguration: { LocationConstraint: region as import('@aws-sdk/client-s3').BucketLocationConstraint },
        } : {}),
      }));
    }
  }

  private async deployToEC2(
    artifact: DeployableArtifact,
    target: DeploymentTarget,
    credentials: CSPCredentials,
    steps: PipelineStep[]
  ): Promise<DeploymentResult> {
    const sshKey = credentials['sshKey'] as string | undefined;
    const sshKeyPath = credentials['sshKeyPath'] as string | undefined;
    if (!sshKey && !sshKeyPath) {
      throw new Error(
        'EC2 deployment requires an SSH key.\n' +
        '  Set CARBORATOR_EC2_SSH_KEY (PEM content) or CARBORATOR_EC2_SSH_KEY_PATH (path to PEM file).'
      );
    }

    const publicDns = await this.getEC2PublicDns(credentials, target.region, target.resourceId);
    const sshUser = String(credentials['sshUser'] ?? 'ec2-user');

    let keyFile = sshKeyPath ?? '';
    let tempKeyFile: string | undefined;
    if (sshKey) {
      const tmpDir = mkdtempSync(join(tmpdir(), 'carburetor-key-'));
      tempKeyFile = join(tmpDir, 'deploy.pem');
      writeFileSync(tempKeyFile, sshKey, { mode: 0o600 });
      keyFile = tempKeyFile;
    } else if (sshKeyPath) {
      try { chmodSync(sshKeyPath, 0o600); } catch { /* ignore if already correct */ }
    }

    try {
      const sshOpts = [
        '-i', keyFile,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
      ];

      // Transfer artifact
      await this.runCommand('scp', [
        ...sshOpts,
        artifact.path,
        `${sshUser}@${publicDns}:/tmp/carburetor-artifact.tar.gz`,
      ]);

      // Execute each Ship step on the remote host via SSH
      const shipSteps = steps.filter(s => s.type === StepType.Ship);
      for (const step of shipSteps) {
        if (step.command) {
          await this.runCommand('ssh', [...sshOpts, `${sshUser}@${publicDns}`, step.command]);
        }
      }
    } finally {
      if (tempKeyFile) {
        try { unlinkSync(tempKeyFile); } catch { /* ignore */ }
      }
    }

    return {
      resourceId: target.resourceId,
      endpoint: `http://${publicDns}`,
      platform: CloudPlatform.AWS,
    };
  }

  private async getEC2PublicDns(
    credentials: CSPCredentials,
    region: string,
    instanceId: string
  ): Promise<string> {
    const sessionToken = credentials['sessionToken'];
    const ec2 = new EC2Client({
      region,
      credentials: {
        accessKeyId: String(credentials['accessKeyId']),
        secretAccessKey: String(credentials['secretAccessKey']),
        ...(sessionToken ? { sessionToken: String(sessionToken) } : {}),
      },
    });

    const response = await ec2.send(new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    }));

    const instance = response.Reservations?.[0]?.Instances?.[0];
    const dns = instance?.PublicDnsName ?? instance?.PublicIpAddress;
    if (!dns) {
      throw new Error(
        `EC2 instance ${instanceId} has no public DNS or IP. ` +
        'Ensure the instance has a public IP assigned and is in a public subnet.'
      );
    }
    return dns;
  }

  private runCommand(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${cmd} exited with code ${code}`));
      });
      child.on('error', (err) => reject(new Error(`Failed to run ${cmd}: ${err.message}`)));
    });
  }

  private buildSTSClient(credentials: CSPCredentials): STSClient {
    const sessionToken = credentials['sessionToken'];
    return new STSClient({
      credentials: {
        accessKeyId: String(credentials['accessKeyId']),
        secretAccessKey: String(credentials['secretAccessKey']),
        ...(sessionToken ? { sessionToken: String(sessionToken) } : {}),
      },
    });
  }

  private buildS3Client(credentials: CSPCredentials, region: string): S3Client {
    const sessionToken = credentials['sessionToken'];
    return new S3Client({
      region,
      credentials: {
        accessKeyId: String(credentials['accessKeyId']),
        secretAccessKey: String(credentials['secretAccessKey']),
        ...(sessionToken ? { sessionToken: String(sessionToken) } : {}),
      },
    });
  }
}

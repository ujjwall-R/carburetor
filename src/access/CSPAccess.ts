import { readFileSync } from 'fs';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { CloudPlatform } from '../models/enums.js';
import type { DeploymentTarget, CSPCredentials } from '../models/DeploymentRequest.js';
import type { DeployableArtifact } from '../models/DeployableArtifact.js';
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
    credentials: CSPCredentials
  ): Promise<DeploymentResult> {
    switch (target.platform) {
      case CloudPlatform.AWS:
        return this.deployToS3(artifact, target, credentials);
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

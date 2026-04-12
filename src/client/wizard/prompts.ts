import { ProjectType, VCSProvider, CloudPlatform } from '../../models/enums.js';

export const PROJECT_TYPE_OPTIONS = [
  { value: ProjectType.ReactApp, label: 'React App' },
  { value: ProjectType.Custom,   label: 'Other (experimental)' },
] as const;

export const VCS_PROVIDER_OPTIONS = [
  { value: VCSProvider.GitHub, label: 'GitHub' },
] as const;

export const CLOUD_PLATFORM_OPTIONS = [
  { value: CloudPlatform.AWS, label: 'AWS' },
] as const;

export const AWS_SERVICE_OPTIONS = [
  { value: 'ec2', label: 'EC2 Instance' },
] as const;

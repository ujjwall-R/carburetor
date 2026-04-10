import type { VCSProvider } from './enums.js';

export interface SourceMetadata {
  provider: VCSProvider;
  repoUrl: string;
  branch: string;
  commitHash: string;
  fetchedAt: string;
}

export interface SourceArtifact {
  localPath: string;
  metadata: SourceMetadata;
}

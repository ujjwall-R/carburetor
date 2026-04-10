import type { ProjectType } from './enums.js';

export interface DeployableArtifact {
  path: string;
  type: ProjectType;
  buildMetadata: Record<string, string>;
  builtAt: string;
}

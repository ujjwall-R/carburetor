export interface JenkinsConfig {
  baseUrl: string;
  jobName: string;
  token: string;
  waitForCompletion: boolean;
  pollIntervalMs: number;
}

export interface TemporalConfig {
  address: string;
  namespace: string;
  taskQueue: string;
  waitForCompletion: boolean;
}

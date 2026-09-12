export interface PullRequestAnalysisJob {
  installationId: number;
  repositoryId: number;
  owner: string;
  repo: string;
  pullRequestNumber: number;
  pullRequestId: number;
  baseSha: string;
  headSha: string;
  draft?: boolean;
}

export interface AnalysisQueue {
  enqueue(job: PullRequestAnalysisJob): Promise<void>;
}

export interface AnalysisIdentity {
  repositoryId: number;
  pullRequestNumber: number;
  baseSha: string;
  headSha: string;
}

export function analysisIdentityKey(identity: AnalysisIdentity): string {
  return `${identity.repositoryId}:${identity.pullRequestNumber}:${identity.baseSha}:${identity.headSha}`;
}

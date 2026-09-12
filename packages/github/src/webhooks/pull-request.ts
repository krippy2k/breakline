import type { PullRequestAnalysisJob } from "../types/jobs.js";
import type { NormalizedEvent } from "../types/github-events.js";

export function createAnalysisJob(event: Extract<NormalizedEvent, { kind: "pull_request" }>): PullRequestAnalysisJob {
  return {
    installationId: event.installationId,
    repositoryId: event.repository.id,
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pullRequestNumber: event.pullRequest.number,
    pullRequestId: event.pullRequest.id,
    baseSha: event.pullRequest.base.sha,
    headSha: event.pullRequest.head.sha,
    draft: Boolean(event.pullRequest.draft),
  };
}

export function shouldAnalyzePullRequest(event: Extract<NormalizedEvent, { kind: "pull_request" }>): boolean {
  return Boolean(event.pullRequest.base.sha && event.pullRequest.head.sha && event.installationId);
}

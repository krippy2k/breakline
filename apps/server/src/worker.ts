import {
  createGitHubClient,
  GitRepositoryProvider,
  runPullRequestAnalysis,
  type AnalysisRunnerOptions,
  type GitHubClient,
  type PullRequestAnalysisJob,
  type RepositoryProvider,
} from "@breakline/github";
import type { Logger } from "./log.js";
import type { Metrics } from "./metrics.js";
import type { Store } from "./store.js";

export interface WorkerOptions {
  store: Store;
  getToken: (installationId: number) => Promise<string>;
  createClient?: (token: string) => GitHubClient;
  checkout?: RepositoryProvider;
  analyze?: AnalysisRunnerOptions["analyze"];
  baseUrl: string;
  logger: Logger;
  metrics: Metrics;
}

export function createWorker(options: WorkerOptions) {
  const checkout = options.checkout ?? new GitRepositoryProvider();
  const createClient = options.createClient ?? ((token: string) => createGitHubClient({ token }));

  return async function processJob(job: PullRequestAnalysisJob): Promise<void> {
    const started = Date.now();
    options.metrics.increment("analyses_started_total");
    await options.store.upsertPullRequest({
      repositoryId: job.repositoryId,
      githubPullRequestId: job.pullRequestId,
      number: job.pullRequestNumber,
      baseSha: job.baseSha,
      headSha: job.headSha,
    });
    const token = await options.getToken(job.installationId);
    const analysis = await runPullRequestAnalysis(job, {
      store: options.store,
      github: createClient(token),
      checkout,
      getToken: async () => token,
      analyze: options.analyze,
      reportUrl: (record) =>
        `${options.baseUrl}/r/github/${job.owner}/${job.repo}/pull/${job.pullRequestNumber}/analysis/${record.id}`,
      logger: options.logger,
    });
    options.metrics.observe("analysis_duration_ms", Date.now() - started);
    if (analysis.status === "failed") {
      options.metrics.increment("analyses_failed_total");
    } else if (analysis.status === "completed") {
      options.metrics.increment("analyses_completed_total");
      options.metrics.observe("findings_per_analysis", analysis.report?.summary.findingCount ?? 0);
    }
  };
}

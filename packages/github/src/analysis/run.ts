import { analyze, DEFAULT_CONFIG, loadConfig, type AnalysisRequest, type BreaklineReport } from "@breakline/report";
import type { GitHubClient } from "../api/client.js";
import { createOrUpdateComment } from "../api/comments.js";
import { annotationsForReport } from "../render/annotations.js";
import { CHECK_NAME, renderCheckSummary, renderFailureSummary, renderProgressSummary } from "../render/check-summary.js";
import { renderPullRequestComment } from "../render/comment.js";
import { conclusionForReport, titleForFailure, titleForReport } from "../render/conclusion.js";
import type { PullRequestAnalysisJob } from "../types/jobs.js";
import { createErrorId } from "./error-id.js";
import type { RepositoryProvider } from "./repository-fetch.js";
import { isStaleHead } from "./stale.js";
import { withTimeout } from "./timeout.js";
import type { AnalysisRecord, AnalysisStore, StructuredLogger } from "./types.js";

export interface AnalysisRunnerOptions {
  store: AnalysisStore;
  github: GitHubClient;
  checkout: RepositoryProvider;
  getToken: () => Promise<string>;
  analyze?: (request: AnalysisRequest) => Promise<BreaklineReport>;
  reportUrl: (analysis: AnalysisRecord, job: PullRequestAnalysisJob) => string | undefined;
  logger: StructuredLogger;
  now?: () => Date;
}

export async function runPullRequestAnalysis(
  job: PullRequestAnalysisJob,
  options: AnalysisRunnerOptions,
): Promise<AnalysisRecord> {
  const now = () => options.now?.() ?? new Date();
  await options.store.cancelQueued(job.repositoryId, job.pullRequestNumber, job.headSha);

  const existing = await options.store.findByIdentity({
    repositoryId: job.repositoryId,
    pullRequestNumber: job.pullRequestNumber,
    baseSha: job.baseSha,
    headSha: job.headSha,
  });
  if (existing && (existing.status === "completed" || existing.status === "analyzing" || existing.status === "publishing")) {
    options.logger.info("analysis_skipped_duplicate", fields(job, existing.id));
    return existing;
  }

  const analysis: AnalysisRecord = existing ?? {
    id: cryptoRandomId(),
    repositoryId: job.repositoryId,
    pullRequestId: job.pullRequestId,
    pullRequestNumber: job.pullRequestNumber,
    baseSha: job.baseSha,
    headSha: job.headSha,
    status: "queued",
    createdAt: now().toISOString(),
  };
  analysis.startedAt = now().toISOString();
  analysis.status = "fetching";
  await options.store.save(analysis);
  await options.store.setCurrentHeadSha(job.repositoryId, job.pullRequestNumber, job.headSha);

  const startedAt = now().toISOString();
  const check = await options.github.createCheckRun({
    owner: job.owner,
    repo: job.repo,
    name: CHECK_NAME,
    headSha: job.headSha,
    status: "in_progress",
    startedAt,
    output: {
      title: "Breakline analysis",
      summary: renderProgressSummary(),
    },
  });
  analysis.checkRunId = check.id;
  await options.store.update(analysis.id, { checkRunId: check.id, status: "fetching", startedAt });

  let checkout: Awaited<ReturnType<RepositoryProvider["checkout"]>> | undefined;
  try {
    if (await stale(job, options.store)) {
      analysis.status = "cancelled";
      await options.store.update(analysis.id, { status: "cancelled", completedAt: now().toISOString() });
      return analysis;
    }

    const token = await options.getToken();
    checkout = await options.checkout.checkout({
      analysisId: analysis.id,
      owner: job.owner,
      repo: job.repo,
      baseSha: job.baseSha,
      headSha: job.headSha,
      pullRequestNumber: job.pullRequestNumber,
      token,
      maxCheckoutBytes: DEFAULT_CONFIG.analysis.maxCheckoutBytes,
    });

    const config = await loadConfig(checkout.path);
    if (!config.github.enabled || (job.draft && !config.github.analyzeDrafts)) {
      const skipped = await finishSkipped(analysis, job, options, check.id, startedAt, now);
      return skipped;
    }

    analysis.status = "analyzing";
    await options.store.update(analysis.id, { status: "analyzing" });
    options.logger.info("analysis_started", fields(job, analysis.id));

    const report = await withTimeout(
      (options.analyze ?? analyze)({
        repositoryPath: checkout.path,
        baseRevision: job.baseSha,
        headRevision: job.headSha,
        analysisId: analysis.id,
        config,
      }),
      config.analysis.maxDurationMs,
      "Breakline analysis",
    );

    if (await stale(job, options.store)) {
      analysis.status = "cancelled";
      analysis.report = report;
      await options.store.update(analysis.id, {
        status: "cancelled",
        report,
        completedAt: now().toISOString(),
      });
      options.logger.info("analysis_suppressed_stale", fields(job, analysis.id));
      return analysis;
    }

    analysis.status = "publishing";
    analysis.report = report;
    analysis.impact = report.summary.impact;
    await options.store.update(analysis.id, { status: "publishing", report, impact: report.summary.impact });

    const detailsUrl = options.reportUrl(analysis, job);
    await options.github.updateCheckRun({
      owner: job.owner,
      repo: job.repo,
      checkRunId: check.id,
      status: "completed",
      conclusion: conclusionForReport(report),
      completedAt: now().toISOString(),
      detailsUrl,
      output: {
        title: titleForReport(report),
        summary: renderCheckSummary(report, {
          reportUrl: detailsUrl,
          maxFindings: config.report.maxGithubFindings,
        }),
        annotations: annotationsForReport(report, config),
      },
    });

    if (config.github.comment) {
      await createOrUpdateComment(options.github, {
        owner: job.owner,
        repo: job.repo,
        number: job.pullRequestNumber,
        body: renderPullRequestComment(report, { reportUrl: detailsUrl }),
      });
    }

    analysis.status = "completed";
    analysis.completedAt = now().toISOString();
    await options.store.update(analysis.id, { status: "completed", completedAt: analysis.completedAt });
    options.logger.info("analysis_completed", {
      ...fields(job, analysis.id),
      status: "completed",
      findings: report.summary.findingCount,
    });
    return analysis;
  } catch (error) {
    const errorId = createErrorId();
    const reason = publicReason(error);
    analysis.status = "failed";
    analysis.errorId = errorId;
    analysis.errorReason = reason;
    analysis.completedAt = now().toISOString();
    await options.store.update(analysis.id, {
      status: "failed",
      errorId,
      errorReason: reason,
      completedAt: analysis.completedAt,
    });
    if (analysis.checkRunId) {
      await options.github.updateCheckRun({
        owner: job.owner,
        repo: job.repo,
        checkRunId: analysis.checkRunId,
        status: "completed",
        conclusion: "failure",
        completedAt: analysis.completedAt,
        output: {
          title: titleForFailure(),
          summary: renderFailureSummary({ reason, errorId }),
        },
      });
    }
    options.logger.error("analysis_failed", { ...fields(job, analysis.id), error_id: errorId });
    return analysis;
  } finally {
    if (checkout) {
      await checkout.cleanup();
    }
  }
}

async function finishSkipped(
  analysis: AnalysisRecord,
  job: PullRequestAnalysisJob,
  options: AnalysisRunnerOptions,
  checkRunId: number,
  startedAt: string,
  now: () => Date,
): Promise<AnalysisRecord> {
  const completedAt = now().toISOString();
  await options.github.updateCheckRun({
    owner: job.owner,
    repo: job.repo,
    checkRunId,
    status: "completed",
    conclusion: "success",
    completedAt,
    output: {
      title: "Breakline skipped",
      summary: "Breakline is disabled for this pull request.",
    },
  });
  analysis.status = "completed";
  analysis.completedAt = completedAt;
  await options.store.update(analysis.id, { status: "completed", completedAt, startedAt });
  return analysis;
}

async function stale(job: PullRequestAnalysisJob, store: AnalysisStore): Promise<boolean> {
  const current = await store.getCurrentHeadSha(job.repositoryId, job.pullRequestNumber);
  return isStaleHead(job.headSha, current);
}

function fields(job: PullRequestAnalysisJob, analysisId: string): Record<string, unknown> {
  return {
    analysis_id: analysisId,
    installation_id: job.installationId,
    repository_id: job.repositoryId,
    pull_request_number: job.pullRequestNumber,
    base_sha: job.baseSha,
    head_sha: job.headSha,
  };
}

function publicReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "Analysis failed";
  if (/fetch|checkout|clone|remote/i.test(message)) {
    return "Repository fetch failed.";
  }
  if (/timed out/i.test(message)) {
    return "Analysis exceeded the configured time limit.";
  }
  if (/size limit/i.test(message)) {
    return "Repository checkout exceeded the configured size limit.";
  }
  return "Analysis failed.";
}

function cryptoRandomId(): string {
  return globalThis.crypto.randomUUID();
}

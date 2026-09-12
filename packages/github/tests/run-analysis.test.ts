import { describe, expect, it } from "vitest";
import type { BreaklineReport } from "@breakline/report";
import { runPullRequestAnalysis } from "../src/analysis/run.js";
import type { AnalysisRecord, AnalysisStore } from "../src/analysis/types.js";
import type { GitHubClient } from "../src/api/client.js";
import type { PullRequestAnalysisJob } from "../src/types/jobs.js";

class MemoryAnalysisStore implements AnalysisStore {
  records = new Map<string, AnalysisRecord>();
  heads = new Map<string, string>();

  async findByIdentity(input: { repositoryId: number; pullRequestNumber: number; baseSha: string; headSha: string }) {
    return [...this.records.values()].find(
      (item) =>
        item.repositoryId === input.repositoryId &&
        item.pullRequestNumber === input.pullRequestNumber &&
        item.baseSha === input.baseSha &&
        item.headSha === input.headSha,
    );
  }
  async get(id: string) {
    return this.records.get(id);
  }
  async save(record: AnalysisRecord) {
    this.records.set(record.id, { ...record });
  }
  async update(id: string, patch: Partial<AnalysisRecord>) {
    const current = this.records.get(id);
    if (current) {
      this.records.set(id, { ...current, ...patch });
    }
  }
  async getCurrentHeadSha(repositoryId: number, pullRequestNumber: number) {
    return this.heads.get(`${repositoryId}:${pullRequestNumber}`);
  }
  async setCurrentHeadSha(repositoryId: number, pullRequestNumber: number, headSha: string) {
    this.heads.set(`${repositoryId}:${pullRequestNumber}`, headSha);
  }
  async cancelQueued(repositoryId: number, pullRequestNumber: number, exceptHeadSha: string) {
    for (const record of this.records.values()) {
      if (
        record.repositoryId === repositoryId &&
        record.pullRequestNumber === pullRequestNumber &&
        record.headSha !== exceptHeadSha &&
        record.status === "queued"
      ) {
        record.status = "cancelled";
      }
    }
  }
}

function report(): BreaklineReport {
  return {
    schemaVersion: "0.4",
    analysis: {
      id: "a1",
      baseRevision: "aaa",
      headRevision: "bbb",
      startedAt: "2026-09-11T18:00:00.000Z",
      completedAt: "2026-09-11T18:00:01.000Z",
      filesAnalyzed: 1,
      functionsCompared: 1,
    },
    summary: {
      impact: "high",
      findingCount: 1,
      highConfidenceCount: 1,
      byCategory: { authorization: 1 },
      bySeverity: { high: 1 },
    },
    findings: [
      {
        id: "1",
        category: "authorization",
        severity: "high",
        confidence: "high",
        title: "Authorization predicate widened",
        description: "Support can authorize",
        symbol: "authorizePayment",
        location: { path: "src/auth.ts", startLine: 10 },
      },
    ],
    metadata: { source: "core" },
  };
}

function job(overrides: Partial<PullRequestAnalysisJob> = {}): PullRequestAnalysisJob {
  return {
    installationId: 42,
    repositoryId: 99,
    owner: "acme",
    repo: "payments",
    pullRequestNumber: 184,
    pullRequestId: 500,
    baseSha: "aaa",
    headSha: "bbb",
    ...overrides,
  };
}

describe("runPullRequestAnalysis", () => {
  it("creates an in-progress check and completes it with the structured report", async () => {
    const store = new MemoryAnalysisStore();
    const checks: unknown[] = [];
    const github = fakeGitHub(checks);
    const result = await runPullRequestAnalysis(job(), {
      store,
      github,
      checkout: {
        async checkout() {
          return { path: "/tmp/repo", cleanup: async () => undefined };
        },
      },
      getToken: async () => "token",
      analyze: async () => report(),
      reportUrl: (analysis) => `https://app.breakline.dev/r/${analysis.id}`,
      logger: silentLogger(),
    });

    expect(result.status).toBe("completed");
    expect(result.checkRunId).toBe(77);
    expect(result.impact).toBe("high");
    expect(checks[0]).toMatchObject({ status: "in_progress" });
    expect(checks[1]).toMatchObject({ status: "completed", conclusion: "neutral" });
    expect(JSON.stringify(checks[1])).toContain("Authorization predicate widened");
    expect(JSON.stringify(checks[1])).toContain("https://app.breakline.dev/r/");
  });

  it("does not publish an older head over a newer one", async () => {
    const store = new MemoryAnalysisStore();
    const checks: unknown[] = [];
    const github = fakeGitHub(checks);
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });

    const older = runPullRequestAnalysis(job({ headSha: "old" }), {
      store,
      github,
      checkout: {
        async checkout() {
          await started;
          return { path: "/tmp/repo", cleanup: async () => undefined };
        },
      },
      getToken: async () => "token",
      analyze: async () => report(),
      reportUrl: () => undefined,
      logger: silentLogger(),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    await store.setCurrentHeadSha(99, 184, "new");
    release();
    const result = await older;
    expect(result.status).toBe("cancelled");
    expect(checks.some((item) => JSON.stringify(item).includes("completed") && JSON.stringify(item).includes("neutral"))).toBe(
      false,
    );
  });

  it("marks analysis failures as failed checks without leaking internals", async () => {
    const store = new MemoryAnalysisStore();
    const checks: unknown[] = [];
    const result = await runPullRequestAnalysis(job(), {
      store,
      github: fakeGitHub(checks),
      checkout: {
        async checkout() {
          throw new Error("git fetch failed bearer ghs_secret");
        },
      },
      getToken: async () => "token",
      reportUrl: () => undefined,
      logger: silentLogger(),
    });
    expect(result.status).toBe("failed");
    expect(result.errorId).toMatch(/^BL-/);
    expect(JSON.stringify(checks.at(-1))).toContain("failure");
    expect(JSON.stringify(checks.at(-1))).toContain("Repository fetch failed.");
    expect(JSON.stringify(checks.at(-1))).not.toContain("ghs_secret");
  });
});

function fakeGitHub(checks: unknown[]): GitHubClient {
  return {
    async createCheckRun(input) {
      checks.push(input);
      return { id: 77, name: "Breakline", head_sha: input.headSha, status: input.status };
    },
    async updateCheckRun(input) {
      checks.push(input);
    },
    async getPullRequest() {
      return { id: 1, number: 1, draft: false, state: "open", baseSha: "a", headSha: "b", title: "t" };
    },
    async listIssueComments() {
      return [];
    },
    async createIssueComment() {
      return { id: 1, body: "" };
    },
    async updateIssueComment() {},
    async getInstallationAccount() {
      return { login: "acme", id: 1 };
    },
    async listInstallationRepositories() {
      return [];
    },
  };
}

function silentLogger() {
  return { info() {}, warn() {}, error() {} };
}

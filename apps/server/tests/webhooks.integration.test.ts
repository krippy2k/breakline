import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { BreaklineReport } from "@breakline/report";
import { createHttpServer } from "../src/http.js";
import type { Logger } from "../src/log.js";
import { Metrics } from "../src/metrics.js";
import { InProcessQueue } from "../src/queue.js";
import { MemoryStore } from "../src/store.js";
import { createWorker } from "../src/worker.js";
import type { GitHubClient } from "@breakline/github";

const secret = "webhook-secret";

describe("GitHub webhook integration", () => {
  it("accepts a pull_request.opened webhook, analyzes, and updates the same check run", async () => {
    const { server, store, checks, comments } = startHarness();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const payload = prPayload("opened", "aaa1111", "bbb2222");
    const response = await post(port, payload, "d-open");
    expect(response.status).toBe(202);
    expect(checks).toHaveLength(2);
    expect(checks[0]).toMatchObject({ status: "in_progress", headSha: "bbb2222" });
    expect(checks[1]).toMatchObject({ status: "completed", conclusion: "neutral", checkRunId: 77 });
    expect(JSON.stringify(checks[1])).toContain("Authorization predicate widened");
    expect(JSON.stringify(checks[1])).toContain("/r/github/acme/payments/pull/184/analysis/");
    expect(store.analyses.size).toBe(1);
    expect(comments).toHaveLength(0);

    const analysis = [...store.analyses.values()][0]!;
    const page = await fetch(`http://127.0.0.1:${port}/r/github/acme/payments/pull/184/analysis/${analysis.id}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Behavioral Impact: HIGH");
    expect(html).toContain("Authorization predicate widened");
    server.close();
  });

  it("re-analyzes synchronize with a new head SHA and does not overwrite newer results", async () => {
    const { server, store, checks } = startHarness();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    await post(port, prPayload("opened", "aaa1111", "bbb2222"), "d-open");
    await post(port, prPayload("synchronize", "aaa1111", "ccc3333"), "d-sync");
    expect(store.analyses.size).toBe(2);
    const heads = [...store.analyses.values()].map((item) => item.headSha).sort();
    expect(heads).toEqual(["bbb2222", "ccc3333"]);
    const latest = [...store.analyses.values()].find((item) => item.headSha === "ccc3333");
    expect(latest?.status).toBe("completed");
    expect(store.pullRequests.get("99:184")?.headSha).toBe("ccc3333");
    expect(checks.filter((item) => "headSha" in item && item.headSha === "ccc3333").length).toBeGreaterThan(0);
    server.close();
  });

  it("ignores duplicate deliveries", async () => {
    const { server, store } = startHarness();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const payload = prPayload("opened", "aaa1111", "bbb2222");
    await post(port, payload, "same");
    const second = await post(port, payload, "same");
    expect(second.body).toMatchObject({ ok: true, duplicate: true });
    expect(store.analyses.size).toBe(1);
    server.close();
  });
});

function startHarness(): {
  server: Server;
  store: MemoryStore;
  checks: Array<Record<string, unknown>>;
  comments: Array<Record<string, unknown>>;
} {
  const store = new MemoryStore();
  const checks: Array<Record<string, unknown>> = [];
  const comments: Array<Record<string, unknown>> = [];
  const worker = createWorker({
    store,
    getToken: async () => "token",
    createClient: () => fakeGitHub(checks, comments),
    checkout: {
      async checkout() {
        return { path: process.cwd(), cleanup: async () => undefined };
      },
    },
    analyze: async (request) => sampleReport(request.analysisId ?? "a", request.baseRevision, request.headRevision),
    baseUrl: "http://127.0.0.1",
    logger: silentLogger(),
    metrics: new Metrics(),
  });
  const queue = new InProcessQueue(worker, true);
  const server = createHttpServer({
    secret,
    store,
    queue,
    logger: silentLogger(),
    metrics: new Metrics(),
  });
  server.listen(0);
  return { server, store, checks, comments };
}

function fakeGitHub(checks: Array<Record<string, unknown>>, comments: Array<Record<string, unknown>>): GitHubClient {
  return {
    async createCheckRun(input) {
      checks.push(input as unknown as Record<string, unknown>);
      return { id: 77, name: "Breakline", head_sha: input.headSha, status: input.status };
    },
    async updateCheckRun(input) {
      checks.push(input as unknown as Record<string, unknown>);
    },
    async getPullRequest() {
      return { id: 500, number: 184, draft: false, state: "open", baseSha: "aaa", headSha: "bbb", title: "t" };
    },
    async listIssueComments() {
      return comments.map((item, index) => ({ id: index + 1, body: String(item.body ?? "") }));
    },
    async createIssueComment(_o, _r, _n, body) {
      comments.push({ body });
      return { id: comments.length, body };
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

function prPayload(action: string, baseSha: string, headSha: string) {
  const repository = {
    id: 99,
    name: "payments",
    full_name: "acme/payments",
    private: true,
    owner: { id: 1, login: "acme" },
  };
  return {
    action,
    number: 184,
    pull_request: {
      id: 500,
      number: 184,
      draft: false,
      state: "open",
      base: { sha: baseSha, ref: "main", repo: repository },
      head: { sha: headSha, ref: "feature", repo: repository },
    },
    repository,
    installation: { id: 42 },
  };
}

async function post(port: number, payload: unknown, deliveryId: string): Promise<{ status: number; body: unknown }> {
  const raw = JSON.stringify(payload);
  const response = await fetch(`http://127.0.0.1:${port}/api/github/webhooks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "pull_request",
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`,
    },
    body: raw,
  });
  return { status: response.status, body: await response.json() };
}

function silentLogger(): Logger {
  return { info() {}, warn() {}, error() {} };
}

function sampleReport(id: string, base: string, head: string): BreaklineReport {
  return {
    schemaVersion: "0.4",
    analysis: {
      id,
      baseRevision: base,
      headRevision: head,
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
        description: "Support can authorize payments",
        symbol: "authorizePayment",
        location: { path: "src/auth/payment.ts", startLine: 84 },
      },
    ],
    metadata: { source: "core" },
  };
}

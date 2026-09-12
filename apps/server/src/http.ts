import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleWebhook, type AnalysisQueue } from "@breakline/github";
import type { Logger } from "./log.js";
import type { Metrics } from "./metrics.js";
import type { Store } from "./store.js";
import { renderReportPage } from "./views/report.js";
import { renderSetupPage } from "./views/setup.js";

export interface HttpOptions {
  secret: string;
  store: Store;
  queue: AnalysisQueue;
  logger: Logger;
  metrics: Metrics;
  loadInstallation?: (installationId: number) => Promise<{
    account: string;
    repositories: Array<{ name: string }>;
  }>;
}

export function createHttpServer(options: HttpOptions) {
  return createServer((req, res) => {
    void route(req, res, options);
  });
}

async function route(req: IncomingMessage, res: ServerResponse, options: HttpOptions): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, metrics: options.metrics.snapshot() });
    }
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, { ok: true, service: "breakline" });
    }
    if (req.method === "POST" && url.pathname === "/api/github/webhooks") {
      return webhook(req, res, options);
    }
    if (req.method === "GET" && url.pathname.startsWith("/r/github/")) {
      return report(url, res, options);
    }
    if (req.method === "GET" && (url.pathname === "/github/setup" || url.pathname === "/setup")) {
      return setup(url, res, options);
    }
    send(res, 404, { ok: false, error: "not_found" });
  } catch (error) {
    options.logger.error("http_error", { error: error instanceof Error ? error.message : "unknown" });
    send(res, 500, { ok: false, error: "internal" });
  }
}

async function webhook(req: IncomingMessage, res: ServerResponse, options: HttpOptions): Promise<void> {
  options.metrics.increment("webhooks_received_total");
  const rawBody = await readBody(req);
  const result = await handleWebhook(
    {
      rawBody,
      event: header(req, "x-github-event") ?? "",
      deliveryId: header(req, "x-github-delivery") ?? "",
      signature: header(req, "x-hub-signature-256"),
    },
    { secret: options.secret, store: options.store, queue: options.queue },
  );
  if (result.status >= 400) {
    options.metrics.increment("webhooks_rejected_total");
  }
  if (result.job) {
    await options.store.upsertPullRequest({
      repositoryId: result.job.repositoryId,
      githubPullRequestId: result.job.pullRequestId,
      number: result.job.pullRequestNumber,
      baseSha: result.job.baseSha,
      headSha: result.job.headSha,
    });
  }
  send(res, result.status, result.body);
}

async function report(url: URL, res: ServerResponse, options: HttpOptions): Promise<void> {
  const match = url.pathname.match(/^\/r\/github\/([^/]+)\/([^/]+)\/pull\/(\d+)\/analysis\/([^/]+)$/);
  if (!match) {
    send(res, 404, { ok: false, error: "not_found" });
    return;
  }
  const [, owner, repo, pr, id] = match;
  const analysis = await options.store.getAnalysis(id!);
  if (!analysis || !analysis.report) {
    send(res, 404, { ok: false, error: "not_found" });
    return;
  }
  html(res, 200, renderReportPage({ owner: owner!, repo: repo!, pullRequest: Number(pr), analysis }));
}

async function setup(url: URL, res: ServerResponse, options: HttpOptions): Promise<void> {
  const installationId = Number.parseInt(url.searchParams.get("installation_id") ?? "", 10);
  if (!Number.isFinite(installationId)) {
    html(res, 200, renderSetupPage({ account: "unknown", repositories: [] }));
    return;
  }
  const stored = await options.store.getInstallation(installationId);
  const repos = await options.store.listRepositories(installationId);
  if (stored) {
    html(
      res,
      200,
      renderSetupPage({
        account: stored.githubAccountLogin,
        repositories: repos.map((repo) => ({ name: repo.name })),
      }),
    );
    return;
  }
  if (options.loadInstallation) {
    const live = await options.loadInstallation(installationId);
    html(res, 200, renderSetupPage(live));
    return;
  }
  html(res, 200, renderSetupPage({ account: "unknown", repositories: [] }));
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function html(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

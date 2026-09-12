import { normalizeEvent } from "./normalize.js";
import { createAnalysisJob } from "./pull-request.js";
import { installationFromEvent, repositoriesFromEvent } from "./installation.js";
import { verifyWebhookSignature } from "./verify-signature.js";
import type { AnalysisQueue, PullRequestAnalysisJob } from "../types/jobs.js";
import type { NormalizedEvent } from "../types/github-events.js";

export interface DeliveryRecord {
  githubDeliveryId: string;
  eventType: string;
  status: "received" | "processed" | "ignored" | "duplicate";
  receivedAt: string;
  processedAt?: string;
}

export interface WebhookStore {
  getDelivery(id: string): Promise<DeliveryRecord | undefined>;
  saveDelivery(record: DeliveryRecord): Promise<void>;
  upsertInstallation(input: ReturnType<typeof installationFromEvent>["installation"]): Promise<void>;
  replaceInstallationRepositories(
    installationId: number,
    repositories: ReturnType<typeof installationFromEvent>["repositories"],
  ): Promise<void>;
  addRepositories(
    installationId: number,
    repositories: ReturnType<typeof repositoriesFromEvent>["added"],
  ): Promise<void>;
  removeRepositories(installationId: number, repositoryIds: number[]): Promise<void>;
}

export interface WebhookHandlerOptions {
  secret: string;
  store: WebhookStore;
  queue: AnalysisQueue;
  now?: () => Date;
}

export interface WebhookRequest {
  rawBody: Buffer | string;
  event: string;
  deliveryId: string;
  signature?: string | null;
}

export interface WebhookResult {
  status: number;
  body: { ok: boolean; duplicate?: boolean; ignored?: boolean };
  job?: PullRequestAnalysisJob;
}

export async function handleWebhook(request: WebhookRequest, options: WebhookHandlerOptions): Promise<WebhookResult> {
  if (!request.deliveryId) {
    return { status: 400, body: { ok: false } };
  }
  if (!verifyWebhookSignature({ rawBody: request.rawBody, signature: request.signature, secret: options.secret })) {
    return { status: 401, body: { ok: false } };
  }

  const existing = await options.store.getDelivery(request.deliveryId);
  if (existing) {
    return { status: 202, body: { ok: true, duplicate: true } };
  }

  const receivedAt = (options.now?.() ?? new Date()).toISOString();
  await options.store.saveDelivery({
    githubDeliveryId: request.deliveryId,
    eventType: request.event,
    status: "received",
    receivedAt,
  });

  const payload = parseBody(request.rawBody);
  const event = normalizeEvent(request.event, payload);
  const result = await dispatch(event, options);
  await options.store.saveDelivery({
    githubDeliveryId: request.deliveryId,
    eventType: request.event,
    status: result.body.ignored ? "ignored" : "processed",
    receivedAt,
    processedAt: (options.now?.() ?? new Date()).toISOString(),
  });
  return result;
}

async function dispatch(event: NormalizedEvent, options: WebhookHandlerOptions): Promise<WebhookResult> {
  if (event.kind === "ignored") {
    return { status: 202, body: { ok: true, ignored: true } };
  }

  if (event.kind === "installation") {
    const { installation, repositories } = installationFromEvent(event);
    await options.store.upsertInstallation(installation);
    if (event.action === "created") {
      await options.store.replaceInstallationRepositories(event.installationId, repositories);
    }
    return { status: 202, body: { ok: true } };
  }

  if (event.kind === "installation_repositories") {
    const { added, removed } = repositoriesFromEvent(event);
    if (added.length > 0) {
      await options.store.addRepositories(event.installationId, added);
    }
    if (removed.length > 0) {
      await options.store.removeRepositories(
        event.installationId,
        removed.map((repo) => repo.githubRepositoryId),
      );
    }
    return { status: 202, body: { ok: true } };
  }

  const job = createAnalysisJob(event);
  await options.queue.enqueue(job);
  return { status: 202, body: { ok: true }, job };
}

function parseBody(raw: Buffer | string): unknown {
  return JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
}

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handleWebhook, type DeliveryRecord, type WebhookStore } from "../src/webhooks/handler.js";
import type { InstallationRecord, RepositoryRecord } from "../src/webhooks/installation.js";
import type { PullRequestAnalysisJob } from "../src/types/jobs.js";

class MemoryWebhookStore implements WebhookStore {
  deliveries = new Map<string, DeliveryRecord>();
  installations: InstallationRecord[] = [];
  repos: RepositoryRecord[] = [];

  async getDelivery(id: string) {
    return this.deliveries.get(id);
  }
  async saveDelivery(record: DeliveryRecord) {
    this.deliveries.set(record.githubDeliveryId, record);
  }
  async upsertInstallation(input: InstallationRecord) {
    this.installations.push(input);
  }
  async replaceInstallationRepositories(_id: number, repositories: RepositoryRecord[]) {
    this.repos = repositories;
  }
  async addRepositories(_id: number, repositories: RepositoryRecord[]) {
    this.repos.push(...repositories);
  }
  async removeRepositories(_installationId: number, _repositoryIds: number[]) {}
}

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("handleWebhook", () => {
  const secret = "webhook-secret";
  const repository = {
    id: 99,
    name: "payments",
    full_name: "acme/payments",
    private: true,
    owner: { id: 1, login: "acme" },
  };
  const payload = {
    action: "opened",
    number: 184,
    pull_request: {
      id: 500,
      number: 184,
      draft: false,
      state: "open",
      base: { sha: "aaa1111", ref: "main", repo: repository },
      head: { sha: "bbb2222", ref: "feature", repo: repository },
    },
    repository,
    installation: { id: 42 },
  };

  it("rejects invalid signatures", async () => {
    const store = new MemoryWebhookStore();
    const jobs: PullRequestAnalysisJob[] = [];
    const result = await handleWebhook(
      {
        rawBody: JSON.stringify(payload),
        event: "pull_request",
        deliveryId: "d1",
        signature: "sha256=nope",
      },
      { secret, store, queue: { enqueue: async (job) => void jobs.push(job) } },
    );
    expect(result.status).toBe(401);
    expect(jobs).toHaveLength(0);
  });

  it("enqueues a pull request analysis and returns 202", async () => {
    const store = new MemoryWebhookStore();
    const jobs: PullRequestAnalysisJob[] = [];
    const rawBody = JSON.stringify(payload);
    const result = await handleWebhook(
      { rawBody, event: "pull_request", deliveryId: "d1", signature: sign(rawBody, secret) },
      { secret, store, queue: { enqueue: async (job) => void jobs.push(job) } },
    );
    expect(result.status).toBe(202);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.headSha).toBe("bbb2222");
    expect(store.deliveries.get("d1")?.status).toBe("processed");
  });

  it("ignores duplicate deliveries without re-enqueueing", async () => {
    const store = new MemoryWebhookStore();
    const jobs: PullRequestAnalysisJob[] = [];
    const rawBody = JSON.stringify(payload);
    const request = { rawBody, event: "pull_request", deliveryId: "d1", signature: sign(rawBody, secret) };
    const options = { secret, store, queue: { enqueue: async (job: PullRequestAnalysisJob) => void jobs.push(job) } };
    await handleWebhook(request, options);
    const second = await handleWebhook(request, options);
    expect(second.body.duplicate).toBe(true);
    expect(jobs).toHaveLength(1);
  });

  it("records installation events without creating analysis jobs", async () => {
    const store = new MemoryWebhookStore();
    const jobs: PullRequestAnalysisJob[] = [];
    const rawBody = JSON.stringify({
      action: "created",
      installation: { id: 7, account: { id: 1, login: "acme" } },
      repositories: [{ id: 99, name: "payments", full_name: "acme/payments", private: true }],
    });
    const result = await handleWebhook(
      { rawBody, event: "installation", deliveryId: "inst-1", signature: sign(rawBody, secret) },
      { secret, store, queue: { enqueue: async (job) => void jobs.push(job) } },
    );
    expect(result.status).toBe(202);
    expect(jobs).toHaveLength(0);
    expect(store.installations).toHaveLength(1);
  });
});

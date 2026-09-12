import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AnalysisRecord,
  AnalysisStore,
  DeliveryRecord,
  InstallationRecord,
  RepositoryRecord,
  WebhookStore,
} from "@breakline/github";

export interface PersistedInstallation extends InstallationRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedRepository extends RepositoryRecord {
  id: string;
  installationId: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedPullRequest {
  id: string;
  repositoryId: number;
  githubPullRequestId: number;
  number: number;
  baseSha: string;
  headSha: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store extends WebhookStore, AnalysisStore {
  getInstallation(installationId: number): Promise<PersistedInstallation | undefined>;
  listRepositories(installationId: number): Promise<PersistedRepository[]>;
  upsertPullRequest(input: {
    repositoryId: number;
    githubPullRequestId: number;
    number: number;
    baseSha: string;
    headSha: string;
    state?: string;
  }): Promise<void>;
  getAnalysis(id: string): Promise<AnalysisRecord | undefined>;
  listAnalyses(): Promise<AnalysisRecord[]>;
}

interface Snapshot {
  deliveries: DeliveryRecord[];
  installations: PersistedInstallation[];
  repositories: PersistedRepository[];
  pullRequests: PersistedPullRequest[];
  analyses: AnalysisRecord[];
}

export class MemoryStore implements Store {
  deliveries = new Map<string, DeliveryRecord>();
  installations = new Map<number, PersistedInstallation>();
  repositories = new Map<number, PersistedRepository>();
  pullRequests = new Map<string, PersistedPullRequest>();
  analyses = new Map<string, AnalysisRecord>();

  async getDelivery(id: string) {
    return this.deliveries.get(id);
  }
  async saveDelivery(record: DeliveryRecord) {
    this.deliveries.set(record.githubDeliveryId, record);
  }
  async upsertInstallation(input: InstallationRecord) {
    const existing = this.installations.get(input.githubInstallationId);
    const now = new Date().toISOString();
    this.installations.set(input.githubInstallationId, {
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...input,
    });
  }
  async replaceInstallationRepositories(installationId: number, repositories: RepositoryRecord[]) {
    for (const [id, repo] of this.repositories) {
      if (repo.installationId === installationId) {
        this.repositories.delete(id);
      }
    }
    await this.addRepositories(installationId, repositories);
  }
  async addRepositories(installationId: number, repositories: RepositoryRecord[]) {
    const now = new Date().toISOString();
    for (const repo of repositories) {
      const existing = this.repositories.get(repo.githubRepositoryId);
      this.repositories.set(repo.githubRepositoryId, {
        id: existing?.id ?? crypto.randomUUID(),
        installationId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...repo,
      });
    }
  }
  async removeRepositories(_installationId: number, repositoryIds: number[]) {
    for (const id of repositoryIds) {
      this.repositories.delete(id);
    }
  }
  async getInstallation(installationId: number) {
    return this.installations.get(installationId);
  }
  async listRepositories(installationId: number) {
    return [...this.repositories.values()].filter((repo) => repo.installationId === installationId);
  }
  async upsertPullRequest(input: {
    repositoryId: number;
    githubPullRequestId: number;
    number: number;
    baseSha: string;
    headSha: string;
    state?: string;
  }) {
    const key = `${input.repositoryId}:${input.number}`;
    const existing = this.pullRequests.get(key);
    const now = new Date().toISOString();
    this.pullRequests.set(key, {
      id: existing?.id ?? crypto.randomUUID(),
      repositoryId: input.repositoryId,
      githubPullRequestId: input.githubPullRequestId,
      number: input.number,
      baseSha: input.baseSha,
      headSha: input.headSha,
      state: input.state ?? "open",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }
  async findByIdentity(input: { repositoryId: number; pullRequestNumber: number; baseSha: string; headSha: string }) {
    return [...this.analyses.values()].find(
      (item) =>
        item.repositoryId === input.repositoryId &&
        item.pullRequestNumber === input.pullRequestNumber &&
        item.baseSha === input.baseSha &&
        item.headSha === input.headSha,
    );
  }
  async get(id: string) {
    return this.analyses.get(id);
  }
  async save(record: AnalysisRecord) {
    this.analyses.set(record.id, { ...record });
  }
  async update(id: string, patch: Partial<AnalysisRecord>) {
    const current = this.analyses.get(id);
    if (current) {
      this.analyses.set(id, { ...current, ...patch });
    }
  }
  async getCurrentHeadSha(repositoryId: number, pullRequestNumber: number) {
    return this.pullRequests.get(`${repositoryId}:${pullRequestNumber}`)?.headSha;
  }
  async setCurrentHeadSha(repositoryId: number, pullRequestNumber: number, headSha: string) {
    const key = `${repositoryId}:${pullRequestNumber}`;
    const existing = this.pullRequests.get(key);
    if (existing) {
      existing.headSha = headSha;
      existing.updatedAt = new Date().toISOString();
      return;
    }
    await this.upsertPullRequest({
      repositoryId,
      githubPullRequestId: pullRequestNumber,
      number: pullRequestNumber,
      baseSha: "",
      headSha,
    });
  }
  async cancelQueued(repositoryId: number, pullRequestNumber: number, exceptHeadSha: string) {
    for (const record of this.analyses.values()) {
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
  async getAnalysis(id: string) {
    return this.analyses.get(id);
  }
  async listAnalyses() {
    return [...this.analyses.values()];
  }

  snapshot(): Snapshot {
    return {
      deliveries: [...this.deliveries.values()],
      installations: [...this.installations.values()],
      repositories: [...this.repositories.values()],
      pullRequests: [...this.pullRequests.values()],
      analyses: [...this.analyses.values()],
    };
  }

  restore(snapshot: Snapshot): void {
    this.deliveries = new Map(snapshot.deliveries.map((item) => [item.githubDeliveryId, item]));
    this.installations = new Map(snapshot.installations.map((item) => [item.githubInstallationId, item]));
    this.repositories = new Map(snapshot.repositories.map((item) => [item.githubRepositoryId, item]));
    this.pullRequests = new Map(snapshot.pullRequests.map((item) => [`${item.repositoryId}:${item.number}`, item]));
    this.analyses = new Map(snapshot.analyses.map((item) => [item.id, item]));
  }
}

export class FileStore extends MemoryStore {
  constructor(private readonly path: string) {
    super();
  }

  static async open(path: string): Promise<FileStore> {
    const store = new FileStore(path);
    try {
      const raw = await readFile(path, "utf8");
      store.restore(JSON.parse(raw) as Snapshot);
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    return store;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.snapshot(), null, 2), "utf8");
  }

  override async saveDelivery(record: DeliveryRecord) {
    await super.saveDelivery(record);
    await this.persist();
  }
  override async upsertInstallation(input: InstallationRecord) {
    await super.upsertInstallation(input);
    await this.persist();
  }
  override async replaceInstallationRepositories(installationId: number, repositories: RepositoryRecord[]) {
    await super.replaceInstallationRepositories(installationId, repositories);
    await this.persist();
  }
  override async addRepositories(installationId: number, repositories: RepositoryRecord[]) {
    await super.addRepositories(installationId, repositories);
    await this.persist();
  }
  override async removeRepositories(installationId: number, repositoryIds: number[]) {
    await super.removeRepositories(installationId, repositoryIds);
    await this.persist();
  }
  override async save(record: AnalysisRecord) {
    await super.save(record);
    await this.persist();
  }
  override async update(id: string, patch: Partial<AnalysisRecord>) {
    await super.update(id, patch);
    await this.persist();
  }
  override async upsertPullRequest(input: Parameters<Store["upsertPullRequest"]>[0]) {
    await super.upsertPullRequest(input);
    await this.persist();
  }
  override async setCurrentHeadSha(repositoryId: number, pullRequestNumber: number, headSha: string) {
    await super.setCurrentHeadSha(repositoryId, pullRequestNumber, headSha);
    await this.persist();
  }
  override async cancelQueued(repositoryId: number, pullRequestNumber: number, exceptHeadSha: string) {
    await super.cancelQueued(repositoryId, pullRequestNumber, exceptHeadSha);
    await this.persist();
  }
}

export async function openStore(databaseUrl?: string): Promise<Store> {
  if (!databaseUrl || databaseUrl === "memory") {
    return new MemoryStore();
  }
  const path = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
  return FileStore.open(path);
}

import type { BreaklineReport, ImpactLevel } from "@breakline/report";

export type AnalysisStatus = "queued" | "fetching" | "analyzing" | "publishing" | "completed" | "failed" | "cancelled";

export interface AnalysisRecord {
  id: string;
  repositoryId: number;
  pullRequestId: number;
  pullRequestNumber: number;
  baseSha: string;
  headSha: string;
  status: AnalysisStatus;
  impact?: ImpactLevel;
  report?: BreaklineReport;
  checkRunId?: number;
  errorId?: string;
  errorReason?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AnalysisStore {
  findByIdentity(input: {
    repositoryId: number;
    pullRequestNumber: number;
    baseSha: string;
    headSha: string;
  }): Promise<AnalysisRecord | undefined>;
  get(id: string): Promise<AnalysisRecord | undefined>;
  save(record: AnalysisRecord): Promise<void>;
  update(id: string, patch: Partial<AnalysisRecord>): Promise<void>;
  getCurrentHeadSha(repositoryId: number, pullRequestNumber: number): Promise<string | undefined>;
  setCurrentHeadSha(repositoryId: number, pullRequestNumber: number, headSha: string): Promise<void>;
  cancelQueued(repositoryId: number, pullRequestNumber: number, exceptHeadSha: string): Promise<void>;
}

export interface StructuredLogger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

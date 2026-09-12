import type { Finding as CoreFinding } from "@breakline/core";

export const REPORT_SCHEMA_VERSION = "0.4";

export type ImpactLevel = "none" | "low" | "medium" | "high";
export type FindingSeverity = "info" | "low" | "medium" | "high";
export type FindingConfidence = "low" | "medium" | "high";

export type FindingCategory =
  | "control-flow"
  | "validation"
  | "authorization"
  | "error-flow"
  | "return-value"
  | "side-effect"
  | "boundary"
  | "call-behavior"
  | "other";

export interface FindingLocation {
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface Evidence {
  kind: "before" | "after" | "witness" | "detail";
  text: string;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  title: string;
  description: string;
  symbol?: string;
  location?: FindingLocation;
  evidence?: Evidence[];
}

export interface AnalysisLimitsNote {
  changedFileCount: number;
  analyzedFileCount: number;
  reason: string;
}

export interface BreaklineReport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  analysis: {
    id: string;
    baseRevision: string;
    headRevision: string;
    startedAt: string;
    completedAt: string;
    filesAnalyzed: number;
    functionsCompared: number;
    limited?: AnalysisLimitsNote;
  };
  summary: {
    impact: ImpactLevel;
    findingCount: number;
    highConfidenceCount: number;
    byCategory: Partial<Record<FindingCategory, number>>;
    bySeverity: Partial<Record<FindingSeverity, number>>;
  };
  findings: Finding[];
  metadata: {
    source: "core";
    coreFindings?: CoreFinding[];
  };
}

export type ConfidenceThreshold = FindingConfidence;

export interface BreaklineConfig {
  version: 1;
  github: {
    enabled: boolean;
    comment: boolean;
    annotations: boolean;
    analyzeDrafts: boolean;
  };
  analysis: {
    minConfidence: ConfidenceThreshold;
    maxChangedFiles: number;
    maxCheckoutBytes: number;
    maxDurationMs: number;
    impact: boolean;
  };
  report: {
    maxGithubFindings: number;
    maxAnnotations: number;
  };
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface AnalysisRequest {
  repositoryPath: string;
  baseRevision: string;
  headRevision: string;
  analysisId?: string;
  config?: DeepPartial<BreaklineConfig>;
}

export const DEFAULT_CONFIG: BreaklineConfig = {
  version: 1,
  github: {
    enabled: true,
    comment: false,
    annotations: true,
    analyzeDrafts: true,
  },
  analysis: {
    minConfidence: "medium",
    maxChangedFiles: 200,
    maxCheckoutBytes: 80 * 1024 * 1024,
    maxDurationMs: 120_000,
    impact: true,
  },
  report: {
    maxGithubFindings: 5,
    maxAnnotations: 10,
  },
};

export interface PullRequestContext {
  provider: "github";
  repository: {
    id: string;
    owner: string;
    name: string;
  };
  pullRequest: {
    id: string;
    number: number;
    baseSha: string;
    headSha: string;
  };
}

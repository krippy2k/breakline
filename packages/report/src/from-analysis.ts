import { randomUUID } from "node:crypto";
import type { AnalysisResult, BehaviorFinding, Finding as CoreFinding } from "@breakline/core";
import { classifyImpact, looksAuthorization } from "./classify-impact.js";
import { confidenceRank } from "./config.js";
import type {
  BreaklineConfig,
  BreaklineReport,
  Evidence,
  Finding,
  FindingCategory,
  FindingConfidence,
  FindingSeverity,
} from "./types.js";
import { REPORT_SCHEMA_VERSION } from "./types.js";

export function toBreaklineReport(
  result: AnalysisResult,
  input: {
    analysisId?: string;
    baseRevision: string;
    headRevision: string;
    startedAt: string;
    completedAt?: string;
    config?: BreaklineConfig;
    limited?: BreaklineReport["analysis"]["limited"];
  },
): BreaklineReport {
  const minConfidence = input.config?.analysis.minConfidence ?? "medium";
  const findings = buildFindings(result).filter(
    (finding) => confidenceRank(finding.confidence) >= confidenceRank(minConfidence),
  );
  const impact = classifyImpact(findings);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    analysis: {
      id: input.analysisId ?? randomUUID(),
      baseRevision: input.baseRevision,
      headRevision: input.headRevision,
      startedAt: input.startedAt,
      completedAt: input.completedAt ?? new Date().toISOString(),
      filesAnalyzed: result.filesAnalyzed,
      functionsCompared: result.functionsCompared,
      limited: input.limited,
    },
    summary: {
      impact,
      findingCount: findings.length,
      highConfidenceCount: findings.filter((finding) => finding.confidence === "high").length,
      byCategory: countBy(findings, (finding) => finding.category),
      bySeverity: countBy(findings, (finding) => finding.severity),
    },
    findings,
    metadata: {
      source: "core",
      coreFindings: result.report,
    },
  };
}

function buildFindings(result: AnalysisResult): Finding[] {
  const core = result.report ?? [];
  if (core.length > 0) {
    return core.map((finding) => fromCoreFinding(finding, result.findings));
  }
  return result.findings.map(fromBehaviorFinding);
}

function fromCoreFinding(finding: CoreFinding, behavioral: BehaviorFinding[]): Finding {
  const match = behavioral.find(
    (item) => item.symbol === finding.symbol && (!finding.location?.file || item.file === finding.location.file),
  );
  const category = categoryFor(finding, match);
  const title = match?.summary && match.summary !== finding.summary ? match.summary : finding.summary;
  return {
    id: finding.id,
    category,
    severity: severityFor(finding, category, match),
    confidence: match?.confidence ?? defaultConfidence(finding),
    title,
    description: descriptionFor(finding, match),
    symbol: finding.symbol,
    location: finding.location
      ? {
          path: finding.location.file,
          startLine: finding.location.line,
        }
      : match?.location
        ? { path: match.file, startLine: match.location.start.line, endLine: match.location.end.line }
        : undefined,
    evidence: evidenceFor(finding, match),
  };
}

function fromBehaviorFinding(finding: BehaviorFinding): Finding {
  const category = categoryFromBehavior(finding);
  return {
    id: `bl_behavior_${finding.symbol}_${finding.type}`,
    category,
    severity: severityFromBehavior(finding, category),
    confidence: finding.confidence,
    title: finding.summary,
    description: finding.summary,
    symbol: finding.symbol,
    location: finding.location
      ? {
          path: finding.file,
          startLine: finding.location.start.line,
          endLine: finding.location.end.line,
        }
      : { path: finding.file },
    evidence: behaviorEvidence(finding),
  };
}

function categoryFor(finding: CoreFinding, behavioral?: BehaviorFinding): FindingCategory {
  const haystack = `${finding.symbol} ${finding.location?.file ?? ""} ${finding.summary} ${finding.detail ?? ""}`;
  if (looksAuthorization(haystack) || (behavioral && looksAuthorization(behavioral.summary))) {
    return "authorization";
  }
  if (/validat|schema|required|reject|sanitize|assert/i.test(haystack)) {
    return "validation";
  }
  switch (finding.kind) {
    case "condition_changed":
      return "control-flow";
    case "return_changed":
      return "return-value";
    case "call_added":
    case "call_removed":
    case "call_arguments_changed":
      return "call-behavior";
    case "throw_added":
    case "throw_removed":
      return "error-flow";
    case "signature_changed":
      return "boundary";
    default:
      return "other";
  }
}

function categoryFromBehavior(finding: BehaviorFinding): FindingCategory {
  const haystack = `${finding.symbol} ${finding.file} ${finding.summary}`;
  if (looksAuthorization(haystack)) {
    return "authorization";
  }
  switch (finding.type) {
    case "predicate-expanded":
    case "predicate-restricted":
    case "predicate-changed":
      return "control-flow";
    case "boundary-changed":
      return "boundary";
    case "return-changed":
    case "return-added":
    case "return-removed":
      return "return-value";
    case "throw-added":
    case "throw-removed":
      return "error-flow";
    case "call-newly-reachable":
    case "call-no-longer-reachable":
    case "call-became-unconditional":
      return "call-behavior";
    default:
      return "other";
  }
}

function severityFor(
  finding: CoreFinding,
  category: FindingCategory,
  behavioral?: BehaviorFinding,
): FindingSeverity {
  if (category === "authorization") {
    return "high";
  }
  if (finding.kind === "throw_removed" || finding.kind === "function_removed") {
    return "high";
  }
  if (finding.severity === "warning") {
    return "medium";
  }
  if (behavioral?.type === "predicate-expanded") {
    return "medium";
  }
  return "low";
}

function severityFromBehavior(finding: BehaviorFinding, category: FindingCategory): FindingSeverity {
  if (category === "authorization") {
    return "high";
  }
  if (finding.type === "throw-removed" || finding.type === "predicate-expanded") {
    return "medium";
  }
  if (finding.confidence === "low") {
    return "info";
  }
  return "low";
}

function defaultConfidence(finding: CoreFinding): FindingConfidence {
  return finding.severity === "warning" ? "high" : "medium";
}

function descriptionFor(finding: CoreFinding, behavioral?: BehaviorFinding): string {
  const parts = [finding.detail, finding.before && `Previously: ${finding.before}`, finding.after && `Now: ${finding.after}`];
  if (behavioral?.witness) {
    const bindings = Object.entries(behavioral.witness.bindings)
      .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
      .join(", ");
    parts.push(`Witness: ${bindings}`);
  }
  return parts.filter(Boolean).join("\n") || finding.summary;
}

function behaviorEvidence(finding: BehaviorFinding): Evidence[] {
  const evidence: Evidence[] = [];
  if (finding.before) {
    evidence.push({ kind: "before", text: finding.before.text });
  }
  if (finding.after) {
    evidence.push({ kind: "after", text: finding.after.text });
  }
  if (finding.witness) {
    evidence.push({
      kind: "witness",
      text: Object.entries(finding.witness.bindings)
        .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
        .join(", "),
    });
  }
  return evidence;
}

function evidenceFor(finding: CoreFinding, behavioral?: BehaviorFinding): Evidence[] {
  const evidence: Evidence[] = [];
  if (finding.before) {
    evidence.push({ kind: "before", text: finding.before });
  }
  if (finding.after) {
    evidence.push({ kind: "after", text: finding.after });
  }
  if (finding.detail) {
    evidence.push({ kind: "detail", text: finding.detail });
  }
  if (behavioral?.witness) {
    evidence.push({
      kind: "witness",
      text: Object.entries(behavioral.witness.bindings)
        .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
        .join(", "),
    });
  }
  return evidence;
}

function countBy<T extends string>(items: Finding[], key: (item: Finding) => T): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

import type { Finding } from "../findings/types.js";
import type { ChangeImpact, ImpactReport } from "../impact/types.js";
import { normalizePath } from "../parser/parse.js";
import type { AnalysisResult } from "../types.js";

export const JSON_SCHEMA_VERSION = "0.3";

export interface JsonRef {
  file: string;
  qualifiedName: string;
  distance: number;
  confidence: number;
  relation?: string;
  entryPointKind?: string;
  testName?: string;
}

export interface JsonImpact {
  summary: ImpactReport["summary"];
  diagnostics: ImpactReport["diagnostics"];
  unresolved?: string;
  changes: {
    symbol: { file: string; qualifiedName: string; kind: string };
    behavioralChange: { summary: string; findings: ChangeImpact["findings"] };
    impact: {
      level: string;
      confidence: number;
      directDependents: JsonRef[];
      indirectDependents: JsonRef[];
      entryPoints: JsonRef[];
      relatedTests: JsonRef[];
      testGaps: string[];
      paths?: { file: string; qualifiedName: string }[][];
    };
  }[];
}

export interface JsonReport {
  schemaVersion: typeof JSON_SCHEMA_VERSION;
  files: {
    path: string;
    findings: Finding[];
  }[];
  impact?: JsonImpact;
}

export function toJsonReport(result: AnalysisResult): JsonReport {
  const findings = result.report ?? [];
  const map = new Map<string, Finding[]>();
  for (const file of result.files ?? []) {
    map.set(normalizePath(file), []);
  }
  for (const finding of findings) {
    const path = normalizePath(finding.location?.file ?? result.files?.[0] ?? "");
    if (!map.has(path)) {
      map.set(path, []);
    }
    map.get(path)!.push(finding);
  }
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    files: [...map.entries()].map(([path, fileFindings]) => ({
      path,
      findings: fileFindings,
    })),
    impact: result.impact ? serializeImpact(result.impact) : undefined,
  };
}

export function formatJsonReport(result: AnalysisResult): string {
  return JSON.stringify(toJsonReport(result), null, 2);
}

function serializeImpact(impact: ImpactReport): JsonImpact {
  return {
    summary: impact.summary,
    diagnostics: impact.diagnostics,
    unresolved: impact.unresolved,
    changes: impact.changes.map((change) => ({
      symbol: {
        file: change.changedSymbol.file,
        qualifiedName: change.changedSymbol.qualifiedName,
        kind: change.changedSymbol.kind,
      },
      behavioralChange: {
        summary: change.findings.map((item) => item.summary).join("; "),
        findings: change.findings,
      },
      impact: {
        level: change.level,
        confidence: change.confidence,
        directDependents: change.directDependents.map(toRef),
        indirectDependents: change.indirectDependents.map(toRef),
        entryPoints: change.entryPoints.map((item) => ({
          ...toRef(item),
          entryPointKind: item.entryPointKind,
        })),
        relatedTests: change.relatedTests.map((item) => ({
          ...toRef(item),
          testName: item.testName,
        })),
        testGaps: change.testGaps,
        paths: change.entryPoints
          .map((item) => item.path?.map((id) => ({ file: id.file, qualifiedName: id.qualifiedName })) ?? [])
          .filter((path) => path.length > 0),
      },
    })),
  };
}

function toRef(item: {
  symbol: { file: string; qualifiedName: string };
  distance: number;
  confidence: number;
  relation?: string;
}): JsonRef {
  return {
    file: item.symbol.file,
    qualifiedName: item.symbol.qualifiedName,
    distance: item.distance,
    confidence: item.confidence,
    relation: item.relation,
  };
}

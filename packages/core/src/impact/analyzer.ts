import type { Finding } from "../findings/types.js";
import type { AnalysisResult } from "../types.js";
import { buildImpactGraph } from "./builder.js";
import { classifyEntryPoints } from "./entrypoints.js";
import type { DependencyGraph } from "./graph.js";
import { groupFindings, matchFindingToSymbol } from "./match.js";
import { scoreImpactLevel } from "./score.js";
import { linkTests } from "./tests.js";
import { findImpact } from "./traversal.js";
import {
  DEFAULT_IMPACT_OPTIONS,
  idKey,
  type ChangeImpact,
  type DependencyKind,
  type ImpactOptions,
  type ImpactReport,
  type ImpactSummary,
} from "./types.js";

export function analyzeImpact(
  findings: Finding[],
  graph: DependencyGraph,
  unresolved: number,
  options: Partial<ImpactOptions> = {},
): ImpactReport {
  const opts = { ...DEFAULT_IMPACT_OPTIONS, ...options };
  const kinds = edgeKinds(opts);
  const groups = groupFindings(findings);
  const changes: ChangeImpact[] = [];
  let maxDepthReached = 0;

  for (const group of groups) {
    const changedSymbol = matchFindingToSymbol(group.findings[0], graph);
    if (!changedSymbol) {
      continue;
    }

    const impacted = findImpact(changedSymbol.id, graph, { maxDepth: opts.maxDepth, kinds });
    maxDepthReached = Math.max(maxDepthReached, ...impacted.map((item) => item.distance), 0);
    const directDependents = impacted.filter(
      (item) => item.distance === 1 && item.symbol.kind !== "test" && !isFileSymbol(item.symbol),
    );
    const indirectDependents = impacted.filter(
      (item) => item.distance > 1 && item.symbol.kind !== "test" && !isFileSymbol(item.symbol),
    );
    const entryPoints = opts.includeEntryPoints ? classifyEntryPoints(impacted) : [];
    const relatedTests = opts.includeTests
      ? linkTests(
          changedSymbol,
          [...directDependents, ...indirectDependents].map((item) => item.symbol),
          graph,
        )
      : [];
    const testGaps: string[] = [];
    const impact: ChangeImpact = {
      changedSymbol,
      findings: group.findings.map((finding) => ({
        id: finding.id,
        summary: finding.summary,
        before: finding.before,
        after: finding.after,
      })),
      directDependents,
      indirectDependents,
      entryPoints,
      relatedTests,
      testGaps,
      maxDepthReached,
      confidence: overallConfidence(impacted),
      level: "low",
    };
    impact.level = scoreImpactLevel(impact);
    if ((impact.level === "medium" || impact.level === "high") && relatedTests.length === 0) {
      impact.testGaps.push(`No related test detected for ${displayName(changedSymbol.qualifiedName)}.`);
    }
    changes.push(impact);
  }

  const size = graph.size();
  return {
    summary: summarize(changes, findings.length),
    changes,
    diagnostics: {
      symbols: size.symbols,
      edges: size.edges,
      unresolvedReferences: unresolved,
      traversalDepth: opts.maxDepth,
    },
    unresolved:
      findings.length > 0 && changes.length === 0
        ? "Unable to confidently resolve project dependents."
        : undefined,
  };
}

export function attachImpact(
  result: AnalysisResult,
  files: { file: string; source: string }[],
  options: Partial<ImpactOptions> = {},
): AnalysisResult {
  try {
    const { graph, unresolved } = buildImpactGraph(files);
    result.impact = analyzeImpact(result.report ?? [], graph, unresolved, options);
  } catch {
    result.impact = {
      summary: emptySummary(result.report?.length ?? 0),
      changes: [],
      diagnostics: { symbols: 0, edges: 0, unresolvedReferences: 0, traversalDepth: options.maxDepth ?? 3 },
      unresolved: "Unable to confidently resolve project dependents.",
    };
  }
  return result;
}

function edgeKinds(options: ImpactOptions): DependencyKind[] {
  const kinds: DependencyKind[] = ["calls", "registers", "references"];
  if (options.includeImports) {
    kinds.push("imports");
  }
  if (options.includeInheritance) {
    kinds.push("extends", "implements");
  }
  return kinds;
}

function overallConfidence(impacted: { confidence: number }[]): number {
  if (impacted.length === 0) {
    return 0.8;
  }
  return impacted.reduce((min, item) => Math.min(min, item.confidence), 1);
}

function summarize(changes: ChangeImpact[], behavioralChanges: number): ImpactSummary {
  const symbols = new Set<string>();
  const entryPoints = new Set<string>();
  const tests = new Set<string>();
  let gaps = 0;
  for (const change of changes) {
    for (const item of [...change.directDependents, ...change.indirectDependents]) {
      symbols.add(idKey(item.symbol.id));
    }
    for (const item of change.entryPoints) {
      entryPoints.add(idKey(item.symbol.id));
    }
    for (const item of change.relatedTests) {
      tests.add(idKey(item.symbol.id));
    }
    gaps += change.testGaps.length;
  }
  return {
    behavioralChanges,
    highImpactChanges: changes.filter((item) => item.level === "high").length,
    affectedSymbols: symbols.size,
    affectedEntryPoints: entryPoints.size,
    relatedTests: tests.size,
    potentialTestGaps: gaps,
  };
}

function emptySummary(behavioralChanges: number): ImpactSummary {
  return {
    behavioralChanges,
    highImpactChanges: 0,
    affectedSymbols: 0,
    affectedEntryPoints: 0,
    relatedTests: 0,
    potentialTestGaps: 0,
  };
}

function displayName(qualifiedName: string): string {
  return qualifiedName.endsWith("()") ? qualifiedName : `${qualifiedName}()`;
}

function isFileSymbol(symbol: { qualifiedName: string }): boolean {
  return symbol.qualifiedName.endsWith("::__file");
}

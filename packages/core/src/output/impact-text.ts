import { confidenceLabel, type CodeSymbol, type SymbolId } from "../impact/types.js";
import type { AnalysisResult } from "../types.js";
import { formatTextReport as formatBehavioral } from "./text.js";

export interface TextReportOptions {
  showImpactPaths?: boolean;
  verbose?: boolean;
}

export function formatAnalysisText(result: AnalysisResult, options: TextReportOptions = {}): string {
  if (!result.impact) {
    return formatBehavioral(result);
  }
  return formatImpactText(result, options);
}

export function formatImpactText(result: AnalysisResult, options: TextReportOptions = {}): string {
  const findings = result.report ?? [];
  const impact = result.impact;
  if (!impact) {
    return formatBehavioral(result);
  }

  if (findings.length === 0) {
    return ["BREAKLINE", "", "No behavioral changes found"].join("\n");
  }

  const lines = [
    "BREAKLINE",
    "",
    `${findings.length} behavioral change${findings.length === 1 ? "" : "s"} detected`,
  ];

  if (impact.unresolved && impact.changes.length === 0) {
    lines.push("", "Impact analysis:", `  ${impact.unresolved}`);
    lines.push("", formatBehavioral(result));
    return lines.join("\n");
  }

  for (const change of impact.changes) {
    lines.push("", `${change.level.toUpperCase()} IMPACT`, "────────────────────────────────────────", "");
    lines.push(formatSymbol(change.changedSymbol), "");
    lines.push("Behavioral change:");
    for (const finding of change.findings) {
      lines.push(`  ${finding.summary}`);
      if (finding.before) {
        lines.push(`    before: ${finding.before}`);
      }
      if (finding.after) {
        lines.push(`    after:  ${finding.after}`);
      }
    }
    lines.push("");
    lines.push("Impact:");
    lines.push(`  ${change.directDependents.length} direct dependents`);
    lines.push(`  ${change.indirectDependents.length} indirect dependents`);
    lines.push("");
    lines.push("Direct dependents:");
    if (change.directDependents.length === 0) {
      lines.push("  (none detected)");
    } else {
      for (const item of change.directDependents) {
        lines.push(`  ${formatSymbol(item.symbol)}`);
      }
    }
    lines.push("");
    lines.push("Indirect dependents:");
    if (change.indirectDependents.length === 0) {
      lines.push("  (none detected)");
    } else {
      for (const item of change.indirectDependents) {
        lines.push(`  ${formatSymbol(item.symbol)}`);
      }
    }
    lines.push("");
    lines.push("Entry points:");
    if (change.entryPoints.length === 0) {
      lines.push("  (none detected)");
    } else {
      for (const item of change.entryPoints) {
        lines.push(`  ${formatSymbol(item.symbol)}`);
      }
    }
    lines.push("");
    lines.push("Related tests:");
    if (change.relatedTests.length === 0 && change.testGaps.length === 0) {
      lines.push("  (none detected)");
    }
    for (const test of change.relatedTests) {
      lines.push(`  ✓ ${test.testName ?? formatSymbol(test.symbol)}`);
    }
    for (const gap of change.testGaps) {
      lines.push(`  ⚠ ${gap}`);
    }
    if (options.showImpactPaths) {
      const pathSource = change.entryPoints[0] ?? change.indirectDependents[0] ?? change.directDependents[0];
      if (pathSource?.path && pathSource.path.length > 0) {
        lines.push("", "Impact path:");
        lines.push(...formatPath(pathSource.path, change.changedSymbol));
      }
    }
    lines.push("", "Confidence:");
    lines.push(`  ${change.confidence.toFixed(2)} (${confidenceLabel(change.confidence)})`);
  }

  const summary = impact.summary;
  lines.push(
    "",
    "Impact summary",
    "",
    `Behavioral changes:      ${summary.behavioralChanges}`,
    `High-impact changes:     ${summary.highImpactChanges}`,
    `Affected symbols:        ${summary.affectedSymbols}`,
    `Affected entry points:   ${summary.affectedEntryPoints}`,
    `Related tests:           ${summary.relatedTests}`,
    `Potential test gaps:     ${summary.potentialTestGaps}`,
  );

  if (options.verbose) {
    const diag = impact.diagnostics;
    lines.push(
      "",
      "Diagnostics",
      `  Resolved ${diag.symbols} symbols`,
      `  Built ${diag.edges} dependency edges`,
      `  Unresolved references: ${diag.unresolvedReferences}`,
      `  Impact traversal depth: ${diag.traversalDepth}`,
    );
  }

  return lines.join("\n");
}

export function formatSymbol(symbol: CodeSymbol): string {
  if (symbol.kind === "route" || symbol.kind === "event-handler" || symbol.kind === "cli-command") {
    return symbol.qualifiedName;
  }
  if (symbol.kind === "test") {
    return symbol.qualifiedName.endsWith("::__file") ? symbol.file : symbol.name;
  }
  return `${symbol.qualifiedName}()`;
}

function formatPath(path: SymbolId[], changed: CodeSymbol): string[] {
  const names = path.map((id) =>
    id.qualifiedName === changed.qualifiedName && id.file === changed.file
      ? formatSymbol(changed)
      : id.qualifiedName.startsWith("GET ") ||
          id.qualifiedName.startsWith("POST ") ||
          id.qualifiedName.startsWith("PUT ") ||
          id.qualifiedName.startsWith("PATCH ") ||
          id.qualifiedName.startsWith("DELETE ") ||
          id.qualifiedName.startsWith("event:") ||
          id.qualifiedName.startsWith("cli:")
        ? id.qualifiedName
        : `${id.qualifiedName}()`,
  );
  return names.map((name, index) => (index === 0 ? `  ${name}` : `    → ${name}`));
}

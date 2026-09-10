import type { AnalysisResult, BehaviorFinding, Confidence, InspectedFunction } from "@breakline/core";
import { printBindings } from "@breakline/core";

export function filterFindings(
  findings: BehaviorFinding[],
  includeLow: boolean,
): BehaviorFinding[] {
  return findings.filter((finding) => includeLow || finding.confidence !== "low");
}

export function formatInspect(file: string, functions: InspectedFunction[]): string {
  const lines = ["BREAKLINE", "", `File: ${file}`, `Functions: ${functions.length}`, ""];
  for (const fn of functions) {
    const params = fn.parameters
      .map((param) => (param.type ? `${param.name}: ${param.type}` : param.name))
      .join(", ");
    const container = fn.identity.container ? `${fn.identity.container}.` : "";
    const loc = `${fn.location.start.line}:${fn.location.start.column}`;
    lines.push(`  ${container}${fn.identity.name}(${params})  ${fn.identity.kind}  L${loc}`);
  }
  return lines.join("\n");
}

export function formatCompare(result: AnalysisResult, includeLow = false): string {
  const findings = filterFindings(result.findings, includeLow);
  const lines = ["BREAKLINE", ""];

  if (findings.length === 0) {
    lines.push("No behavioral changes found");
    return lines.join("\n");
  }

  lines.push(
    `${findings.length} behavioral change${findings.length === 1 ? "" : "s"} found`,
    "",
  );

  for (const finding of findings) {
    lines.push(formatFinding(finding), "");
  }

  return lines.join("\n").trimEnd();
}

export function formatAnalyze(result: AnalysisResult, includeLow = false): string {
  const findings = filterFindings(result.findings, includeLow);
  const high = findings.filter((item) => item.confidence === "high").length;
  const medium = findings.filter((item) => item.confidence === "medium").length;
  const lines = [
    "BREAKLINE",
    "",
    "Analyzed:",
    `  ${result.filesAnalyzed} files`,
    `  ${result.functionsCompared} changed functions`,
    "",
    "Findings:",
    `  ${high} high confidence`,
    `  ${medium} medium confidence`,
  ];

  if (findings.length === 0) {
    return lines.join("\n");
  }

  const byConfidence: Confidence[] = ["high", "medium", "low"];
  for (const level of byConfidence) {
    const group = findings.filter((item) => item.confidence === level);
    if (group.length === 0) {
      continue;
    }
    for (const finding of group) {
      lines.push("", "────────────────────────────────────────", "", formatFinding(finding));
    }
  }

  return lines.join("\n");
}

function formatFinding(finding: BehaviorFinding): string {
  const lines = [
    finding.confidence.toUpperCase(),
    finding.summary,
    "",
    "Function:",
    `  ${finding.symbol}`,
  ];

  if (finding.location) {
    lines.push("", `${finding.file}:${finding.location.start.line}`);
  } else if (finding.file) {
    lines.push("", finding.file);
  }

  if (finding.before) {
    lines.push("", "Previous behavior:", `  ${finding.before.text}`);
  }
  if (finding.after) {
    lines.push("", "New behavior:", `  ${finding.after.text}`);
  }
  if (finding.witness) {
    lines.push("", "Witness:", indent(printBindings(finding.witness.bindings)));
    if (finding.witness.before !== undefined) {
      lines.push("", "Previous result:", `  ${finding.witness.before}`);
    }
    if (finding.witness.after !== undefined) {
      lines.push("", "New result:", `  ${finding.witness.after}`);
    }
  }

  return lines.join("\n");
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

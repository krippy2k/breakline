import type { BreaklineReport, Finding } from "@breakline/report";
import { capitalize, titleForFailure } from "./conclusion.js";

export const CHECK_NAME = "Breakline";

export function renderCheckSummary(report: BreaklineReport, options: { reportUrl?: string; maxFindings?: number }): string {
  const maxFindings = options.maxFindings ?? 5;
  const keyFindings = report.findings.slice(0, maxFindings);
  const lines = [
    "## Breakline Report",
    "",
    `**Behavioral Impact:** ${capitalize(report.summary.impact)}`,
    `**Findings:** ${report.summary.findingCount}`,
    `**High Confidence:** ${report.summary.highConfidenceCount}`,
    "",
  ];

  if (report.analysis.limited) {
    lines.push(
      `Breakline analyzed ${report.analysis.limited.analyzedFileCount} of ${report.analysis.limited.changedFileCount} changed files.`,
      report.analysis.limited.reason,
      "",
    );
  }

  if (keyFindings.length > 0) {
    lines.push("### Key Findings", "");
    keyFindings.forEach((finding, index) => {
      lines.push(`${index + 1}. ${formatFindingLine(finding)}`);
    });
    lines.push("");
  } else {
    lines.push("No supported behavioral changes detected.", "");
  }

  lines.push(
    `Base: \`${shortSha(report.analysis.baseRevision)}\` · Head: \`${shortSha(report.analysis.headRevision)}\``,
    "",
  );

  if (options.reportUrl) {
    lines.push(`[View full report in Breakline](${options.reportUrl})`);
  }

  return lines.join("\n").trimEnd();
}

export function renderProgressSummary(): string {
  return "Analyzing behavioral impact...";
}

export function renderFailureSummary(input: { reason: string; errorId: string; retryUrl?: string }): string {
  const lines = [
    `## ${titleForFailure()}`,
    "",
    "Unable to analyze this pull request.",
    "",
    "Reason:",
    input.reason,
    "",
    `Error ID: ${input.errorId}`,
  ];
  if (input.retryUrl) {
    lines.push("", `[Retry analysis](${input.retryUrl})`);
  }
  return lines.join("\n");
}

export function formatFindingLine(finding: Finding): string {
  const symbol = finding.symbol ? ` in \`${finding.symbol}()\`` : "";
  return `${finding.title}${symbol}`;
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

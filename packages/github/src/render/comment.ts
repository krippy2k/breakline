import type { BreaklineReport } from "@breakline/report";
import { capitalize } from "./conclusion.js";

export const COMMENT_MARKER = "<!-- breakline-report -->";

export function renderPullRequestComment(report: BreaklineReport, options: { reportUrl?: string }): string {
  const byCategory = Object.entries(report.summary.byCategory)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([category, count]) => `- ${count} ${category.replace("-", " ")} change${count === 1 ? "" : "s"}`);

  const lines = [
    COMMENT_MARKER,
    "## Breakline Analysis",
    "",
    `**Impact: ${capitalize(report.summary.impact)}**`,
    "",
    `Breakline detected ${report.summary.findingCount} behavioral change${report.summary.findingCount === 1 ? "" : "s"}.`,
    "",
    `- ${report.summary.highConfidenceCount} high-confidence finding${report.summary.highConfidenceCount === 1 ? "" : "s"}`,
    ...byCategory,
    "",
  ];

  if (options.reportUrl) {
    lines.push(`[View full Breakline report](${options.reportUrl})`);
  }

  return lines.join("\n").trimEnd();
}

export function isBreaklineComment(body: string | undefined): boolean {
  return Boolean(body?.includes(COMMENT_MARKER));
}

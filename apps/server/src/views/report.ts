import type { AnalysisRecord } from "@breakline/github";
import { escapeHtml } from "./escape.js";

export function renderReportPage(input: {
  owner: string;
  repo: string;
  pullRequest: number;
  analysis: AnalysisRecord;
}): string {
  const report = input.analysis.report!;
  const findings = report.findings
    .map((finding) => {
      const location = finding.location
        ? `${finding.location.path}${finding.location.startLine ? `:${finding.location.startLine}` : ""}`
        : "";
      const evidence = (finding.evidence ?? [])
        .map((item) => `<p><strong>${escapeHtml(item.kind)}:</strong> <code>${escapeHtml(item.text)}</code></p>`)
        .join("");
      return `<article class="finding">
  <h3>[${escapeHtml(finding.severity.toUpperCase())}] ${escapeHtml(finding.title)}</h3>
  <p class="meta">${escapeHtml(finding.category)} · ${escapeHtml(finding.confidence)} confidence${location ? ` · ${escapeHtml(location)}` : ""}</p>
  <p>${escapeHtml(finding.description)}</p>
  ${evidence}
</article>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Breakline Report · ${escapeHtml(input.owner)}/${escapeHtml(input.repo)} #${input.pullRequest}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 32px auto; max-width: 840px; color: #111; }
    header { border: 1px solid #ddd; padding: 20px 24px; border-radius: 8px; }
    .impact { font-size: 1.1rem; font-weight: 600; }
    .finding { border-top: 1px solid #eee; padding: 16px 0; }
    .meta { color: #555; font-size: 0.9rem; }
    code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.9em; }
  </style>
</head>
<body>
  <header>
    <p>Breakline Report</p>
    <h1>${escapeHtml(input.owner)}/${escapeHtml(input.repo)} #${input.pullRequest}</h1>
    <p class="impact">Behavioral Impact: ${escapeHtml(report.summary.impact.toUpperCase())}</p>
    <p>${report.summary.findingCount} findings · ${report.summary.highConfidenceCount} high confidence</p>
    <p class="meta">Base ${escapeHtml(report.analysis.baseRevision.slice(0, 7))} → Head ${escapeHtml(report.analysis.headRevision.slice(0, 7))} · ${escapeHtml(report.analysis.completedAt)}</p>
  </header>
  <h2>Key Findings</h2>
  ${findings || "<p>No supported behavioral changes detected.</p>"}
</body>
</html>`;
}

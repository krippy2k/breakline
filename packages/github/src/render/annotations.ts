import type { BreaklineConfig, BreaklineReport, Finding } from "@breakline/report";
import type { CheckAnnotation } from "../api/client.js";

export function annotationsForReport(report: BreaklineReport, config: BreaklineConfig): CheckAnnotation[] {
  if (!config.github.annotations) {
    return [];
  }
  const cap = config.report.maxAnnotations;
  return report.findings
    .filter((finding) => finding.confidence === "high" && finding.location?.path && finding.location.startLine)
    .slice(0, cap)
    .map(toAnnotation);
}

function toAnnotation(finding: Finding): CheckAnnotation {
  const line = finding.location!.startLine!;
  return {
    path: finding.location!.path,
    start_line: line,
    end_line: finding.location!.endLine ?? line,
    annotation_level: finding.severity === "high" ? "warning" : "notice",
    message: finding.title,
    title: "Breakline",
  };
}

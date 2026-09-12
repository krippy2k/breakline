import type { BreaklineReport, ImpactLevel } from "@breakline/report";

export type CheckConclusion = "success" | "neutral" | "failure" | "action_required";

export function conclusionForReport(report: BreaklineReport): CheckConclusion {
  return report.summary.impact === "none" ? "success" : "neutral";
}

export function titleForReport(report: BreaklineReport): string {
  if (report.summary.impact === "none") {
    return "No significant behavioral findings";
  }
  return `${capitalize(report.summary.impact)} behavioral impact`;
}

export function titleForFailure(): string {
  return "Breakline analysis failed";
}

export function capitalize(value: ImpactLevel | string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

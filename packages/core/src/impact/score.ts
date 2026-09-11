import type { ChangeImpact, ImpactLevel } from "./types.js";

export function scoreImpactLevel(impact: Pick<ChangeImpact, "directDependents" | "indirectDependents" | "entryPoints">): ImpactLevel {
  const dependents = impact.directDependents.length + impact.indirectDependents.length;
  const entryPoints = impact.entryPoints.length;
  const fanOut = impact.directDependents.length >= 8;
  const userVisible = impact.entryPoints.some(
    (item) =>
      item.entryPointKind === "http-route" ||
      item.entryPointKind === "event-handler" ||
      item.entryPointKind === "cli-command",
  );

  if (dependents > 5 || entryPoints > 1 || fanOut || userVisible) {
    return "high";
  }
  if (dependents >= 2 || entryPoints === 1) {
    return "medium";
  }
  return "low";
}

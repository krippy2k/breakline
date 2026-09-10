import type { BehaviorAnalyzer, BehaviorFinding, BehaviorFunction, ThrowEffect } from "../types.js";
import { findingBase } from "./helpers.js";

export class ExceptionAnalyzer implements BehaviorAnalyzer {
  analyze(before: BehaviorFunction, after: BehaviorFunction): BehaviorFinding[] {
    const findings: BehaviorFinding[] = [];
    const beforeThrows = collectThrows(before);
    const afterThrows = collectThrows(after);

    if (beforeThrows.length === 0 && afterThrows.length > 0) {
      findings.push({
        ...findingBase(after, "throw-added"),
        confidence: "high",
        after: { text: "throw", value: afterThrows[0].value },
        evidence: [{ kind: "throw", after: afterThrows[0], source: after.location }],
      });
    } else if (beforeThrows.length > 0 && afterThrows.length === 0) {
      findings.push({
        ...findingBase(after, "throw-removed"),
        confidence: "high",
        before: { text: "throw", value: beforeThrows[0].value },
        evidence: [{ kind: "throw", before: beforeThrows[0], source: after.location }],
      });
    }

    const beforeCatchTerminates = catchTerminates(before);
    const afterCatchTerminates = catchTerminates(after);
    if (beforeCatchTerminates && afterCatchTerminates === false) {
      const newly = callsAfterCatch(after);
      findings.push({
        ...findingBase(after, "call-newly-reachable"),
        confidence: newly[0] ? "high" : "medium",
        summary: "Failure path removed",
        before: { text: "failure terminated execution" },
        after: {
          text: newly[0]
            ? `failure is handled and execution continues; newly reachable: ${newly[0]}()`
            : "failure is handled and execution continues",
        },
        evidence: [{ kind: "control-flow", before: "catch-terminates", after: newly, source: after.location }],
      });
    }

    return findings;
  }
}

function collectThrows(fn: BehaviorFunction): ThrowEffect[] {
  return fn.paths.flatMap((path) => path.effects.filter((effect): effect is ThrowEffect => effect.kind === "throw"));
}

function catchTerminates(fn: BehaviorFunction): boolean | undefined {
  const catchPaths = fn.paths.filter((path) =>
    path.effects.some((effect) => effect.kind === "call" && effect.onCatch) ||
    path.conditions.some((condition) => condition.kind === "throws"),
  );
  if (catchPaths.length === 0) {
    return undefined;
  }
  return catchPaths.every((path) =>
    path.effects.some((effect) => effect.kind === "return" || effect.kind === "throw"),
  );
}

function callsAfterCatch(fn: BehaviorFunction): string[] {
  const names = new Set<string>();
  for (const path of fn.paths) {
    const catchIndex = path.effects.findIndex((effect) => effect.kind === "call" && effect.onCatch);
    if (catchIndex < 0) {
      continue;
    }
    for (const effect of path.effects.slice(catchIndex + 1)) {
      if (effect.kind === "call" && !effect.onCatch) {
        names.add(effect.callee);
      }
    }
  }
  return [...names];
}

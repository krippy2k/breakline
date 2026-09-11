import { printValue } from "../ir/print.js";
import type { BehaviorFunction, ThrowEffect } from "../types.js";
import { symbolOf, toChangeLocation } from "./helpers.js";
import type { Change } from "./types.js";

export function classifyExceptions(before: BehaviorFunction, after: BehaviorFunction): Change[] {
  const prev = collectThrows(before);
  const next = collectThrows(after);
  const usedAfter = new Set<number>();
  const changes: Change[] = [];

  for (const left of prev) {
    const match = next.findIndex((right, index) => !usedAfter.has(index) && right === left);
    if (match >= 0) {
      usedAfter.add(match);
      continue;
    }
    changes.push({
      kind: "throw_removed",
      symbol: symbolOf(after),
      location: toChangeLocation(after.location),
      before: `throw ${left}`,
    });
  }

  next.forEach((right, index) => {
    if (usedAfter.has(index)) {
      return;
    }
    changes.push({
      kind: "throw_added",
      symbol: symbolOf(after),
      location: toChangeLocation(after.location),
      after: `throw ${right}`,
    });
  });

  return changes;
}

function collectThrows(fn: BehaviorFunction): string[] {
  return fn.paths.flatMap((path) =>
    path.effects
      .filter((effect): effect is ThrowEffect => effect.kind === "throw")
      .map((effect) => printValue(effect.value)),
  );
}

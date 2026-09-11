import { jaccard, variableSet } from "../analysis/helpers.js";
import { printExpression } from "../ir/print.js";
import type { BehaviorExpression, BehaviorFunction } from "../types.js";
import { expressionsEqual } from "../witness/evaluate.js";
import { symbolOf, toChangeLocation } from "./helpers.js";
import type { Change } from "./types.js";

export function classifyConditions(before: BehaviorFunction, after: BehaviorFunction): Change[] {
  const changes: Change[] = [];
  const { pairs, unmatchedBefore, unmatchedAfter } = pairConditions(
    before.branchPredicates,
    after.branchPredicates,
  );

  for (const [left, right] of pairs) {
    if (expressionsEqual(left, right)) {
      continue;
    }
    changes.push({
      kind: "condition_changed",
      symbol: symbolOf(after),
      location: toChangeLocation(after.location),
      before: printExpression(left),
      after: printExpression(right),
    });
  }

  for (const left of unmatchedBefore) {
    changes.push({
      kind: "condition_changed",
      symbol: symbolOf(after),
      location: toChangeLocation(after.location),
      before: printExpression(left),
    });
  }

  for (const right of unmatchedAfter) {
    changes.push({
      kind: "condition_changed",
      symbol: symbolOf(after),
      location: toChangeLocation(after.location),
      after: printExpression(right),
    });
  }

  return changes;
}

function pairConditions(
  before: BehaviorExpression[],
  after: BehaviorExpression[],
): {
  pairs: [BehaviorExpression, BehaviorExpression][];
  unmatchedBefore: BehaviorExpression[];
  unmatchedAfter: BehaviorExpression[];
} {
  const usedAfter = new Set<number>();
  const usedBefore = new Set<number>();
  const pairs: [BehaviorExpression, BehaviorExpression][] = [];

  before.forEach((left, leftIndex) => {
    let best = -1;
    let bestScore = 0.49;
    after.forEach((right, index) => {
      if (usedAfter.has(index)) {
        return;
      }
      const score = jaccard(variableSet(left), variableSet(right));
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    if (best >= 0) {
      usedAfter.add(best);
      usedBefore.add(leftIndex);
      pairs.push([left, after[best]]);
    }
  });

  return {
    pairs,
    unmatchedBefore: before.filter((_, index) => !usedBefore.has(index)),
    unmatchedAfter: after.filter((_, index) => !usedAfter.has(index)),
  };
}

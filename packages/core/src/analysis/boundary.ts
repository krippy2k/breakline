import type { BehaviorAnalyzer, BehaviorExpression, BehaviorFinding, BehaviorFunction } from "../types.js";
import {
  allBranchConditions,
  comparePredicates,
  describeExpression,
  findingBase,
  isSimpleComparison,
  jaccard,
  variableSet,
} from "./helpers.js";

export class BoundaryAnalyzer implements BehaviorAnalyzer {
  analyze(): BehaviorFinding[] {
    return [];
  }

  async analyzeAsync(before: BehaviorFunction, after: BehaviorFunction): Promise<BehaviorFinding[]> {
    const findings: BehaviorFinding[] = [];
    const beforeConds = allBranchConditions(before).filter(isSimpleComparison);
    const afterConds = allBranchConditions(after).filter(isSimpleComparison);
    const used = new Set<number>();

    for (const left of beforeConds) {
      let best = -1;
      let bestScore = 0.49;
      afterConds.forEach((right, index) => {
        if (used.has(index)) {
          return;
        }
        const score = jaccard(variableSet(left), variableSet(right));
        if (score > bestScore) {
          bestScore = score;
          best = index;
        }
      });
      if (best < 0) {
        continue;
      }
      used.add(best);
      const right = afterConds[best];
      const result = await comparePredicates(left, right);
      if (result.equal || result.type !== "boundary-changed") {
        continue;
      }
      findings.push(toFinding(after, left, right, result.witness));
    }

    return findings;
  }
}

function toFinding(
  fn: BehaviorFunction,
  before: BehaviorExpression,
  after: BehaviorExpression,
  witness: BehaviorFinding["witness"],
): BehaviorFinding {
  return {
    ...findingBase(fn, "boundary-changed"),
    confidence: witness ? "high" : "medium",
    before: describeExpression(before),
    after: describeExpression(after),
    witness,
    evidence: [{ kind: "predicate", before, after, source: fn.location }],
  };
}

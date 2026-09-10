import type { BehaviorAnalyzer, BehaviorExpression, BehaviorFinding, BehaviorFunction } from "../types.js";
import {
  allBranchConditions,
  comparePredicates,
  describeExpression,
  findingBase,
  jaccard,
  variableSet,
} from "./helpers.js";

export class PredicateAnalyzer implements BehaviorAnalyzer {
  analyze(before: BehaviorFunction, after: BehaviorFunction): BehaviorFinding[] {
    return [];
  }

  async analyzeAsync(before: BehaviorFunction, after: BehaviorFunction): Promise<BehaviorFinding[]> {
    const findings: BehaviorFinding[] = [];
    const pairs = pairConditions(allBranchConditions(before), allBranchConditions(after));

    for (const [left, right] of pairs) {
      const result = await comparePredicates(left, right);
      if (result.equal || result.type === "boundary-changed") {
        continue;
      }

      findings.push({
        ...findingBase(after, result.type),
        confidence: result.witness ? "high" : "medium",
        before: describeExpression(left),
        after: describeExpression(right),
        witness: result.witness,
        evidence: [
          {
            kind: "predicate",
            before: left,
            after: right,
            source: after.location,
          },
        ],
      });
    }

    return findings;
  }
}

function pairConditions(
  before: BehaviorExpression[],
  after: BehaviorExpression[],
): [BehaviorExpression, BehaviorExpression][] {
  const usedAfter = new Set<number>();
  const pairs: [BehaviorExpression, BehaviorExpression][] = [];

  for (const left of before) {
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
      pairs.push([left, after[best]]);
    }
  }

  return pairs;
}

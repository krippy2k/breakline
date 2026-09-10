import { printValue } from "../ir/print.js";
import type {
  BehaviorAnalyzer,
  BehaviorFinding,
  BehaviorFunction,
  BehaviorPath,
  ReturnEffect,
} from "../types.js";
import { expressionsEqual } from "../witness/evaluate.js";
import { findingBase, pathPredicate, returnValueKey } from "./helpers.js";

interface ReturnSite {
  path: BehaviorPath;
  effect: ReturnEffect;
}

export class ReturnAnalyzer implements BehaviorAnalyzer {
  analyze(before: BehaviorFunction, after: BehaviorFunction): BehaviorFinding[] {
    const beforeReturns = collectReturns(before);
    const afterReturns = collectReturns(after);
    const findings: BehaviorFinding[] = [];
    const matchedAfter = new Set<ReturnSite>();
    const matchedBefore = new Set<ReturnSite>();

    for (const left of beforeReturns) {
      const sameCond = afterReturns.find(
        (right) =>
          !matchedAfter.has(right) && expressionsEqual(pathPredicate(left.path), pathPredicate(right.path)),
      );
      if (sameCond) {
        matchedAfter.add(sameCond);
        matchedBefore.add(left);
        if (returnValueKey(left.effect.value) !== returnValueKey(sameCond.effect.value)) {
          findings.push(returnChanged(after, left.effect, sameCond.effect));
        }
      }
    }

    for (const left of beforeReturns) {
      if (matchedBefore.has(left)) {
        continue;
      }
      const sameValue = afterReturns.find(
        (right) =>
          !matchedAfter.has(right) && returnValueKey(left.effect.value) === returnValueKey(right.effect.value),
      );
      if (sameValue) {
        matchedAfter.add(sameValue);
        matchedBefore.add(left);
      }
    }

    const unmatchedBefore = beforeReturns.filter((item) => !matchedBefore.has(item));
    const unmatchedAfter = afterReturns.filter((item) => !matchedAfter.has(item));

    if (unmatchedBefore.length > 0 && unmatchedAfter.length === 0) {
      findings.push({
        ...findingBase(after, "return-removed"),
        confidence: "high",
        before: { text: printValue(unmatchedBefore[0].effect.value), value: unmatchedBefore[0].effect.value },
        evidence: [{ kind: "return", before: unmatchedBefore[0].effect, source: after.location }],
      });
    } else if (unmatchedAfter.length > 0 && unmatchedBefore.length === 0) {
      findings.push({
        ...findingBase(after, "return-added"),
        confidence: "high",
        after: { text: printValue(unmatchedAfter[0].effect.value), value: unmatchedAfter[0].effect.value },
        evidence: [{ kind: "return", after: unmatchedAfter[0].effect, source: after.location }],
      });
    } else if (unmatchedBefore.length > 0 && unmatchedAfter.length > 0) {
      const left = unmatchedBefore[0];
      const right = unmatchedAfter[0];
      if (returnValueKey(left.effect.value) !== returnValueKey(right.effect.value)) {
        findings.push(returnChanged(after, left.effect, right.effect));
      } else {
        findings.push({
          ...findingBase(after, "return-changed"),
          confidence: "medium",
          before: { text: printValue(left.effect.value), value: left.effect.value },
          after: { text: printValue(right.effect.value), value: right.effect.value },
          evidence: [{ kind: "return", before: left.effect, after: right.effect, source: after.location }],
        });
      }
    }

    return findings;
  }
}

function collectReturns(fn: BehaviorFunction): ReturnSite[] {
  const sites: ReturnSite[] = [];
  for (const path of fn.paths) {
    for (const effect of path.effects) {
      if (effect.kind === "return") {
        sites.push({ path, effect });
      }
    }
  }
  return sites;
}

function returnChanged(
  fn: BehaviorFunction,
  before: ReturnEffect,
  after: ReturnEffect,
): BehaviorFinding {
  return {
    ...findingBase(fn, "return-changed"),
    confidence: "high",
    before: { text: printValue(before.value), value: before.value },
    after: { text: printValue(after.value), value: after.value },
    evidence: [{ kind: "return", before, after, source: fn.location }],
  };
}

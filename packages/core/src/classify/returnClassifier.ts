import { pathPredicate, returnValueKey } from "../analysis/helpers.js";
import { printValue } from "../ir/print.js";
import type { BehaviorFunction, BehaviorPath, ReturnEffect } from "../types.js";
import { expressionsEqual } from "../witness/evaluate.js";
import { symbolOf, toChangeLocation } from "./helpers.js";
import type { Change } from "./types.js";

interface ReturnSite {
  path: BehaviorPath;
  effect: ReturnEffect;
}

export function classifyReturns(before: BehaviorFunction, after: BehaviorFunction): Change[] {
  const beforeReturns = collectReturns(before);
  const afterReturns = collectReturns(after);
  const matchedAfter = new Set<ReturnSite>();
  const matchedBefore = new Set<ReturnSite>();
  const changes: Change[] = [];

  for (const left of beforeReturns) {
    const sameBoth = afterReturns.find(
      (right) =>
        !matchedAfter.has(right) &&
        expressionsEqual(pathPredicate(left.path), pathPredicate(right.path)) &&
        returnValueKey(left.effect.value) === returnValueKey(right.effect.value),
    );
    if (sameBoth) {
      matchedAfter.add(sameBoth);
      matchedBefore.add(left);
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

  for (const left of beforeReturns) {
    if (matchedBefore.has(left)) {
      continue;
    }
    const sameCond = afterReturns.find(
      (right) =>
        !matchedAfter.has(right) && expressionsEqual(pathPredicate(left.path), pathPredicate(right.path)),
    );
    if (!sameCond) {
      continue;
    }
    matchedAfter.add(sameCond);
    matchedBefore.add(left);
    changes.push(returnChange(after, printValue(left.effect.value), printValue(sameCond.effect.value)));
  }

  const unmatchedBefore = beforeReturns.filter((item) => !matchedBefore.has(item));
  const unmatchedAfter = afterReturns.filter((item) => !matchedAfter.has(item));

  if (unmatchedBefore.length > 0 && unmatchedAfter.length === 0) {
    changes.push(returnChange(after, printValue(unmatchedBefore[0].effect.value), undefined));
  } else if (unmatchedAfter.length > 0 && unmatchedBefore.length === 0) {
    changes.push(returnChange(after, undefined, printValue(unmatchedAfter[0].effect.value)));
  } else if (unmatchedBefore.length > 0 && unmatchedAfter.length > 0) {
    const left = unmatchedBefore[0];
    const right = unmatchedAfter[0];
    if (returnValueKey(left.effect.value) !== returnValueKey(right.effect.value)) {
      changes.push(returnChange(after, printValue(left.effect.value), printValue(right.effect.value)));
    }
  }

  return changes;
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

function returnChange(fn: BehaviorFunction, before?: string, after?: string): Change {
  return {
    kind: "return_changed",
    symbol: symbolOf(fn),
    location: toChangeLocation(fn.location),
    before,
    after,
  };
}

import type { BehaviorFunction, SymbolIdentity } from "../types.js";

export function symbolKey(identity: Pick<SymbolIdentity, "container" | "name" | "kind">): string {
  return `${identity.container ?? ""}::${identity.name}::${identity.kind}`;
}

export function matchFunctionsDetailed(
  before: BehaviorFunction[],
  after: BehaviorFunction[],
): {
  pairs: { before: BehaviorFunction; after: BehaviorFunction }[];
  added: BehaviorFunction[];
  removed: BehaviorFunction[];
} {
  const remaining = [...after];
  const pairs: { before: BehaviorFunction; after: BehaviorFunction }[] = [];
  const removed: BehaviorFunction[] = [];

  for (const left of before) {
    const exact = remaining.findIndex((right) => symbolKey(left.identity) === symbolKey(right.identity));
    if (exact >= 0) {
      pairs.push({ before: left, after: remaining.splice(exact, 1)[0] });
      continue;
    }
    const byName = remaining.findIndex(
      (right) => right.identity.name === left.identity.name && right.identity.container === left.identity.container,
    );
    if (byName >= 0) {
      pairs.push({ before: left, after: remaining.splice(byName, 1)[0] });
      continue;
    }
    removed.push(left);
  }

  return { pairs, added: remaining, removed };
}

export function matchFunctions(
  before: BehaviorFunction[],
  after: BehaviorFunction[],
): { before: BehaviorFunction; after: BehaviorFunction }[] {
  return matchFunctionsDetailed(before, after).pairs;
}

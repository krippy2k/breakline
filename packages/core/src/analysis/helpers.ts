import { printExpression, printValue } from "../ir/print.js";
import type {
  BehaviorEffect,
  BehaviorExpression,
  BehaviorFinding,
  BehaviorFunction,
  BehaviorPath,
  BehaviorValue,
  FindingType,
} from "../types.js";
import { andAll, collectVariables, evaluateExpression, expressionsEqual, orAll } from "../witness/evaluate.js";
import { CompositeWitnessSolver } from "../witness/composite.js";

const solver = new CompositeWitnessSolver();

export function pathPredicate(path: BehaviorPath): BehaviorExpression {
  return andAll(path.conditions);
}

export function enablingPredicate(
  paths: BehaviorPath[],
  match: (effect: BehaviorEffect) => boolean,
): BehaviorExpression | undefined {
  const matched = paths.filter((path) => path.effects.some(match));
  if (matched.length === 0) {
    return undefined;
  }
  return orAll(matched.map(pathPredicate));
}

export function isSimpleComparison(expr: BehaviorExpression): boolean {
  return expr.kind === "comparison";
}

export function returnValueKey(value: BehaviorValue | undefined): string {
  return printValue(value);
}

export async function comparePredicates(
  before: BehaviorExpression,
  after: BehaviorExpression,
): Promise<{
  type: FindingType;
  witness?: BehaviorFinding["witness"];
  equal: boolean;
}> {
  if (expressionsEqual(before, after)) {
    return { type: "predicate-changed", equal: true };
  }

  const witness = await solver.findDifference(before, after);
  const type =
    isSimpleComparison(before) && isSimpleComparison(after)
      ? "boundary-changed"
      : witness
        ? relatePredicates(before, after)
        : "predicate-changed";

  return { type, witness: witness ?? undefined, equal: false };
}

function relatePredicates(before: BehaviorExpression, after: BehaviorExpression): FindingType {
  const vars = [
    ...new Set(
      [...collectVariables(before), ...collectVariables(after)]
        .filter((item) => item.sort === "boolean")
        .map((item) => item.name),
    ),
  ].sort();

  if (vars.length === 0 || vars.length > 8) {
    return "predicate-changed";
  }

  let beforeTrue = 0;
  let afterTrue = 0;
  let beforeImpliesAfter = true;
  let afterImpliesBefore = true;
  const total = 1 << vars.length;

  for (let i = 0; i < total; i += 1) {
    const env: Record<string, boolean> = {};
    for (let j = 0; j < vars.length; j += 1) {
      env[vars[j]] = Boolean(i & (1 << (vars.length - 1 - j)));
    }
    const beforeResult = evaluateExpression(before, env);
    const afterResult = evaluateExpression(after, env);
    if (beforeResult) {
      beforeTrue += 1;
    }
    if (afterResult) {
      afterTrue += 1;
    }
    if (beforeResult && !afterResult) {
      beforeImpliesAfter = false;
    }
    if (afterResult && !beforeResult) {
      afterImpliesBefore = false;
    }
  }

  if (beforeImpliesAfter && afterTrue > beforeTrue) {
    return "predicate-expanded";
  }
  if (afterImpliesBefore && beforeTrue > afterTrue) {
    return "predicate-restricted";
  }
  return "predicate-changed";
}

export function findingBase(
  fn: BehaviorFunction,
  type: FindingType,
): Pick<BehaviorFinding, "type" | "file" | "symbol" | "location" | "summary"> {
  return {
    type,
    file: fn.file,
    symbol: fn.identity.container ? `${fn.identity.container}.${fn.name}` : fn.name,
    location: fn.location,
    summary: summaryFor(type),
  };
}

export function summaryFor(type: FindingType): string {
  switch (type) {
    case "predicate-expanded":
      return "Predicate expanded";
    case "predicate-restricted":
      return "Predicate restricted";
    case "predicate-changed":
      return "Predicate changed";
    case "boundary-changed":
      return "Boundary changed";
    case "return-changed":
      return "Return behavior changed";
    case "return-added":
      return "Return added";
    case "return-removed":
      return "Return removed";
    case "throw-added":
      return "Throw added";
    case "throw-removed":
      return "Throw removed";
    case "call-newly-reachable":
      return "Call newly reachable";
    case "call-no-longer-reachable":
      return "Call no longer reachable";
    case "call-became-unconditional":
      return "Call became unconditional";
  }
}

export function describeExpression(expr: BehaviorExpression) {
  return { text: printExpression(expr), expression: expr };
}

export function allBranchConditions(fn: BehaviorFunction): BehaviorExpression[] {
  return fn.branchPredicates;
}

export function variableSet(expr: BehaviorExpression): Set<string> {
  return new Set(collectVariables(expr).map((item) => item.name));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  let inter = 0;
  for (const item of a) {
    if (b.has(item)) {
      inter += 1;
    }
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

import type { BehaviorExpression, BehaviorWitness, WitnessSolver } from "../types.js";
import {
  collectConstants,
  collectVariables,
  evaluateExpression,
  type Env,
} from "./evaluate.js";

const MAX_COMBINATIONS = 256;

export class NumericBoundarySolver implements WitnessSolver {
  async findDifference(
    before: BehaviorExpression,
    after: BehaviorExpression,
  ): Promise<BehaviorWitness | null> {
    const vars = uniqueNumeric([...collectVariables(before), ...collectVariables(after)]);
    const constants = uniqueNumbers([
      ...collectConstants(before),
      ...collectConstants(after),
    ]);
    if (vars.length === 0 || constants.length === 0) {
      return null;
    }

    const candidates = uniqueNumbers(
      constants.flatMap((value) => [value - 1, value, value + 1]),
    );
    const assignments = cartesian(
      vars.map((name) => candidates.map((value) => [name, value] as const)),
    );
    if (assignments.length > MAX_COMBINATIONS) {
      return null;
    }

    for (const assignment of assignments) {
      const env: Env = Object.fromEntries(assignment);
      const beforeResult = evaluateExpression(before, env);
      const afterResult = evaluateExpression(after, env);
      if (beforeResult !== afterResult) {
        return {
          bindings: env,
          before: String(beforeResult),
          after: String(afterResult),
        };
      }
    }

    return null;
  }
}

function uniqueNumeric(vars: { name: string; sort: "boolean" | "number" }[]): string[] {
  return [...new Set(vars.filter((item) => item.sort === "number").map((item) => item.name))].sort();
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])), [[]]);
}

import type { BehaviorExpression, BehaviorWitness, WitnessSolver } from "../types.js";
import {
  collectConstants,
  collectVariables,
  evaluateExpression,
  type Env,
} from "./evaluate.js";

const MAX_BOOL = 6;
const MAX_NUM_CANDIDATES = 9;

export class MixedWitnessSolver implements WitnessSolver {
  async findDifference(
    before: BehaviorExpression,
    after: BehaviorExpression,
  ): Promise<BehaviorWitness | null> {
    const vars = [...collectVariables(before), ...collectVariables(after)];
    const bools = [...new Set(vars.filter((item) => item.sort === "boolean").map((item) => item.name))].sort();
    const nums = [...new Set(vars.filter((item) => item.sort === "number").map((item) => item.name))].sort();
    if (bools.length === 0 || nums.length === 0 || bools.length > MAX_BOOL) {
      return null;
    }

    const constants = [
      ...new Set([...collectConstants(before), ...collectConstants(after)]),
    ].sort((a, b) => a - b);
    const candidates = [
      ...new Set(constants.flatMap((value) => [value - 1, value, value + 1])),
    ].sort((a, b) => a - b);
    if (candidates.length === 0 || candidates.length > MAX_NUM_CANDIDATES) {
      return null;
    }

    const boolTotal = 1 << bools.length;
    const numAssignments = cartesian(nums.map(() => candidates));

    for (let i = 0; i < boolTotal; i += 1) {
      for (const numsAssign of numAssignments) {
        const env: Env = {};
        for (let j = 0; j < bools.length; j += 1) {
          env[bools[j]] = Boolean(i & (1 << (bools.length - 1 - j)));
        }
        nums.forEach((name, index) => {
          env[name] = numsAssign[index];
        });
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
    }

    return null;
  }
}

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  );
}

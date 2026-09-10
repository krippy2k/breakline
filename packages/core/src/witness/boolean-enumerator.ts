import type { BehaviorExpression, BehaviorWitness, WitnessSolver } from "../types.js";
import { collectVariables, evaluateExpression, type Env } from "./evaluate.js";

const MAX_BOOLEAN_VARS = 8;

export class BooleanEnumerator implements WitnessSolver {
  async findDifference(
    before: BehaviorExpression,
    after: BehaviorExpression,
  ): Promise<BehaviorWitness | null> {
    const vars = uniqueVars([...collectVariables(before), ...collectVariables(after)]);
    if (vars.length === 0 || vars.length > MAX_BOOLEAN_VARS || vars.some((item) => item.sort !== "boolean")) {
      return null;
    }

    const names = vars.map((item) => item.name).sort();
    const total = 1 << names.length;

    for (let i = 0; i < total; i += 1) {
      const env: Env = {};
      for (let j = 0; j < names.length; j += 1) {
        env[names[j]] = Boolean(i & (1 << (names.length - 1 - j)));
      }
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

function uniqueVars(
  vars: { name: string; sort: "boolean" | "number" }[],
): { name: string; sort: "boolean" | "number" }[] {
  const map = new Map<string, "boolean" | "number">();
  for (const item of vars) {
    const existing = map.get(item.name);
    map.set(item.name, existing === "number" || item.sort === "number" ? "number" : "boolean");
  }
  return [...map.entries()].map(([name, sort]) => ({ name, sort }));
}

import { describe, expect, it } from "vitest";
import { BooleanEnumerator } from "../src/witness/boolean-enumerator.js";
import { NumericBoundarySolver } from "../src/witness/numeric-boundary.js";
import { evaluateExpression } from "../src/witness/evaluate.js";
import type { BehaviorExpression } from "../src/types.js";

const and: BehaviorExpression = {
  kind: "logical",
  operator: "and",
  left: { kind: "boolean", value: { kind: "identifier", name: "admin" } },
  right: { kind: "boolean", value: { kind: "identifier", name: "active" } },
};

const or: BehaviorExpression = {
  kind: "logical",
  operator: "or",
  left: { kind: "boolean", value: { kind: "identifier", name: "admin" } },
  right: { kind: "boolean", value: { kind: "identifier", name: "active" } },
};

describe("witness solvers", () => {
  it("enumerates a boolean difference for AND vs OR", async () => {
    const witness = await new BooleanEnumerator().findDifference(and, or);
    expect(witness).toBeTruthy();
    const bindings = witness!.bindings;
    expect(evaluateExpression(and, bindings)).not.toBe(evaluateExpression(or, bindings));
  });

  it("finds age=18 for >= vs >", async () => {
    const gte: BehaviorExpression = {
      kind: "comparison",
      operator: ">=",
      left: { kind: "identifier", name: "age" },
      right: { kind: "literal", value: 18 },
    };
    const gt: BehaviorExpression = {
      kind: "comparison",
      operator: ">",
      left: { kind: "identifier", name: "age" },
      right: { kind: "literal", value: 18 },
    };
    const witness = await new NumericBoundarySolver().findDifference(gte, gt);
    expect(witness?.bindings.age).toBe(18);
    expect(witness?.before).toBe("true");
    expect(witness?.after).toBe("false");
  });
});

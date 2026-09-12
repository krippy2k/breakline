import { describe, expect, it } from "vitest";
import { classifyImpact } from "../src/classify-impact.js";
import type { Finding } from "../src/types.js";

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: "bl_test",
    category: "other",
    severity: "low",
    confidence: "medium",
    title: "Changed",
    description: "Changed",
    ...overrides,
  };
}

describe("classifyImpact", () => {
  it("returns none when there are no findings", () => {
    expect(classifyImpact([])).toBe("none");
  });

  it("returns high for high-severity high-confidence findings", () => {
    expect(
      classifyImpact([finding({ severity: "high", confidence: "high", category: "return-value" })]),
    ).toBe("high");
  });

  it("returns high when authorization behavior changed", () => {
    expect(classifyImpact([finding({ category: "authorization", severity: "medium" })])).toBe("high");
  });

  it("returns high when validation was removed", () => {
    expect(
      classifyImpact([
        finding({
          category: "validation",
          title: "Missing customerId is no longer rejected",
          description: "Validation removed from checkout",
        }),
      ]),
    ).toBe("high");
  });

  it("returns medium for multiple medium findings", () => {
    expect(
      classifyImpact([
        finding({ severity: "medium", category: "return-value" }),
        finding({ id: "b", severity: "medium", category: "call-behavior" }),
      ]),
    ).toBe("medium");
  });

  it("returns medium for meaningful control-flow changes", () => {
    expect(classifyImpact([finding({ category: "control-flow", confidence: "high" })])).toBe("medium");
  });

  it("returns low for limited low-confidence differences", () => {
    expect(classifyImpact([finding({ confidence: "low", category: "other" })])).toBe("low");
  });
});

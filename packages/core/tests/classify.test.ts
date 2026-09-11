import { describe, expect, it } from "vitest";
import { compareSources, findingId } from "../src/index.js";

async function classify(before: string, after: string, file = "example.ts") {
  return compareSources({
    beforeFile: file,
    afterFile: file,
    beforeSource: before,
    afterSource: after,
  });
}

describe("signature classifier", () => {
  it("does not flag a parameter type-only annotation change", async () => {
    const result = await classify(
      "export function id(value: string) { return value; }",
      "export function id(value: number) { return value; }",
    );
    expect(result.changes ?? []).toEqual([]);
  });

  it("detects a parameter becoming required", async () => {
    const result = await classify(
      "export function run(options?: object) { return options; }",
      "export function run(options: object) { return options; }",
    );
    const change = result.changes?.[0];
    expect(change?.kind).toBe("signature_changed");
    const finding = result.report?.[0];
    expect(finding?.detail).toContain('Parameter "options" is now required.');
    expect(finding?.severity).toBe("warning");
  });

  it("detects async added", async () => {
    const result = await classify(
      "export function load() { return 1; }",
      "export async function load() { return 1; }",
    );
    expect(result.changes?.[0]?.kind).toBe("signature_changed");
    expect(result.report?.[0]?.detail).toContain("now async");
  });
});

describe("condition classifier", () => {
  it("does not flag a swapped comparison", async () => {
    const result = await classify(
      "export function ok(x: number) { if (x > 10) return true; return false; }",
      "export function ok(x: number) { if (10 < x) return true; return false; }",
    );
    expect((result.changes ?? []).filter((change) => change.kind === "condition_changed")).toEqual([]);
  });

  it("uses neutral language when widening cannot be established", async () => {
    const result = await classify(
      `export function canCancel(status: string) {
        if (status === "pending") return true;
        return false;
      }`,
      `export function canCancel(status: string) {
        if (status !== "shipped") return true;
        return false;
      }`,
    );
    expect(result.report?.[0]?.kind).toBe("condition_changed");
    expect(result.report?.[0]?.summary).toBe("Condition changed");
    expect(result.report?.[0]?.detail ?? "").not.toContain("Witness");
  });
});

describe("finding ids", () => {
  it("are deterministic", () => {
    const first = findingId({
      kind: "call_added",
      symbol: "processOrder",
      file: "orders.ts",
      after: "auditOrder(order.id)",
    });
    const second = findingId({
      kind: "call_added",
      symbol: "processOrder",
      file: "orders.ts",
      after: "auditOrder(order.id)",
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^bl_[0-9a-f]{16}$/);
  });
});

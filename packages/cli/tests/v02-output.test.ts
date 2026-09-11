import { describe, expect, it } from "vitest";
import { compareSources, formatJsonReport, formatTextReport, JSON_SCHEMA_VERSION } from "@breakline/core";

describe("v0.2 output", () => {
  it("renders grouped text from the Finding model", async () => {
    const result = await compareSources({
      beforeFile: "orders.ts",
      afterFile: "orders.ts",
      beforeSource: `export function processOrder(status: string) {
        if (status === "pending") {
          save(status);
          return true;
        }
        return false;
      }
      declare function save(status: string): void;
      `,
      afterSource: `export function processOrder(status: string) {
        if (status !== "shipped") {
          save(status);
          auditOrder(status);
          return false;
        }
        return false;
      }
      declare function save(status: string): void;
      declare function auditOrder(status: string): void;
      `,
    });

    const text = formatTextReport(result);
    expect(text).toContain("BREAKLINE  orders.ts");
    expect(text).toContain("processOrder()");
    expect(text).toContain("BEHAVIOR CHANGED");
    expect(text).toContain("Condition changed");
    expect(text).toContain("before: status === \"pending\"");
    expect(text).toContain("after:  status !== \"shipped\"");
    expect(text).toContain("New call");
    expect(text).toContain("auditOrder(status)");
  });

  it("emits a versioned JSON envelope", async () => {
    const result = await compareSources({
      beforeFile: "greet.ts",
      afterFile: "greet.ts",
      beforeSource: "export function greet(name: string) { return name; }",
      afterSource: "export function greet(name: string, title: string) { return name; }",
    });
    const parsed = JSON.parse(formatJsonReport(result));
    expect(parsed.schemaVersion).toBe(JSON_SCHEMA_VERSION);
    expect(parsed.schemaVersion).toBe("0.3");
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].path).toBe("greet.ts");
    expect(parsed.files[0].findings[0].kind).toBe("signature_changed");
    expect(parsed.files[0].findings[0].id).toMatch(/^bl_/);
  });
});

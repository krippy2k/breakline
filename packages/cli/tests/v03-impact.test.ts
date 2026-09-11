import { describe, expect, it } from "vitest";
import {
  attachImpact,
  compareSources,
  formatAnalysisText,
  formatJsonReport,
} from "@breakline/core";

describe("v0.3 impact output", () => {
  it("includes impact in JSON and text when attached", async () => {
    const files = [
      { file: "b.ts", source: "export function b() { return 2; }" },
      { file: "a.ts", source: `import { b } from "./b"; export function a() { b(); }` },
    ];
    const result = attachImpact(
      await compareSources({
        beforeFile: "b.ts",
        afterFile: "b.ts",
        beforeSource: "export function b() { return 1; }",
        afterSource: "export function b() { return 2; }",
      }),
      files,
    );
    const text = formatAnalysisText(result, { showImpactPaths: true });
    expect(text).toContain("Direct dependents:");
    expect(text).toContain("a()");
    const json = JSON.parse(formatJsonReport(result));
    expect(json.schemaVersion).toBe("0.3");
    expect(json.impact.changes[0].symbol.qualifiedName).toBe("b");
    expect(json.impact.changes[0].impact.directDependents[0].qualifiedName).toBe("a");
  });
});

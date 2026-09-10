import { describe, expect, it } from "vitest";
import { formatCompare, formatInspect } from "../src/reporter.js";
import type { AnalysisResult, InspectedFunction } from "@breakline/core";

describe("reporter", () => {
  it("lists inspected functions", () => {
    const functions: InspectedFunction[] = [
      {
        identity: { file: "a.ts", name: "canDelete", kind: "function" },
        parameters: [
          { name: "isAdmin", type: "boolean" },
          { name: "isOwner", type: "boolean" },
        ],
        location: {
          file: "a.ts",
          start: { line: 1, column: 1 },
          end: { line: 8, column: 2 },
        },
      },
    ];
    const output = formatInspect("a.ts", functions);
    expect(output).toContain("canDelete(isAdmin: boolean, isOwner: boolean)");
    expect(output).toContain("Functions: 1");
  });

  it("renders a compare report", () => {
    const result: AnalysisResult = {
      filesAnalyzed: 1,
      functionsCompared: 1,
      findings: [
        {
          type: "predicate-expanded",
          confidence: "high",
          file: "after.ts",
          symbol: "canDelete",
          summary: "Predicate expanded",
          before: { text: "isAdmin && isOwner" },
          after: { text: "isAdmin || isOwner" },
          witness: {
            bindings: { isAdmin: true, isOwner: false },
            before: "false",
            after: "true",
          },
          evidence: [],
        },
      ],
    };
    const output = formatCompare(result);
    expect(output).toContain("1 behavioral change found");
    expect(output).toContain("HIGH");
    expect(output).toContain("Predicate expanded");
    expect(output).toContain("isAdmin = true");
    expect(output).toContain("Previous result:");
    expect(output).toContain("false");
  });

  it("hides low-confidence findings by default", () => {
    const result: AnalysisResult = {
      filesAnalyzed: 1,
      functionsCompared: 1,
      findings: [
        {
          type: "predicate-changed",
          confidence: "low",
          file: "a.ts",
          symbol: "foo",
          summary: "Predicate changed",
          evidence: [],
        },
      ],
    };
    expect(formatCompare(result)).toContain("No behavioral changes found");
    expect(formatCompare(result, true)).toContain("Predicate changed");
  });
});

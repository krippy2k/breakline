import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "@breakline/core";
import { toBreaklineReport } from "../src/from-analysis.js";

const startedAt = "2026-09-11T18:00:00.000Z";

describe("toBreaklineReport", () => {
  it("maps core findings and classifies authorization impact", () => {
    const result: AnalysisResult = {
      filesAnalyzed: 1,
      functionsCompared: 1,
      findings: [
        {
          type: "predicate-expanded",
          confidence: "high",
          file: "src/auth/payment.ts",
          symbol: "authorizePayment",
          summary: "Predicate expanded",
          before: { text: "user.isAdmin || user.accountId === payment.accountId" },
          after: { text: "user.isAdmin || user.isSupport" },
          evidence: [],
        },
      ],
      report: [
        {
          id: "bl_auth",
          kind: "condition_changed",
          symbol: "authorizePayment",
          summary: "Condition changed",
          before: "user.isAdmin || user.accountId === payment.accountId",
          after: "user.isAdmin || user.isSupport",
          location: { file: "src/auth/payment.ts", line: 84 },
          severity: "info",
        },
      ],
      files: ["src/auth/payment.ts"],
    };

    const report = toBreaklineReport(result, {
      analysisId: "analysis-1",
      baseRevision: "aaa",
      headRevision: "bbb",
      startedAt,
    });

    expect(report.schemaVersion).toBe("0.4");
    expect(report.summary.impact).toBe("high");
    expect(report.summary.findingCount).toBe(1);
    expect(report.summary.highConfidenceCount).toBe(1);
    expect(report.findings[0]?.category).toBe("authorization");
    expect(report.findings[0]?.severity).toBe("high");
    expect(report.findings[0]?.title).toBe("Predicate expanded");
    expect(report.findings[0]?.location).toEqual({ path: "src/auth/payment.ts", startLine: 84 });
  });

  it("filters findings below the configured confidence", () => {
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
      report: [
        {
          id: "bl_low",
          kind: "condition_changed",
          symbol: "foo",
          summary: "Condition changed",
          location: { file: "a.ts", line: 1 },
          severity: "info",
        },
      ],
    };

    const report = toBreaklineReport(result, {
      baseRevision: "a",
      headRevision: "b",
      startedAt,
      config: {
        version: 1,
        github: { enabled: true, comment: false, annotations: true, analyzeDrafts: true },
        analysis: {
          minConfidence: "medium",
          maxChangedFiles: 200,
          maxCheckoutBytes: 1,
          maxDurationMs: 1,
          impact: false,
        },
        report: { maxGithubFindings: 5, maxAnnotations: 10 },
      },
    });

    expect(report.findings).toHaveLength(0);
    expect(report.summary.impact).toBe("none");
  });
});

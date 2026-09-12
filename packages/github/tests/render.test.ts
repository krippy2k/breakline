import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type BreaklineReport } from "@breakline/report";
import { annotationsForReport } from "../src/render/annotations.js";
import { renderCheckSummary, renderFailureSummary } from "../src/render/check-summary.js";
import { COMMENT_MARKER, isBreaklineComment, renderPullRequestComment } from "../src/render/comment.js";
import { conclusionForReport } from "../src/render/conclusion.js";

function report(overrides: Partial<BreaklineReport> = {}): BreaklineReport {
  return {
    schemaVersion: "0.4",
    analysis: {
      id: "a1",
      baseRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      headRevision: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      startedAt: "2026-09-11T18:00:00.000Z",
      completedAt: "2026-09-11T18:00:01.000Z",
      filesAnalyzed: 1,
      functionsCompared: 1,
    },
    summary: {
      impact: "high",
      findingCount: 3,
      highConfidenceCount: 2,
      byCategory: { authorization: 1, "error-flow": 1, validation: 1 },
      bySeverity: { high: 2, medium: 1 },
    },
    findings: [
      {
        id: "1",
        category: "authorization",
        severity: "high",
        confidence: "high",
        title: "Authorization condition widened",
        description: "Support can now authorize payments",
        symbol: "authorizePayment",
        location: { path: "src/auth/payment.ts", startLine: 84 },
      },
      {
        id: "2",
        category: "error-flow",
        severity: "medium",
        confidence: "high",
        title: "Retry limit removed",
        description: "Retries are now unlimited",
        symbol: "processTransaction",
      },
      {
        id: "3",
        category: "validation",
        severity: "medium",
        confidence: "medium",
        title: "Missing customerId is no longer rejected",
        description: "Validation removed",
      },
    ],
    metadata: { source: "core" },
    ...overrides,
  };
}

describe("GitHub rendering", () => {
  it("maps findings to an informational check conclusion", () => {
    expect(conclusionForReport(report())).toBe("neutral");
    expect(conclusionForReport(report({ summary: { ...report().summary, impact: "none", findingCount: 0 } }))).toBe(
      "success",
    );
  });

  it("renders a compact check summary", () => {
    const markdown = renderCheckSummary(report(), {
      reportUrl: "https://app.breakline.dev/r/github/acme/payments/pull/184/analysis/a1",
      maxFindings: 5,
    });
    expect(markdown).toContain("**Behavioral Impact:** High");
    expect(markdown).toContain("**Findings:** 3");
    expect(markdown).toContain("**High Confidence:** 2");
    expect(markdown).toContain("Authorization condition widened in `authorizePayment()`");
    expect(markdown).toContain("[View full report in Breakline]");
    expect(markdown).toContain("`aaaaaaa`");
  });

  it("renders a persistent PR comment with a locator marker", () => {
    const body = renderPullRequestComment(report(), { reportUrl: "https://example.test/r/a1" });
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(isBreaklineComment(body)).toBe(true);
    expect(body).toContain("**Impact: High**");
    expect(body).toContain("2 high-confidence findings");
  });

  it("renders a safe failure summary", () => {
    const markdown = renderFailureSummary({ reason: "Repository fetch failed.", errorId: "BL-01JTEST" });
    expect(markdown).toContain("Unable to analyze this pull request.");
    expect(markdown).toContain("Repository fetch failed.");
    expect(markdown).toContain("Error ID: BL-01JTEST");
    expect(markdown).not.toContain("token");
  });

  it("caps high-confidence annotations", () => {
    const many = report({
      findings: Array.from({ length: 12 }, (_, index) => ({
        id: String(index),
        category: "control-flow" as const,
        severity: "medium" as const,
        confidence: "high" as const,
        title: `Finding ${index}`,
        description: "x",
        location: { path: `src/f${index}.ts`, startLine: index + 1 },
      })),
    });
    expect(annotationsForReport(many, DEFAULT_CONFIG)).toHaveLength(10);
  });
});

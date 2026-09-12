import { describe, expect, it } from "vitest";
import { renderReportPage } from "../src/views/report.js";
import { renderSetupPage } from "../src/views/setup.js";
import type { AnalysisRecord } from "@breakline/github";

describe("hosted pages", () => {
  it("escapes user-controlled report values", () => {
    const analysis = {
      id: "a1",
      repositoryId: 1,
      pullRequestId: 1,
      pullRequestNumber: 1,
      baseSha: "aaa",
      headSha: "bbb",
      status: "completed",
      report: {
        schemaVersion: "0.4",
        analysis: {
          id: "a1",
          baseRevision: "aaa",
          headRevision: "bbb",
          startedAt: "t",
          completedAt: "t",
          filesAnalyzed: 1,
          functionsCompared: 1,
        },
        summary: {
          impact: "high",
          findingCount: 1,
          highConfidenceCount: 1,
          byCategory: {},
          bySeverity: {},
        },
        findings: [
          {
            id: "1",
            category: "other",
            severity: "high",
            confidence: "high",
            title: "<script>alert(1)</script>",
            description: "x < y",
            location: { path: "src/<file>.ts", startLine: 1 },
          },
        ],
        metadata: { source: "core" },
      },
    } as AnalysisRecord;
    const html = renderReportPage({ owner: "acme", repo: "web", pullRequest: 3, analysis });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("src/&lt;file&gt;.ts");
  });

  it("renders a post-install page", () => {
    const html = renderSetupPage({ account: "Acme", repositories: [{ name: "api" }, { name: "web" }] });
    expect(html).toContain("Breakline is connected.");
    expect(html).toContain("Organization: Acme");
    expect(html).toContain("✓ api");
    expect(html).toContain("✓ web");
  });
});

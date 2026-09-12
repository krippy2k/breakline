import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";

const beforeSrc = `export function allowed(admin: boolean, active: boolean) {
  if (admin && active) return true;
  return false;
}
`;

const afterSrc = `export function allowed(admin: boolean, active: boolean) {
  if (admin || active) return true;
  return false;
}
`;

describe("analyze", () => {
  it("runs core analysis against git revisions", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "breakline-report-"));
    git(cwd, "init");
    git(cwd, "config", "user.email", "breakline@example.com");
    git(cwd, "config", "user.name", "Breakline");
    writeFileSync(join(cwd, "allowed.ts"), beforeSrc);
    git(cwd, "add", "allowed.ts");
    git(cwd, "commit", "-m", "base");
    const base = git(cwd, "rev-parse", "HEAD").trim();
    writeFileSync(join(cwd, "allowed.ts"), afterSrc);
    git(cwd, "add", "allowed.ts");
    git(cwd, "commit", "-m", "head");
    const head = git(cwd, "rev-parse", "HEAD").trim();

    const report = await analyze({
      repositoryPath: cwd,
      baseRevision: base,
      headRevision: head,
      analysisId: "local-1",
      config: { analysis: { impact: false } },
    });

    expect(report.analysis.id).toBe("local-1");
    expect(report.analysis.baseRevision).toBe(base);
    expect(report.analysis.headRevision).toBe(head);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.summary.impact).toBe("high");
    expect(report.findings.some((finding) => finding.symbol === "allowed")).toBe(true);
  });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" });
}

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareMany } from "@breakline/core";
import { gitShow, listChangedFiles } from "../src/git.js";
import { formatAnalyze } from "../src/reporter.js";

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

describe("git analyze integration", () => {
  it("loads both file versions and reports a predicate expansion", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "breakline-"));
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

    const files = await listChangedFiles(base, head, cwd);
    expect(files).toContain("allowed.ts");
    const beforeSource = await gitShow(base, "allowed.ts", cwd);
    const afterSource = await gitShow(head, "allowed.ts", cwd);
    expect(beforeSource).toContain("&&");
    expect(afterSource).toContain("||");

    const result = await compareMany([
      {
        beforeFile: "allowed.ts",
        afterFile: "allowed.ts",
        beforeSource: beforeSource!,
        afterSource: afterSource!,
      },
    ]);
    const output = formatAnalyze(result);
    expect(result.findings.some((finding) => finding.type === "predicate-expanded")).toBe(true);
    expect(output).toContain("1 high confidence");
    expect(output).toContain("Predicate expanded");
  });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" });
}

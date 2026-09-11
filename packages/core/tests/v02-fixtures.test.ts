import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareSources } from "../src/index.js";
import type { ChangeKind } from "../src/classify/types.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/v0.2");

interface Expected {
  changes: { kind: ChangeKind; symbol?: string }[];
  findings: { kind: ChangeKind; symbol?: string }[];
}

function cases(): { name: string; dir: string }[] {
  const result: { name: string; dir: string }[] = [];
  const walk = (dir: string, prefix: string): void => {
    if (!statSync(dir).isDirectory()) {
      return;
    }
    if (exists(join(dir, "expected.json"))) {
      result.push({ name: prefix || "root", dir });
      return;
    }
    for (const name of readdirSync(dir)) {
      walk(join(dir, name), prefix ? `${prefix}/${name}` : name);
    }
  };
  walk(fixturesRoot, "");
  return result;
}

function exists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

describe("v0.2 fixtures", () => {
  for (const fixture of cases()) {
    it(fixture.name, async () => {
      const beforeSource = readFileSync(join(fixture.dir, "before.ts"), "utf8");
      const afterSource = readFileSync(join(fixture.dir, "after.ts"), "utf8");
      const expected = JSON.parse(readFileSync(join(fixture.dir, "expected.json"), "utf8")) as Expected;
      const result = await compareSources({
        beforeFile: join(fixture.dir, "before.ts"),
        afterFile: join(fixture.dir, "after.ts"),
        beforeSource,
        afterSource,
      });

      const changeKinds = (result.changes ?? []).map((change) => ({
        kind: change.kind,
        symbol: change.symbol,
      }));
      const findingKinds = (result.report ?? []).map((finding) => ({
        kind: finding.kind,
        symbol: finding.symbol,
      }));

      expect(changeKinds).toEqual(expect.arrayContaining(expected.changes));
      expect(changeKinds).toHaveLength(expected.changes.length);
      expect(findingKinds).toEqual(expect.arrayContaining(expected.findings));
      expect(findingKinds).toHaveLength(expected.findings.length);

      for (const finding of result.report ?? []) {
        expect(finding.id).toMatch(/^bl_[0-9a-f]{16}$/);
        expect(["info", "warning"]).toContain(finding.severity);
        expect(finding.summary.length).toBeGreaterThan(0);
      }
    });
  }
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareSources } from "../src/index.js";
import { evaluateExpression } from "../src/witness/evaluate.js";
import type { BehaviorExpression, BehaviorFinding } from "../src/types.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

interface Expected {
  findings: { type: string; confidence?: string }[];
  witness?: Record<string, boolean | number | string | null>;
  witnessVariables?: string[];
  strict?: boolean;
}

function cases(): { name: string; dir: string }[] {
  const result: { name: string; dir: string }[] = [];
  for (const category of readdirSync(fixturesRoot)) {
    const categoryDir = join(fixturesRoot, category);
    if (!statSync(categoryDir).isDirectory() || category === "v0.2" || category === "impact") {
      continue;
    }
    for (const name of readdirSync(categoryDir)) {
      const dir = join(categoryDir, name);
      if (statSync(dir).isDirectory()) {
        result.push({ name: `${category}/${name}`, dir });
      }
    }
  }
  return result;
}

describe("fixtures", () => {
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

      if (expected.findings.length === 0 || expected.strict) {
        expect(result.findings.map((finding) => finding.type)).toEqual(
          expected.findings.map((finding) => finding.type),
        );
      } else {
        for (const wanted of expected.findings) {
          const match = result.findings.find(
            (finding) =>
              finding.type === wanted.type &&
              (wanted.confidence === undefined || finding.confidence === wanted.confidence),
          );
          expect(match, `missing ${wanted.type} in ${result.findings.map(formatFinding).join(", ")}`).toBeTruthy();
        }
      }

      const witnessed = result.findings.find((finding) => finding.witness);
      if (expected.witness) {
        expect(witnessed?.witness).toBeTruthy();
        for (const [key, value] of Object.entries(expected.witness)) {
          expect(witnessed!.witness!.bindings[key]).toBe(value);
        }
      }
      if (expected.witnessVariables) {
        expect(witnessed?.witness).toBeTruthy();
        expect(Object.keys(witnessed!.witness!.bindings).sort()).toEqual(
          [...expected.witnessVariables].sort(),
        );
        const beforeExpr = witnessed!.before?.expression;
        const afterExpr = witnessed!.after?.expression;
        if (beforeExpr && afterExpr) {
          expect(
            evaluateExpression(beforeExpr as BehaviorExpression, witnessed!.witness!.bindings),
          ).not.toBe(evaluateExpression(afterExpr as BehaviorExpression, witnessed!.witness!.bindings));
        }
      }
    });
  }
});

function formatFinding(finding: BehaviorFinding): string {
  return `${finding.type}/${finding.confidence}`;
}

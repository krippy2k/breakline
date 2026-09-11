import type { Finding } from "../findings/types.js";
import { normalizePath } from "../parser/parse.js";
import type { AnalysisResult } from "../types.js";

export function formatTextReport(result: AnalysisResult): string {
  const findings = result.report ?? [];
  if (findings.length === 0) {
    return ["BREAKLINE", "", "No behavioral changes found"].join("\n");
  }

  const files = groupByFile(findings, result.files ?? []);
  const blocks: string[] = [];

  for (const [file, fileFindings] of files) {
    const header = file ? `BREAKLINE  ${file}` : "BREAKLINE";
    const lines = [header, ""];
    const bySymbol = groupBySymbol(fileFindings);
    for (const [symbol, symbolFindings] of bySymbol) {
      lines.push(`${symbol}()`, "  BEHAVIOR CHANGED", "");
      for (const finding of symbolFindings) {
        lines.push(`  • ${finding.summary}`);
        if (finding.detail) {
          for (const line of finding.detail.split("\n")) {
            lines.push(`      ${line}`);
          }
        }
        if (finding.before) {
          lines.push(`      before: ${finding.before}`);
        }
        if (finding.after) {
          lines.push(`      after:  ${finding.after}`);
        }
        lines.push("");
      }
    }
    blocks.push(lines.join("\n").trimEnd());
  }

  return blocks.join("\n\n");
}

function groupByFile(findings: Finding[], analyzed: string[]): [string, Finding[]][] {
  const map = new Map<string, Finding[]>();
  for (const file of analyzed) {
    map.set(normalizePath(file), []);
  }
  for (const finding of findings) {
    const file = normalizePath(finding.location?.file ?? analyzed[0] ?? "");
    if (!map.has(file)) {
      map.set(file, []);
    }
    map.get(file)!.push(finding);
  }
  return [...map.entries()].filter(([, items]) => items.length > 0);
}

function groupBySymbol(findings: Finding[]): [string, Finding[]][] {
  const map = new Map<string, Finding[]>();
  for (const finding of findings) {
    const list = map.get(finding.symbol) ?? [];
    list.push(finding);
    map.set(finding.symbol, list);
  }
  return [...map.entries()];
}

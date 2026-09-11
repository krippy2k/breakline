import type { Finding } from "../findings/types.js";
import { normalizePath } from "../parser/parse.js";
import type { DependencyGraph } from "./graph.js";
import type { CodeSymbol } from "./types.js";

export function matchFindingToSymbol(finding: Finding, graph: DependencyGraph): CodeSymbol | undefined {
  const file = normalizePath(finding.location?.file ?? "");
  const name = finding.symbol;
  if (!name) {
    return undefined;
  }

  const exact = graph.symbols.findByQualifiedName(file, name);
  if (exact) {
    return exact;
  }

  const byFile = graph.symbols.findByFile(file).filter((symbol) => symbol.qualifiedName === name || symbol.name === name);
  if (byFile.length === 1) {
    return byFile[0];
  }

  for (const symbol of graph.symbols.all()) {
    if (symbol.qualifiedName !== name && symbol.name !== name) {
      continue;
    }
    if (filesMatch(file, symbol.file)) {
      return symbol;
    }
  }

  const named = graph.symbols.findByName(name.split(".").at(-1) ?? name).filter((symbol) => {
    const last = name.split(".").at(-1);
    return symbol.name === last || symbol.qualifiedName === name;
  });
  if (named.length === 1) {
    return named[0];
  }
  return undefined;
}

function filesMatch(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

export function groupFindings(findings: Finding[]): { symbol: string; file: string; findings: Finding[] }[] {
  const map = new Map<string, { symbol: string; file: string; findings: Finding[] }>();
  for (const finding of findings) {
    const file = normalizePath(finding.location?.file ?? "");
    const key = `${file}::${finding.symbol}`;
    const group = map.get(key) ?? { symbol: finding.symbol, file, findings: [] };
    group.findings.push(finding);
    map.set(key, group);
  }
  return [...map.values()];
}

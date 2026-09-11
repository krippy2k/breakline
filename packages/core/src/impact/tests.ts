import { posix } from "node:path";
import type { DependencyGraph } from "./graph.js";
import { isTestFile } from "./extractor.js";
import type { CodeSymbol, TestImpact } from "./types.js";
import { idKey } from "./types.js";

export function linkTests(
  changed: CodeSymbol,
  dependents: CodeSymbol[],
  graph: DependencyGraph,
): TestImpact[] {
  const tests: TestImpact[] = [];
  const seen = new Set<string>();

  const consider = (symbol: CodeSymbol, confidence: number, distance: number, testName?: string): void => {
    const key = idKey(symbol.id);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    tests.push({
      symbol,
      distance,
      confidence,
      testName: testName ?? symbol.name,
    });
  };

  for (const symbol of graph.symbols.all()) {
    if (!symbol.isTest && symbol.kind !== "test" && !isTestFile(symbol.file)) {
      continue;
    }

    const outgoing = graph.getOutgoing(symbol.id);
    const callsChanged = outgoing.some((edge) => idKey(edge.to) === idKey(changed.id));
    if (callsChanged) {
      consider(symbol, 0.95, 1, symbol.kind === "test" ? symbol.name : undefined);
      continue;
    }

    const callsDependent = outgoing.some((edge) => dependents.some((dep) => idKey(dep.id) === idKey(edge.to)));
    if (callsDependent) {
      consider(symbol, 0.85, 2);
      continue;
    }

    if (filenameCorresponds(symbol.file, changed.file)) {
      consider(fileTestSymbol(graph, symbol.file) ?? symbol, 0.7, 2);
      continue;
    }

    if (symbol.kind === "test" && symbol.name.toLowerCase().includes(changed.name.toLowerCase())) {
      consider(symbol, 0.5, 3, symbol.name);
    }
  }

  return tests.sort((a, b) => b.confidence - a.confidence);
}

function filenameCorresponds(testFile: string, sourceFile: string): boolean {
  const testBase = posix
    .basename(testFile)
    .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/i, "")
    .toLowerCase();
  const sourceBase = posix.basename(sourceFile).replace(/\.(ts|tsx|js|jsx)$/i, "").toLowerCase();
  return Boolean(testBase) && testBase === sourceBase;
}

function fileTestSymbol(graph: DependencyGraph, file: string): CodeSymbol | undefined {
  return graph.symbols.findByFile(file).find((symbol) => symbol.qualifiedName.endsWith("::__file"));
}

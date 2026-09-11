import type { CodeSymbol, EntryPointImpact, EntryPointKind, ImpactReference } from "./types.js";

export function classifyEntryPoints(impacted: ImpactReference[]): EntryPointImpact[] {
  const results: EntryPointImpact[] = [];
  const seen = new Set<string>();

  const add = (item: ImpactReference, kind: EntryPointKind): void => {
    const key = `${item.symbol.file}::${item.symbol.qualifiedName}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push({
      ...item,
      entryPointKind: kind,
      confidence: Math.min(item.confidence, kind === "public-api" ? 0.85 : item.confidence),
    });
  };

  for (const item of impacted) {
    const kind = frameworkKind(item.symbol);
    if (kind) {
      add(item, kind);
    }
  }

  if (results.length === 0) {
    for (const item of impacted) {
      if (item.symbol.isEntryPoint && (item.symbol.kind === "function" || item.symbol.kind === "method" || item.symbol.kind === "class")) {
        add(item, item.symbol.exported ? "public-api" : "export");
      }
    }
  }

  return results;
}

function frameworkKind(symbol: CodeSymbol): EntryPointKind | undefined {
  if (symbol.kind === "route") {
    return "http-route";
  }
  if (symbol.kind === "event-handler") {
    return "event-handler";
  }
  if (symbol.kind === "cli-command") {
    return "cli-command";
  }
  return undefined;
}

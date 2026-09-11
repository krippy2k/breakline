import type { DependencyEdge, DependencyKind, ImpactReference, SymbolId } from "./types.js";
import { idKey } from "./types.js";
import type { DependencyGraph } from "./graph.js";

export interface TraversalOptions {
  maxDepth: number;
  kinds?: DependencyKind[];
}

export function findImpact(
  changed: SymbolId,
  graph: DependencyGraph,
  options: TraversalOptions,
): ImpactReference[] {
  const queue: { symbol: SymbolId; depth: number; path: SymbolId[]; confidence: number; relation?: DependencyKind }[] =
    [{ symbol: changed, depth: 0, path: [changed], confidence: 1 }];
  const visited = new Map<string, number>();
  const results: ImpactReference[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= options.maxDepth) {
      continue;
    }

    for (const edge of incomingEdges(graph, current.symbol, options.kinds)) {
      const dependent = edge.from;
      const nextDepth = current.depth + 1;
      const key = idKey(dependent);
      const seen = visited.get(key);
      if (seen !== undefined && seen <= nextDepth) {
        continue;
      }
      visited.set(key, nextDepth);

      const path = [dependent, ...current.path];
      const confidence = Math.min(current.confidence, edge.confidence);
      const symbol = graph.getSymbol(dependent);
      if (symbol) {
        results.push({
          symbol,
          distance: nextDepth,
          path,
          relation: edge.kind,
          confidence,
        });
      }

      queue.push({
        symbol: dependent,
        depth: nextDepth,
        path,
        confidence,
        relation: edge.kind,
      });
    }
  }

  return results;
}

function incomingEdges(
  graph: DependencyGraph,
  symbol: SymbolId,
  kinds: DependencyKind[] | undefined,
): DependencyEdge[] {
  const edges = graph.getIncoming(symbol);
  if (!kinds || kinds.length === 0) {
    return edges;
  }
  const allowed = new Set(kinds);
  return edges.filter((edge) => allowed.has(edge.kind));
}

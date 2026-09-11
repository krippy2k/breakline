import { idKey, type CodeSymbol, type DependencyEdge, type SymbolId } from "./types.js";
import { SymbolIndex } from "./symbol-index.js";

export class DependencyGraph {
  readonly symbols = new SymbolIndex();
  private readonly outgoing = new Map<string, DependencyEdge[]>();
  private readonly incoming = new Map<string, DependencyEdge[]>();
  private edgeCount = 0;

  addSymbol(symbol: CodeSymbol): void {
    this.symbols.add(symbol);
  }

  addEdge(edge: DependencyEdge): void {
    const fromKey = idKey(edge.from);
    const toKey = idKey(edge.to);
    const out = this.outgoing.get(fromKey) ?? [];
    if (out.some((item) => idKey(item.to) === toKey && item.kind === edge.kind)) {
      return;
    }
    out.push(edge);
    this.outgoing.set(fromKey, out);

    const incoming = this.incoming.get(toKey) ?? [];
    incoming.push(edge);
    this.incoming.set(toKey, incoming);
    this.edgeCount += 1;
  }

  getOutgoing(symbol: SymbolId): DependencyEdge[] {
    return this.outgoing.get(idKey(symbol)) ?? [];
  }

  getIncoming(symbol: SymbolId): DependencyEdge[] {
    return this.incoming.get(idKey(symbol)) ?? [];
  }

  getDependencies(symbol: SymbolId): DependencyEdge[] {
    return this.getOutgoing(symbol);
  }

  getDependents(symbol: SymbolId): DependencyEdge[] {
    return this.getIncoming(symbol);
  }

  getSymbol(symbol: SymbolId): CodeSymbol | undefined {
    return this.symbols.get(symbol);
  }

  size(): { symbols: number; edges: number } {
    return { symbols: this.symbols.size(), edges: this.edgeCount };
  }
}

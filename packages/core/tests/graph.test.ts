import { describe, expect, it } from "vitest";
import { DependencyGraph } from "../src/impact/graph.js";
import { findImpact } from "../src/impact/traversal.js";
import type { CodeSymbol, SymbolId } from "../src/impact/types.js";

function symbol(file: string, name: string, kind: CodeSymbol["kind"] = "function"): CodeSymbol {
  return {
    id: { file, qualifiedName: name },
    name,
    qualifiedName: name,
    kind,
    file,
    startLine: 1,
    endLine: 1,
    exported: true,
  };
}

describe("dependency graph", () => {
  it("records reverse dependents for a call", () => {
    const graph = new DependencyGraph();
    const a = symbol("g.ts", "a");
    const b = symbol("g.ts", "b");
    const c = symbol("g.ts", "c");
    graph.addSymbol(a);
    graph.addSymbol(b);
    graph.addSymbol(c);
    graph.addEdge({ from: a.id, to: b.id, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: b.id, to: c.id, kind: "calls", confidence: 0.98 });

    expect(graph.getOutgoing(a.id).map((item) => item.to.qualifiedName)).toEqual(["b"]);
    expect(graph.getIncoming(c.id).map((item) => item.from.qualifiedName)).toEqual(["b"]);
  });
});

describe("impact traversal", () => {
  function chain(): { graph: DependencyGraph; ids: Record<string, SymbolId> } {
    const graph = new DependencyGraph();
    const ids: Record<string, SymbolId> = {};
    for (const name of ["a", "b", "c", "d"]) {
      const node = symbol("g.ts", name);
      graph.addSymbol(node);
      ids[name] = node.id;
    }
    graph.addEdge({ from: ids.a, to: ids.b, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: ids.b, to: ids.c, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: ids.c, to: ids.d, kind: "calls", confidence: 0.9 });
    return { graph, ids };
  }

  it("reports one-hop and multi-hop dependents", () => {
    const { graph, ids } = chain();
    const impact = findImpact(ids.c, graph, { maxDepth: 3 });
    expect(impact.filter((item) => item.distance === 1).map((item) => item.symbol.name)).toEqual(["b"]);
    expect(impact.filter((item) => item.distance === 2).map((item) => item.symbol.name)).toEqual(["a"]);
  });

  it("respects max depth", () => {
    const { graph, ids } = chain();
    const impact = findImpact(ids.d, graph, { maxDepth: 1 });
    expect(impact.map((item) => item.symbol.name)).toEqual(["c"]);
  });

  it("does not loop forever on cycles", () => {
    const graph = new DependencyGraph();
    const ping = symbol("g.ts", "ping");
    const pong = symbol("g.ts", "pong");
    const leaf = symbol("g.ts", "leaf");
    graph.addSymbol(ping);
    graph.addSymbol(pong);
    graph.addSymbol(leaf);
    graph.addEdge({ from: ping.id, to: pong.id, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: pong.id, to: ping.id, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: pong.id, to: leaf.id, kind: "calls", confidence: 0.98 });
    const impact = findImpact(leaf.id, graph, { maxDepth: 6 });
    const names = impact.map((item) => item.symbol.name);
    expect(names).toContain("pong");
    expect(names).toContain("ping");
    expect(names.filter((name) => name === "pong").length).toBe(1);
  });

  it("keeps a single shortest path through a diamond", () => {
    const graph = new DependencyGraph();
    const a = symbol("g.ts", "A");
    const b = symbol("g.ts", "B");
    const c = symbol("g.ts", "C");
    const d = symbol("g.ts", "D");
    for (const node of [a, b, c, d]) {
      graph.addSymbol(node);
    }
    graph.addEdge({ from: a.id, to: b.id, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: a.id, to: c.id, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: b.id, to: d.id, kind: "calls", confidence: 0.98 });
    graph.addEdge({ from: c.id, to: d.id, kind: "calls", confidence: 0.98 });
    const impact = findImpact(d.id, graph, { maxDepth: 3 });
    expect(impact.filter((item) => item.symbol.name === "A")).toHaveLength(1);
    expect(impact.find((item) => item.symbol.name === "A")?.distance).toBe(2);
  });

  it("propagates path confidence as the minimum edge confidence", () => {
    const { graph, ids } = chain();
    const impact = findImpact(ids.d, graph, { maxDepth: 3 });
    const a = impact.find((item) => item.symbol.name === "a");
    expect(a?.confidence).toBe(0.9);
  });
});

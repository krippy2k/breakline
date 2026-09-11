import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeImpact } from "../src/impact/analyzer.js";
import { buildImpactGraph } from "../src/impact/builder.js";
import { loadProjectSources } from "../src/impact/discover.js";
import { compareSources, formatAnalysisText, formatJsonReport } from "../src/index.js";
import type { ProjectFile } from "../src/impact/discover.js";

function sources(files: Record<string, string>): ProjectFile[] {
  return Object.entries(files).map(([file, source]) => ({ file, source }));
}

describe("graph construction from TypeScript", () => {
  it("resolves same-file calls", () => {
    const { graph } = buildImpactGraph(
      sources({
        "g.ts": `
          function c() {}
          function b() { c(); }
          function a() { b(); }
        `,
      }),
    );
    const incoming = graph.getIncoming({ file: "g.ts", qualifiedName: "c" });
    expect(incoming.map((edge) => edge.from.qualifiedName)).toEqual(["b"]);
    expect(incoming[0]?.confidence).toBe(0.98);
  });

  it("resolves imported function calls", () => {
    const { graph } = buildImpactGraph(
      sources({
        "b.ts": `export function b() { return 1; }`,
        "a.ts": `
          import { b } from "./b";
          export function a() { b(); }
        `,
      }),
    );
    const incoming = graph.getIncoming({ file: "b.ts", qualifiedName: "b" });
    expect(incoming.map((edge) => edge.from.qualifiedName)).toEqual(["a"]);
    expect(incoming[0]?.confidence).toBe(0.95);
  });

  it("keeps same names in different files distinct", () => {
    const { graph } = buildImpactGraph(
      sources({
        "one.ts": `export function run() {}`,
        "two.ts": `export function run() {}`,
      }),
    );
    expect(graph.getSymbol({ file: "one.ts", qualifiedName: "run" })?.file).toBe("one.ts");
    expect(graph.getSymbol({ file: "two.ts", qualifiedName: "run" })?.file).toBe("two.ts");
  });

  it("resolves class method calls via this and instances", () => {
    const { graph } = buildImpactGraph(
      sources({
        "svc.ts": `
          export class OrderService {
            cancelOrder() {}
            run() { this.cancelOrder(); }
          }
          const service = new OrderService();
          export function handle() { service.cancelOrder(); }
        `,
      }),
    );
    const incoming = graph.getIncoming({ file: "svc.ts", qualifiedName: "OrderService.cancelOrder" });
    expect(incoming.map((edge) => edge.from.qualifiedName).sort()).toEqual(["OrderService.run", "handle"]);
  });

  it("records class inheritance", () => {
    const { graph } = buildImpactGraph(
      sources({
        "base.ts": `export class Base {}`,
        "child.ts": `
          import { Base } from "./base";
          export class Child extends Base {}
        `,
      }),
    );
    const incoming = graph.getIncoming({ file: "base.ts", qualifiedName: "Base" });
    expect(incoming.some((edge) => edge.kind === "extends" && edge.from.qualifiedName === "Child")).toBe(true);
    expect(incoming[0]?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("detects express-style routes", () => {
    const { graph } = buildImpactGraph(
      sources({
        "ctrl.ts": `
          export function checkout() {}
          export function mount(app: { post: Function }) {
            app.post("/checkout", checkout);
          }
        `,
      }),
    );
    const route = graph.getSymbol({ file: "ctrl.ts", qualifiedName: "POST /checkout" });
    expect(route?.kind).toBe("route");
    expect(route?.isEntryPoint).toBe(true);
    const incoming = graph.getIncoming({ file: "ctrl.ts", qualifiedName: "checkout" });
    expect(incoming.some((edge) => edge.from.qualifiedName === "POST /checkout")).toBe(true);
  });
});

describe("v0.3 demo fixture", () => {
  const demoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/impact/demo");

  it("reports dependents, route entry point, related test, and paths for calculatePrice", async () => {
    const files = await loadProjectSources(demoRoot);
    const after = readFileSync(join(demoRoot, "src/pricing.ts"), "utf8");
    const before = after.replace("order.subtotal - order.discount", "order.subtotal");
    const compared = await compareSources({
      beforeFile: "src/pricing.ts",
      afterFile: "src/pricing.ts",
      beforeSource: before,
      afterSource: after,
    });
    const impact = analyzeImpact(compared.report ?? [], buildImpactGraph(files).graph, 0, { maxDepth: 3 });
    compared.impact = impact;

    expect(impact.changes).toHaveLength(1);
    const change = impact.changes[0];
    expect(change.changedSymbol.qualifiedName).toBe("calculatePrice");
    expect(change.directDependents.map((item) => item.symbol.qualifiedName)).toContain("createOrder");
    expect(change.indirectDependents.map((item) => item.symbol.qualifiedName)).toContain("checkout");
    expect(change.entryPoints.map((item) => item.symbol.qualifiedName)).toContain("POST /checkout");
    expect(change.relatedTests.some((item) => item.symbol.file.includes("pricing.test"))).toBe(true);
    expect(change.level).toBe("high");

    const path = change.entryPoints.find((item) => item.symbol.qualifiedName === "POST /checkout")?.path?.map(
      (id) => id.qualifiedName,
    );
    expect(path?.[0]).toBe("POST /checkout");
    expect(path).toContain("checkout");
    expect(path).toContain("createOrder");
    expect(path?.at(-1)).toBe("calculatePrice");

    const text = formatAnalysisText(compared, { showImpactPaths: true });
    expect(text).toContain("HIGH IMPACT");
    expect(text).toContain("createOrder()");
    expect(text).toContain("POST /checkout");
    expect(text).toContain("Related tests:");
    expect(text).toContain("Impact summary");

    const json = JSON.parse(formatJsonReport(compared));
    expect(json.schemaVersion).toBe("0.3");
    expect(json.impact.changes[0].impact.directDependents[0].qualifiedName).toBe("createOrder");
  });
});

describe("basic A depends on B", () => {
  it("reports A as a direct dependent when B changes", async () => {
    const files = sources({
      "b.ts": "export function b() { return 2; }",
      "a.ts": `import { b } from "./b"; export function a() { b(); }`,
    });
    const compared = await compareSources({
      beforeFile: "b.ts",
      afterFile: "b.ts",
      beforeSource: "export function b() { return 1; }",
      afterSource: "export function b() { return 2; }",
    });
    const { graph } = buildImpactGraph(files);
    const impact = analyzeImpact(compared.report ?? [], graph, 0);
    expect(impact.changes[0]?.directDependents.map((item) => item.symbol.qualifiedName)).toEqual(["a"]);
  });
});

describe("test linking", () => {
  it("links *.spec.ts files that import the changed symbol", async () => {
    const files = sources({
      "src/math.ts": "export function add(n: number) { return n + 2; }",
      "src/math.spec.ts": `import { add } from "./math"; it("adds", () => { add(1); });`,
    });
    const compared = await compareSources({
      beforeFile: "src/math.ts",
      afterFile: "src/math.ts",
      beforeSource: "export function add(n: number) { return n + 1; }",
      afterSource: "export function add(n: number) { return n + 2; }",
    });
    const impact = analyzeImpact(compared.report ?? [], buildImpactGraph(files).graph, 0);
    expect(impact.changes[0]?.relatedTests.some((item) => item.symbol.file.endsWith("math.spec.ts"))).toBe(true);
  });

  it("emits a potential test gap for high-impact changes with no tests", async () => {
    const files = sources({
      "price.ts": "export function price() { return 2; }",
      "ctrl.ts": `
        import { price } from "./price";
        export function checkout() { return price(); }
        export function mount(app: { post: Function }) { app.post("/pay", checkout); }
      `,
    });
    const compared = await compareSources({
      beforeFile: "price.ts",
      afterFile: "price.ts",
      beforeSource: "export function price() { return 1; }",
      afterSource: "export function price() { return 2; }",
    });
    const impact = analyzeImpact(compared.report ?? [], buildImpactGraph(files).graph, 0);
    expect(impact.changes[0]?.level).toBe("high");
    expect(impact.changes[0]?.testGaps[0]).toMatch(/No related test detected/);
  });
});


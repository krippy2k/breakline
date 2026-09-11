import { extractFile, resolveModulePath, type ExtractedRef, type ImportBinding } from "./extractor.js";
import { DependencyGraph } from "./graph.js";
import type { CodeSymbol, DependencyEdge } from "./types.js";

export interface BuildGraphResult {
  graph: DependencyGraph;
  unresolved: number;
}

export function buildImpactGraph(
  files: { file: string; source: string }[],
): BuildGraphResult {
  const graph = new DependencyGraph();
  const extractions = files.map((item) => ({
    file: item.file,
    extracted: extractFile(item.file, item.source),
  }));

  for (const item of extractions) {
    for (const symbol of item.extracted.symbols) {
      graph.addSymbol(symbol);
    }
  }

  const fileSet = new Set(files.map((item) => item.file));
  let unresolved = 0;

  for (const item of extractions) {
    for (const ref of item.extracted.refs) {
      const resolved = resolveRef(ref, item.extracted.imports, graph, fileSet);
      if (!resolved) {
        unresolved += 1;
        continue;
      }
      graph.addEdge(resolved);
    }
  }

  return { graph, unresolved };
}

function resolveRef(
  ref: ExtractedRef,
  imports: ImportBinding[],
  graph: DependencyGraph,
  fileSet: Set<string>,
): DependencyEdge | undefined {
  const location = { file: ref.from.file, line: ref.line, column: ref.column };

  if (ref.kind === "registers") {
    const target = graph.symbols.findByQualifiedName(ref.from.file, ref.name);
    if (!target) {
      return undefined;
    }
    return {
      from: ref.from,
      to: target.id,
      kind: "registers",
      confidence: 0.9,
      sourceLocation: location,
    };
  }

  if (ref.property && ref.instanceClass) {
    const method = findClassMethod(graph, ref.instanceClass, ref.property, ref.from.file);
    if (method) {
      return edge(ref, method, 0.9, location);
    }
  }

  if (ref.property && ref.import?.namespace) {
    const file = resolveModulePath(ref.from.file, ref.import.module, fileSet);
    if (file) {
      const symbol = graph.symbols.findByQualifiedName(file, ref.property) ?? uniqueByName(graph, ref.property, file);
      if (symbol) {
        return edge(ref, symbol, 0.95, location);
      }
    }
  }

  if (ref.property && !ref.import && !ref.instanceClass) {
    const localMethod = graph.symbols.findByQualifiedName(ref.from.file, `${ref.name}.${ref.property}`);
    if (localMethod) {
      return edge(ref, localMethod, 0.9, location);
    }
    const importedClass = imports.find((item) => item.local === ref.name);
    if (importedClass) {
      const file = resolveModulePath(ref.from.file, importedClass.module, fileSet);
      if (file) {
        const method =
          graph.symbols.findByQualifiedName(file, `${importedClass.imported}.${ref.property}`) ??
          graph.symbols.findByQualifiedName(file, ref.property);
        if (method) {
          return edge(ref, method, 0.9, location);
        }
      }
    }
  }

  if (ref.import && !ref.import.namespace) {
    const file = resolveModulePath(ref.from.file, ref.import.module, fileSet);
    const importedName = ref.import.imported === "default" ? ref.name : ref.import.imported;
    if (file) {
      const symbol =
        graph.symbols.findByQualifiedName(file, importedName) ?? uniqueByName(graph, importedName, file);
      if (symbol) {
        return edge(ref, symbol, ref.kind === "calls" ? 0.95 : 0.95, location);
      }
    }
  }

  const sameFile =
    graph.symbols.findByQualifiedName(ref.from.file, ref.property ? `${ref.name}.${ref.property}` : ref.name) ??
    uniqueByName(graph, ref.property ?? ref.name, ref.from.file);
  if (sameFile && sameFile.id.qualifiedName !== ref.from.qualifiedName) {
    return edge(ref, sameFile, 0.98, location);
  }

  const project = graph.symbols.findByName(ref.property ?? ref.name).filter(
    (symbol) => symbol.id.qualifiedName !== ref.from.qualifiedName && symbol.kind !== "unknown",
  );
  if (project.length === 1) {
    return edge(ref, project[0], 0.6, location);
  }

  return undefined;
}

function uniqueByName(graph: DependencyGraph, name: string, file: string): CodeSymbol | undefined {
  const matches = graph.symbols.findByFile(file).filter((symbol) => symbol.name === name && symbol.kind !== "unknown");
  return matches.length === 1 ? matches[0] : undefined;
}

function findClassMethod(
  graph: DependencyGraph,
  className: string,
  method: string,
  fromFile: string,
): CodeSymbol | undefined {
  return (
    graph.symbols.findByQualifiedName(fromFile, `${className}.${method}`) ??
    graph.symbols.findByName(method).find((symbol) => symbol.qualifiedName === `${className}.${method}`)
  );
}

function edge(
  ref: ExtractedRef,
  to: CodeSymbol,
  confidence: number,
  location: { file: string; line: number; column: number },
): DependencyEdge {
  return {
    from: ref.from,
    to: to.id,
    kind: ref.kind,
    confidence,
    sourceLocation: location,
  };
}

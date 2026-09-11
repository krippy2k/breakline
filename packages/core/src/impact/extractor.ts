import ts from "typescript";
import { posix } from "node:path";
import { getLocation, parseSource } from "../parser/parse.js";
import type { CodeSymbol, DependencyKind, SymbolId, SymbolKind } from "./types.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all", "head", "options"]);
const EVENT_METHODS = new Set(["on", "once", "addEventListener", "subscribe"]);

export interface ImportBinding {
  local: string;
  imported: string;
  module: string;
  namespace?: boolean;
}

export interface ExtractedRef {
  from: SymbolId;
  name: string;
  property?: string;
  kind: DependencyKind;
  line: number;
  column: number;
  import?: ImportBinding;
  instanceClass?: string;
}

export interface FileExtraction {
  symbols: CodeSymbol[];
  imports: ImportBinding[];
  refs: ExtractedRef[];
}

export function isTestFile(file: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file) || /(?:^|\/)(?:__tests__|tests?)\//.test(file);
}

export function extractFile(file: string, source: string): FileExtraction {
  const sourceFile = parseSource(file, source);
  const symbols: CodeSymbol[] = [];
  const imports: ImportBinding[] = [];
  const refs: ExtractedRef[] = [];
  const instances = new Map<string, string>();
  const testFile = isTestFile(file);

  const fileSymbol = makeSymbol({
    file,
    name: posix.basename(file),
    qualifiedName: `${posix.basename(file, posix.extname(file))}::__file`,
    kind: testFile ? "test" : "unknown",
    startLine: 1,
    endLine: sourceFile.getLineAndCharacterOfPosition(sourceFile.end).line + 1,
    exported: false,
    isTest: testFile,
  });
  symbols.push(fileSymbol);

  const visit = (node: ts.Node, enclosing: CodeSymbol, className?: string): void => {
    if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteral(node.moduleSpecifier)) {
      collectImports(node, node.moduleSpecifier.text, imports);
    }

    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const symbol = functionSymbol(sourceFile, node, node.name.text, "function", exported(node), testFile);
      symbols.push(symbol);
      ts.forEachChild(node.body, (child) => visit(child, symbol, className));
      return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.text;
      const classSymbol = makeSymbol({
        file: sourceFile.fileName,
        name,
        qualifiedName: name,
        kind: "class",
        startLine: loc(sourceFile, node).start.line,
        endLine: loc(sourceFile, node).end.line,
        exported: exported(node),
        isEntryPoint: exported(node),
      });
      symbols.push(classSymbol);
      collectHeritage(sourceFile, node, classSymbol.id, refs, imports);
      for (const member of node.members) {
        if ((ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && member.body) {
          const methodName = ts.isConstructorDeclaration(member)
            ? "constructor"
            : ts.isIdentifier(member.name)
              ? member.name.text
              : member.name.getText(sourceFile);
          const method = functionSymbol(
            sourceFile,
            member,
            methodName,
            "method",
            exported(node),
            testFile,
            name,
          );
          symbols.push(method);
          ts.forEachChild(member.body, (child) => visit(child, method, name));
        }
      }
      return;
    }

    if (ts.isInterfaceDeclaration(node) && node.name) {
      symbols.push(
        makeSymbol({
          file: sourceFile.fileName,
          name: node.name.text,
          qualifiedName: node.name.text,
          kind: "interface",
          startLine: loc(sourceFile, node).start.line,
          endLine: loc(sourceFile, node).end.line,
          exported: exported(node),
        }),
      );
    }

    if (ts.isVariableStatement(node)) {
      const isExported = exported(node);
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) {
          continue;
        }
        const varName = decl.name.text;
        if (ts.isNewExpression(decl.initializer) && ts.isIdentifier(decl.initializer.expression)) {
          instances.set(varName, decl.initializer.expression.text);
        }
        if (
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) &&
          decl.initializer.body
        ) {
          const symbol = functionSymbol(
            sourceFile,
            decl.initializer,
            varName,
            "function",
            isExported,
            testFile,
          );
          symbols.push(symbol);
          const body = decl.initializer.body;
          if (ts.isBlock(body)) {
            ts.forEachChild(body, (child) => visit(child, symbol, className));
          } else {
            visit(body, symbol, className);
          }
          continue;
        }
        visit(decl.initializer, enclosing, className);
      }
      return;
    }

    if (ts.isCallExpression(node)) {
      collectCall(sourceFile, node, enclosing, className, imports, instances, refs, symbols, testFile);
      const callee = node.expression;
      if (ts.isIdentifier(callee) && (callee.text === "it" || callee.text === "test" || callee.text === "describe")) {
        const title = node.arguments[0];
        const callback = node.arguments[1];
        if (title && ts.isStringLiteralLike(title) && callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          const testSymbol = symbols.find(
            (symbol) => symbol.kind === "test" && symbol.name === title.text && symbol.file === sourceFile.fileName,
          );
          if (testSymbol && callback.body) {
            if (ts.isBlock(callback.body)) {
              ts.forEachChild(callback.body, (child) => visit(child, testSymbol, className));
            } else {
              visit(callback.body, testSymbol, className);
            }
            return;
          }
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, enclosing, className));
  };

  ts.forEachChild(sourceFile, (child) => visit(child, fileSymbol));
  return { symbols, imports, refs };
}

function functionSymbol(
  sourceFile: ts.SourceFile,
  node: ts.FunctionLikeDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  name: string,
  kind: SymbolKind,
  isExported: boolean,
  isTest: boolean,
  container?: string,
): CodeSymbol {
  const location = loc(sourceFile, node);
  return makeSymbol({
    file: sourceFile.fileName,
    name,
    qualifiedName: container ? `${container}.${name}` : name,
    kind,
    startLine: location.start.line,
    endLine: location.end.line,
    exported: isExported,
    isEntryPoint: isExported && !isTest,
    isTest,
  });
}

function makeSymbol(input: Omit<CodeSymbol, "id">): CodeSymbol {
  return {
    ...input,
    id: { file: input.file, qualifiedName: input.qualifiedName },
  };
}

function loc(sourceFile: ts.SourceFile, node: ts.Node) {
  return getLocation(sourceFile, node);
}

function exported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
    return true;
  }
  return Boolean(node.parent && ts.isExportAssignment(node.parent));
}

function collectImports(node: ts.ImportDeclaration, module: string, imports: ImportBinding[]): void {
  const clause = node.importClause;
  if (!clause) {
    return;
  }
  if (clause.name) {
    imports.push({ local: clause.name.text, imported: "default", module });
  }
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    imports.push({
      local: clause.namedBindings.name.text,
      imported: "*",
      module,
      namespace: true,
    });
  }
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) {
      imports.push({
        local: element.name.text,
        imported: element.propertyName?.text ?? element.name.text,
        module,
      });
    }
  }
}

function collectHeritage(
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
  from: SymbolId,
  refs: ExtractedRef[],
  imports: ImportBinding[],
): void {
  for (const clause of node.heritageClauses ?? []) {
    const kind: DependencyKind = clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements";
    for (const type of clause.types) {
      const name = ts.isIdentifier(type.expression) ? type.expression.text : type.expression.getText(sourceFile);
      const location = loc(sourceFile, type);
      refs.push({
        from,
        name,
        kind,
        line: location.start.line,
        column: location.start.column,
        import: imports.find((item) => item.local === name),
      });
    }
  }
}

function collectCall(
  sourceFile: ts.SourceFile,
  node: ts.CallExpression,
  enclosing: CodeSymbol,
  className: string | undefined,
  imports: ImportBinding[],
  instances: Map<string, string>,
  refs: ExtractedRef[],
  symbols: CodeSymbol[],
  testFile: boolean,
): void {
  const location = loc(sourceFile, node);
  const expr = node.expression;

  if (ts.isIdentifier(expr)) {
    const name = expr.text;
    refs.push({
      from: enclosing.id,
      name,
      kind: testFile ? "references" : "calls",
      line: location.start.line,
      column: location.start.column,
      import: imports.find((item) => item.local === name),
    });
    if (testFile && (name === "it" || name === "test" || name === "describe")) {
      const title = node.arguments[0];
      if (title && ts.isStringLiteralLike(title)) {
        symbols.push(
          makeSymbol({
            file: sourceFile.fileName,
            name: title.text,
            qualifiedName: title.text,
            kind: "test",
            startLine: location.start.line,
            endLine: location.end.line,
            exported: false,
            isTest: true,
          }),
        );
      }
    }
    return;
  }

  if (!ts.isPropertyAccessExpression(expr)) {
    return;
  }

  const method = expr.name.text;
  const object = expr.expression;

  if (HTTP_METHODS.has(method.toLowerCase()) && node.arguments.length >= 2 && ts.isStringLiteralLike(node.arguments[0])) {
    const path = node.arguments[0].text;
    const http = method.toUpperCase();
    const routeName = `${http} ${path}`;
    const route = makeSymbol({
      file: sourceFile.fileName,
      name: routeName,
      qualifiedName: routeName,
      kind: "route",
      startLine: location.start.line,
      endLine: location.end.line,
      exported: false,
      isEntryPoint: true,
      metadata: { method: http, path },
    });
    symbols.push(route);
    const handler = node.arguments[node.arguments.length - 1];
    if (ts.isIdentifier(handler)) {
      refs.push({
        from: route.id,
        name: handler.text,
        kind: "calls",
        line: location.start.line,
        column: location.start.column,
        import: imports.find((item) => item.local === handler.text),
      });
    }
    refs.push({
      from: enclosing.id,
      name: routeName,
      kind: "registers",
      line: location.start.line,
      column: location.start.column,
    });
    return;
  }

  if (EVENT_METHODS.has(method) && node.arguments.length >= 2 && ts.isStringLiteralLike(node.arguments[0])) {
    const eventName = `event:${node.arguments[0].text}`;
    const event = makeSymbol({
      file: sourceFile.fileName,
      name: eventName,
      qualifiedName: eventName,
      kind: "event-handler",
      startLine: location.start.line,
      endLine: location.end.line,
      exported: false,
      isEntryPoint: true,
    });
    symbols.push(event);
    const handler = node.arguments[node.arguments.length - 1];
    if (ts.isIdentifier(handler)) {
      refs.push({
        from: event.id,
        name: handler.text,
        kind: "calls",
        line: location.start.line,
        column: location.start.column,
        import: imports.find((item) => item.local === handler.text),
      });
    }
  }

  if (method === "command" && node.arguments.length >= 1 && ts.isStringLiteralLike(node.arguments[0])) {
    const command = `cli:${node.arguments[0].text}`;
    symbols.push(
      makeSymbol({
        file: sourceFile.fileName,
        name: command,
        qualifiedName: command,
        kind: "cli-command",
        startLine: location.start.line,
        endLine: location.end.line,
        exported: false,
        isEntryPoint: true,
      }),
    );
  }

  if ((ts.isIdentifier(object) && object.text === "this" && className) || (object.kind === ts.SyntaxKind.ThisKeyword && className)) {
    refs.push({
      from: enclosing.id,
      name: className,
      property: method,
      kind: "calls",
      line: location.start.line,
      column: location.start.column,
    });
    return;
  }

  if (ts.isIdentifier(object)) {
    const ns = imports.find((item) => item.local === object.text);
    refs.push({
      from: enclosing.id,
      name: object.text,
      property: method,
      kind: "calls",
      line: location.start.line,
      column: location.start.column,
      import: ns,
      instanceClass: instances.get(object.text),
    });
  }
}

export function resolveModulePath(fromFile: string, spec: string, files: Set<string>): string | undefined {
  if (!spec.startsWith(".")) {
    return undefined;
  }
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ];
  return candidates.find((candidate) => files.has(candidate));
}

import ts from "typescript";
import type { SourceLocation } from "../types.js";

export function scriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (fileName.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (fileName.endsWith(".js")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

export function normalizePath(fileName: string): string {
  return fileName.replace(/\\/g, "/");
}

export function parseSource(fileName: string, sourceText: string): ts.SourceFile {
  return ts.createSourceFile(
    normalizePath(fileName),
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(fileName),
  );
}

export function getLocation(sourceFile: ts.SourceFile, node: ts.Node): SourceLocation {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    file: sourceFile.fileName,
    start: { line: start.line + 1, column: start.character + 1 },
    end: { line: end.line + 1, column: end.character + 1 },
  };
}

export function typeText(sourceFile: ts.SourceFile, node: ts.TypeNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  return collapseWs(node.getText(sourceFile));
}

export function collapseWs(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

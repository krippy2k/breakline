import ts from "typescript";
import type {
  BehaviorParameter,
  InspectedFunction,
  SourceLocation,
  SymbolIdentity,
} from "../types.js";
import { getLocation, parseSource, typeText } from "./parse.js";

export interface ExtractedFunction {
  identity: SymbolIdentity;
  parameters: BehaviorParameter[];
  location: SourceLocation;
  node: ts.FunctionLikeDeclaration;
  sourceFile: ts.SourceFile;
}

export function inspectSource(fileName: string, sourceText: string): InspectedFunction[] {
  return extractFunctions(fileName, sourceText).map((fn) => ({
    identity: fn.identity,
    parameters: fn.parameters,
    location: fn.location,
  }));
}

export function extractFunctions(fileName: string, sourceText: string): ExtractedFunction[] {
  const sourceFile = parseSource(fileName, sourceText);
  const results: ExtractedFunction[] = [];

  const visit = (node: ts.Node, container?: string): void => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      results.push(toExtracted(sourceFile, node, node.name.text, "function", container));
      ts.forEachChild(node.body, (child) => visit(child, node.name?.text ?? container));
      return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      for (const member of node.members) {
        if (
          (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) &&
          member.body
        ) {
          const name = ts.isConstructorDeclaration(member)
            ? "constructor"
            : ts.isIdentifier(member.name)
              ? member.name.text
              : member.name.getText(sourceFile);
          results.push(toExtracted(sourceFile, member, name, "method", className));
          ts.forEachChild(member.body, (child) => visit(child, className));
        }
      }
      return;
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) {
          continue;
        }
        const name = decl.name.text;
        if (ts.isArrowFunction(decl.initializer) && decl.initializer.body) {
          results.push(
            toExtracted(sourceFile, decl.initializer, name, "arrow-function", container),
          );
        } else if (ts.isFunctionExpression(decl.initializer) && decl.initializer.body) {
          results.push(toExtracted(sourceFile, decl.initializer, name, "function", container));
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, container));
  };

  visit(sourceFile);
  return results;
}

function toExtracted(
  sourceFile: ts.SourceFile,
  node: ts.FunctionLikeDeclaration,
  name: string,
  kind: SymbolIdentity["kind"],
  container?: string,
): ExtractedFunction {
  const identity: SymbolIdentity = {
    file: sourceFile.fileName,
    container,
    name,
    kind,
  };
  return {
    identity,
    parameters: parametersOf(sourceFile, node),
    location: getLocation(sourceFile, node),
    node,
    sourceFile,
  };
}

function parametersOf(sourceFile: ts.SourceFile, node: ts.FunctionLikeDeclaration): BehaviorParameter[] {
  return node.parameters.map((param) => ({
    name: param.name.getText(sourceFile),
    type: typeText(sourceFile, param.type),
  }));
}

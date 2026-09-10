import ts from "typescript";
import type { BehaviorExpression, BehaviorValue } from "../types.js";

const COMPARISON_OPS = new Set(["==", "===", "!=", "!==", ">", ">=", "<", "<="]);

export function normalizeExpression(
  sourceFile: ts.SourceFile,
  node: ts.Expression,
): BehaviorExpression {
  return normalizeNotComparisons(canonicalizeComparisons(fromNode(sourceFile, node)));
}

function fromNode(sourceFile: ts.SourceFile, node: ts.Expression): BehaviorExpression {
  node = unwrap(node);

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    return { kind: "not", expression: fromNode(sourceFile, node.operand) };
  }

  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.getText(sourceFile);
    if (op === "&&" || op === "||") {
      return {
        kind: "logical",
        operator: op === "&&" ? "and" : "or",
        left: fromNode(sourceFile, node.left),
        right: fromNode(sourceFile, node.right),
      };
    }
    if (COMPARISON_OPS.has(op)) {
      return {
        kind: "comparison",
        operator: op as Extract<BehaviorExpression, { kind: "comparison" }>["operator"],
        left: valueFrom(sourceFile, node.left),
        right: valueFrom(sourceFile, node.right),
      };
    }
  }

  return { kind: "boolean", value: valueFrom(sourceFile, node) };
}

function valueFrom(sourceFile: ts.SourceFile, node: ts.Expression): BehaviorValue {
  node = unwrap(node);

  if (ts.isIdentifier(node)) {
    return { kind: "identifier", name: node.text };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: "literal", value: true };
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "literal", value: false };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null };
  }
  if (ts.isNumericLiteral(node)) {
    return { kind: "literal", value: Number(node.text) };
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { kind: "literal", value: node.text };
  }
  if (ts.isPropertyAccessExpression(node)) {
    return {
      kind: "property",
      object: valueFrom(sourceFile, node.expression),
      name: node.name.text,
    };
  }
  return { kind: "unknown", text: node.getText(sourceFile) };
}

function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    node = node.expression;
  }
  if (ts.isAwaitExpression(node)) {
    return unwrap(node.expression);
  }
  return node;
}

const FLIP: Record<string, ComparisonExpressionOperator | undefined> = {
  "<": ">",
  ">": "<",
  "<=": ">=",
  ">=": "<=",
  "==": "==",
  "===": "===",
  "!=": "!=",
  "!==": "!==",
};

type ComparisonExpressionOperator = Extract<BehaviorExpression, { kind: "comparison" }>["operator"];

function canonicalizeComparisons(expr: BehaviorExpression): BehaviorExpression {
  switch (expr.kind) {
    case "logical":
      return {
        ...expr,
        left: canonicalizeComparisons(expr.left),
        right: canonicalizeComparisons(expr.right),
      };
    case "not":
      return { kind: "not", expression: canonicalizeComparisons(expr.expression) };
    case "comparison":
      if (expr.left.kind === "literal" && expr.left.value !== null && expr.right.kind !== "literal") {
        const flipped = FLIP[expr.operator];
        if (flipped) {
          return { kind: "comparison", operator: flipped, left: expr.right, right: expr.left };
        }
      }
      return expr;
    default:
      return expr;
  }
}

const NEGATED_COMPARISON: Record<string, ComparisonExpressionOperator | undefined> = {
  "<": ">=",
  "<=": ">",
  ">": "<=",
  ">=": "<",
};

function normalizeNotComparisons(expr: BehaviorExpression): BehaviorExpression {
  if (expr.kind === "not" && expr.expression.kind === "comparison") {
    const flipped = NEGATED_COMPARISON[expr.expression.operator];
    if (flipped) {
      return {
        kind: "comparison",
        operator: flipped,
        left: expr.expression.left,
        right: expr.expression.right,
      };
    }
  }
  if (expr.kind === "logical") {
    return {
      ...expr,
      left: normalizeNotComparisons(expr.left),
      right: normalizeNotComparisons(expr.right),
    };
  }
  if (expr.kind === "not") {
    return { kind: "not", expression: normalizeNotComparisons(expr.expression) };
  }
  return expr;
}

export function negate(expr: BehaviorExpression): BehaviorExpression {
  return normalizeNotComparisons({ kind: "not", expression: expr });
}

export function valueKey(value: BehaviorValue): string {
  switch (value.kind) {
    case "identifier":
      return value.name;
    case "literal":
      return JSON.stringify(value.value);
    case "property":
      return `${valueKey(value.object)}.${value.name}`;
    case "unknown":
      return value.text ?? "?";
  }
}

export function calleeName(sourceFile: ts.SourceFile, expr: ts.Expression): string {
  expr = unwrap(expr);
  if (ts.isCallExpression(expr)) {
    return calleeName(sourceFile, expr.expression);
  }
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const object = calleeName(sourceFile, expr.expression);
    return object ? `${object}.${expr.name.text}` : expr.name.text;
  }
  return expr.getText(sourceFile);
}

export function asValue(sourceFile: ts.SourceFile, node: ts.Expression | undefined): BehaviorValue | undefined {
  if (!node) {
    return undefined;
  }
  return valueFrom(sourceFile, node);
}

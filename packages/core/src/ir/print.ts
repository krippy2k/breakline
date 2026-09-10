import type { BehaviorExpression, BehaviorValue } from "../types.js";

export function printValue(value: BehaviorValue | undefined): string {
  if (!value) {
    return "undefined";
  }
  switch (value.kind) {
    case "identifier":
      return value.name;
    case "literal":
      return JSON.stringify(value.value);
    case "property":
      return `${printValue(value.object)}.${value.name}`;
    case "unknown":
      return value.text ?? "?";
  }
}

export function printExpression(expr: BehaviorExpression): string {
  switch (expr.kind) {
    case "boolean":
      return printValue(expr.value);
    case "comparison":
      return `${printValue(expr.left)} ${expr.operator} ${printValue(expr.right)}`;
    case "logical": {
      const op = expr.operator === "and" ? "&&" : "||";
      return `${parenthesize(expr.left, expr.operator)} ${op} ${parenthesize(expr.right, expr.operator)}`;
    }
    case "not":
      return expr.expression.kind === "boolean" || expr.expression.kind === "comparison"
        ? `!${printExpression(expr.expression)}`
        : `!(${printExpression(expr.expression)})`;
    case "throws":
      return `${expr.callee}() throws`;
  }
}

function parenthesize(expr: BehaviorExpression, parent: "and" | "or"): string {
  if (expr.kind === "logical" && expr.operator !== parent) {
    return `(${printExpression(expr)})`;
  }
  return printExpression(expr);
}

export function printBindings(bindings: Record<string, boolean | number | string | null>): string {
  return Object.entries(bindings)
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
    .join("\n");
}

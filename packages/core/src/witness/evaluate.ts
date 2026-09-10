import { valueKey } from "../parser/normalize-expression.js";
import type { BehaviorExpression, BehaviorValue } from "../types.js";

export type BindingValue = boolean | number | string | null;
export type Env = Record<string, BindingValue>;

export function evaluateExpression(expr: BehaviorExpression, env: Env): boolean {
  switch (expr.kind) {
    case "boolean":
      return asBoolean(evalValue(expr.value, env));
    case "not":
      return !evaluateExpression(expr.expression, env);
    case "logical":
      return expr.operator === "and"
        ? evaluateExpression(expr.left, env) && evaluateExpression(expr.right, env)
        : evaluateExpression(expr.left, env) || evaluateExpression(expr.right, env);
    case "comparison":
      return compare(
        evalValue(expr.left, env),
        expr.operator,
        evalValue(expr.right, env),
      );
    case "throws":
      return asBoolean(env[`${expr.callee}() throws`] ?? env[expr.callee]);
  }
}

function evalValue(value: BehaviorValue, env: Env): BindingValue | undefined {
  switch (value.kind) {
    case "literal":
      return value.value;
    case "identifier":
      return env[value.name];
    case "property":
      return env[valueKey(value)];
    case "unknown":
      return undefined;
  }
}

function asBoolean(value: BindingValue | undefined): boolean {
  return Boolean(value);
}

function compare(
  left: BindingValue | undefined,
  operator: string,
  right: BindingValue | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }
  switch (operator) {
    case "==":
      return left == right;
    case "===":
      return left === right;
    case "!=":
      return left != right;
    case "!==":
      return left !== right;
    case ">":
      return toNumber(left) > toNumber(right);
    case ">=":
      return toNumber(left) >= toNumber(right);
    case "<":
      return toNumber(left) < toNumber(right);
    case "<=":
      return toNumber(left) <= toNumber(right);
    default:
      return false;
  }
}

function toNumber(value: BindingValue): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    return Number(value);
  }
  if (value === true) {
    return 1;
  }
  return 0;
}

export interface CollectedVar {
  name: string;
  sort: "boolean" | "number";
}

export function collectVariables(expr: BehaviorExpression): CollectedVar[] {
  const found = new Map<string, CollectedVar["sort"]>();

  const add = (name: string, sort: CollectedVar["sort"]): void => {
    const existing = found.get(name);
    if (existing === "number" || sort === "number") {
      found.set(name, existing === "boolean" && sort === "boolean" ? "boolean" : sort === "number" || existing === "number" ? "number" : "boolean");
    } else {
      found.set(name, sort);
    }
  };

  const walkValue = (value: BehaviorValue, sort: CollectedVar["sort"]): void => {
    if (value.kind === "identifier") {
      add(value.name, sort);
    } else if (value.kind === "property") {
      add(valueKey(value), sort);
    }
  };

  const walk = (node: BehaviorExpression, booleanContext: boolean): void => {
    switch (node.kind) {
      case "boolean":
        walkValue(node.value, "boolean");
        break;
      case "not":
        walk(node.expression, true);
        break;
      case "logical":
        walk(node.left, true);
        walk(node.right, true);
        break;
      case "comparison": {
        const leftNum = node.left.kind === "literal" && typeof node.left.value === "number";
        const rightNum = node.right.kind === "literal" && typeof node.right.value === "number";
        walkValue(node.left, leftNum || rightNum ? "number" : "boolean");
        walkValue(node.right, leftNum || rightNum ? "number" : "boolean");
        break;
      }
      case "throws":
        add(`${node.callee}() throws`, "boolean");
        break;
    }
    void booleanContext;
  };

  walk(expr, true);
  return [...found.entries()].map(([name, sort]) => ({ name, sort }));
}

export function collectConstants(expr: BehaviorExpression): number[] {
  const values = new Set<number>();
  const walkValue = (value: BehaviorValue): void => {
    if (value.kind === "literal" && typeof value.value === "number") {
      values.add(value.value);
    }
  };
  const walk = (node: BehaviorExpression): void => {
    switch (node.kind) {
      case "boolean":
        walkValue(node.value);
        break;
      case "not":
        walk(node.expression);
        break;
      case "logical":
        walk(node.left);
        walk(node.right);
        break;
      case "comparison":
        walkValue(node.left);
        walkValue(node.right);
        break;
      default:
        break;
    }
  };
  walk(expr);
  return [...values];
}

export function expressionsEqual(a: BehaviorExpression, b: BehaviorExpression): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function andAll(exprs: BehaviorExpression[]): BehaviorExpression {
  if (exprs.length === 0) {
    return { kind: "boolean", value: { kind: "literal", value: true } };
  }
  return exprs.reduce((left, right) => ({ kind: "logical", operator: "and", left, right }));
}

export function orAll(exprs: BehaviorExpression[]): BehaviorExpression {
  if (exprs.length === 0) {
    return { kind: "boolean", value: { kind: "literal", value: false } };
  }
  return exprs.reduce((left, right) => ({ kind: "logical", operator: "or", left, right }));
}

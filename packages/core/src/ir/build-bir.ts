import ts from "typescript";
import type {
  BehaviorEffect,
  BehaviorExpression,
  BehaviorFunction,
  BehaviorPath,
  CallEffect,
} from "../types.js";
import type { ExtractedFunction } from "../parser/extract-functions.js";
import {
  asValue,
  calleeName,
  negate,
  normalizeExpression,
} from "../parser/normalize-expression.js";

interface PathState {
  conditions: BehaviorExpression[];
  effects: BehaviorEffect[];
  terminated: boolean;
}

export function buildBehaviorFunction(extracted: ExtractedFunction): BehaviorFunction {
  const body = extracted.node.body;
  const paths = body
    ? finalizePaths(walkNode(extracted.sourceFile, body, emptyState()))
    : [emptyPath()];

  return {
    id: symbolId(extracted),
    name: extracted.identity.name,
    file: extracted.identity.file,
    identity: extracted.identity,
    parameters: extracted.parameters,
    signature: extracted.signature,
    paths,
    branchPredicates: body ? collectBranchPredicates(extracted.sourceFile, body) : [],
    location: extracted.location,
  };
}

function collectBranchPredicates(
  sourceFile: ts.SourceFile,
  body: ts.Node,
): BehaviorExpression[] {
  const predicates: BehaviorExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIfStatement(node)) {
      predicates.push(normalizeExpression(sourceFile, node.expression));
    } else if (ts.isWhileStatement(node) || ts.isDoStatement(node)) {
      predicates.push(normalizeExpression(sourceFile, node.expression));
    } else if (ts.isForStatement(node) && node.condition) {
      predicates.push(normalizeExpression(sourceFile, node.condition));
    } else if (ts.isConditionalExpression(node)) {
      predicates.push(normalizeExpression(sourceFile, node.condition));
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return predicates;
}

function symbolId(extracted: ExtractedFunction): string {
  const { file, container, name, kind } = extracted.identity;
  return `${file}::${container ?? ""}::${name}::${kind}`;
}

function emptyState(): PathState {
  return { conditions: [], effects: [], terminated: false };
}

function emptyPath(): BehaviorPath {
  return { conditions: [], effects: [] };
}

function finalizePaths(states: PathState[]): BehaviorPath[] {
  if (states.length === 0) {
    return [emptyPath()];
  }
  return states.map((state) => ({
    conditions: state.conditions,
    effects: state.effects,
  }));
}

function walkNode(sourceFile: ts.SourceFile, node: ts.Node, state: PathState): PathState[] {
  if (state.terminated) {
    return [state];
  }

  if (ts.isBlock(node) || ts.isSourceFile(node)) {
    return walkStatements(sourceFile, [...node.statements], state);
  }

  if (ts.isIfStatement(node)) {
    return walkIf(sourceFile, node, state);
  }

  if (ts.isReturnStatement(node)) {
    return [
      {
        ...state,
        effects: [...state.effects, { kind: "return", value: asValue(sourceFile, node.expression) }],
        terminated: true,
      },
    ];
  }

  if (ts.isThrowStatement(node)) {
    return [
      {
        ...state,
        effects: [...state.effects, { kind: "throw", value: asValue(sourceFile, node.expression) }],
        terminated: true,
      },
    ];
  }

  if (ts.isTryStatement(node)) {
    return walkTry(sourceFile, node, state);
  }

  if (ts.isExpressionStatement(node)) {
    const calls = collectCalls(sourceFile, node.expression);
    if (calls.length > 0) {
      return [{ ...state, effects: [...state.effects, ...calls] }];
    }
    return [state];
  }

  if (ts.isVariableStatement(node)) {
    const calls: CallEffect[] = [];
    for (const decl of node.declarationList.declarations) {
      if (decl.initializer) {
        calls.push(...collectCalls(sourceFile, decl.initializer));
      }
    }
    if (calls.length > 0) {
      return [{ ...state, effects: [...state.effects, ...calls] }];
    }
    return [state];
  }

  if (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  ) {
    return walkNode(sourceFile, node.statement, state);
  }

  return [state];
}

function walkStatements(
  sourceFile: ts.SourceFile,
  statements: readonly ts.Statement[],
  state: PathState,
): PathState[] {
  let current = [state];
  for (const statement of statements) {
    const next: PathState[] = [];
    for (const item of current) {
      next.push(...walkNode(sourceFile, statement, item));
    }
    current = next;
  }
  return current;
}

function walkIf(sourceFile: ts.SourceFile, node: ts.IfStatement, state: PathState): PathState[] {
  const condition = normalizeExpression(sourceFile, node.expression);
  const thenStates = walkNode(sourceFile, node.thenStatement, {
    ...state,
    conditions: [...state.conditions, condition],
  });
  const elseStates = node.elseStatement
    ? walkNode(sourceFile, node.elseStatement, {
        ...state,
        conditions: [...state.conditions, negate(condition)],
      })
    : [
        {
          ...state,
          conditions: [...state.conditions, negate(condition)],
        },
      ];
  return [...thenStates, ...elseStates];
}

function walkTry(sourceFile: ts.SourceFile, node: ts.TryStatement, state: PathState): PathState[] {
  const tryStates = walkNode(sourceFile, node.tryBlock, state);
  const results: PathState[] = [...tryStates];

  if (node.catchClause) {
    const firstCall = firstCallName(sourceFile, node.tryBlock);
    const failState: PathState = {
      conditions: [
        ...state.conditions,
        firstCall
          ? { kind: "throws", callee: firstCall }
          : { kind: "boolean", value: { kind: "identifier", name: "__try_throws" } },
      ],
      effects: [
        ...state.effects,
        ...(firstCall
          ? [{ kind: "call" as const, callee: firstCall, inTry: true, onCatch: true }]
          : []),
      ],
      terminated: false,
    };
    results.push(...walkNode(sourceFile, node.catchClause.block, failState));
  }

  if (node.finallyBlock) {
    const afterFinally: PathState[] = [];
    for (const result of results) {
      const walked = walkNode(sourceFile, node.finallyBlock, { ...result, terminated: false });
      afterFinally.push(
        ...walked.map((item) => ({
          ...item,
          terminated: result.terminated || item.terminated,
        })),
      );
    }
    return afterFinally;
  }

  return results;
}

function collectCalls(sourceFile: ts.SourceFile, expr: ts.Expression): CallEffect[] {
  const calls: CallEffect[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      calls.push({
        kind: "call",
        callee: calleeName(sourceFile, node.expression),
        args: node.arguments.map((arg) => asValue(sourceFile, arg) ?? { kind: "unknown" }),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(expr);
  return calls;
}

function firstCallName(sourceFile: ts.SourceFile, node: ts.Node): string | undefined {
  let found: string | undefined;
  const visit = (current: ts.Node): void => {
    if (found) {
      return;
    }
    if (ts.isCallExpression(current)) {
      found = calleeName(sourceFile, current.expression);
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

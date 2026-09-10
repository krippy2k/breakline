import type { BehaviorAnalyzer, BehaviorFinding, BehaviorFunction, CallEffect } from "../types.js";
import { comparePredicates, describeExpression, enablingPredicate, findingBase } from "./helpers.js";

export class ReachabilityAnalyzer implements BehaviorAnalyzer {
  analyze(): BehaviorFinding[] {
    return [];
  }

  async analyzeAsync(before: BehaviorFunction, after: BehaviorFunction): Promise<BehaviorFinding[]> {
    const findings: BehaviorFinding[] = [];
    const beforeCalls = callMap(before);
    const afterCalls = callMap(after);
    const names = new Set([...beforeCalls.keys(), ...afterCalls.keys()]);

    for (const name of names) {
      const prev = beforeCalls.get(name);
      const next = afterCalls.get(name);

      if (!prev && next) {
        findings.push({
          ...findingBase(after, "call-newly-reachable"),
          confidence: "high",
          after: { text: `${name}()` },
          evidence: [{ kind: "call", after: name, source: after.location }],
        });
        continue;
      }

      if (prev && !next) {
        findings.push({
          ...findingBase(after, "call-no-longer-reachable"),
          confidence: "high",
          before: { text: `${name}()` },
          evidence: [{ kind: "call", before: name, source: after.location }],
        });
        continue;
      }

      if (!prev || !next) {
        continue;
      }

      if (!prev.unconditional && next.unconditional) {
        const witness = prev.predicate
          ? (await comparePredicates(prev.predicate, next.predicate ?? trueExpr())).witness
          : undefined;
        findings.push({
          ...findingBase(after, "call-became-unconditional"),
          confidence: witness ? "high" : "medium",
          before: prev.predicate ? describeExpression(prev.predicate) : { text: `${name}() was conditional` },
          after: { text: `${name}() is reachable regardless of prior conditions` },
          witness,
          evidence: [{ kind: "call", before: prev, after: next, source: after.location }],
        });
        continue;
      }

      if (prev.unconditional && !next.unconditional && next.predicate && prev.predicate) {
        const result = await comparePredicates(prev.predicate, next.predicate);
        if (!result.equal && result.type === "predicate-restricted") {
          findings.push({
            ...findingBase(after, result.type),
            confidence: result.witness ? "high" : "medium",
            before: describeExpression(prev.predicate),
            after: describeExpression(next.predicate),
            witness: result.witness,
            evidence: [{ kind: "call", before: prev, after: next, source: after.location }],
          });
        }
      }
    }

    return findings;
  }
}

function trueExpr() {
  return { kind: "boolean" as const, value: { kind: "literal" as const, value: true } };
}

interface CallInfo {
  unconditional: boolean;
  predicate?: ReturnType<typeof enablingPredicate>;
}

function callMap(fn: BehaviorFunction): Map<string, CallInfo> {
  const names = new Set<string>();
  for (const path of fn.paths) {
    for (const effect of path.effects) {
      if (effect.kind === "call" && !effect.onCatch) {
        names.add(effect.callee);
      }
    }
  }

  const map = new Map<string, CallInfo>();
  for (const name of names) {
    const predicate = enablingPredicate(
      fn.paths,
      (effect) => effect.kind === "call" && effect.callee === name && !effect.onCatch,
    );
    const unconditional = fn.paths.some(
      (path) =>
        path.conditions.length === 0 &&
        path.effects.some((effect) => effect.kind === "call" && (effect as CallEffect).callee === name && !effect.onCatch),
    );
    map.set(name, { unconditional, predicate });
  }
  return map;
}

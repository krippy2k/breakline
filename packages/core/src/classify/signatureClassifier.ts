import type { BehaviorFunction, FunctionSignature } from "../types.js";
import { printSignature, symbolOf, toChangeLocation } from "./helpers.js";
import type { Change } from "./types.js";

export function classifySignature(before: BehaviorFunction, after: BehaviorFunction): Change[] {
  const reasons = signatureReasons(before.signature, after.signature);
  if (reasons.length === 0) {
    return [];
  }
  return [
    {
      kind: "signature_changed",
      symbol: symbolOf(after),
      location: toChangeLocation(after.location),
      before: {
        text: printSignature(before.name, before.signature),
        signature: before.signature,
      },
      after: {
        text: printSignature(after.name, after.signature),
        signature: after.signature,
        reasons,
      },
    },
  ];
}

export function signatureReasons(before: FunctionSignature, after: FunctionSignature): string[] {
  const reasons: string[] = [];

  if (before.async !== after.async) {
    reasons.push(after.async ? "Function is now async." : "Async modifier was removed.");
  }

  if (before.returnType && after.returnType && before.returnType !== after.returnType) {
    reasons.push(`Return type changed from ${before.returnType} to ${after.returnType}.`);
  }

  const beforeNames = before.parameters.map((param) => param.name);
  const afterNames = after.parameters.map((param) => param.name);
  const beforeSet = new Set(beforeNames);
  const afterSet = new Set(afterNames);

  for (const name of afterNames) {
    if (!beforeSet.has(name)) {
      const param = after.parameters.find((item) => item.name === name);
      reasons.push(
        param && !param.optional
          ? `Parameter "${name}" was added and is required.`
          : `Parameter "${name}" was added.`,
      );
    }
  }

  for (const name of beforeNames) {
    if (!afterSet.has(name)) {
      reasons.push(`Parameter "${name}" was removed.`);
    }
  }

  const shared = beforeNames.filter((name) => afterSet.has(name));
  if (shared.length >= 2) {
    const beforeOrder = beforeNames.filter((name) => afterSet.has(name));
    const afterOrder = afterNames.filter((name) => beforeSet.has(name));
    if (beforeOrder.some((name, index) => name !== afterOrder[index])) {
      reasons.push("Parameter order changed.");
    }
  }

  for (const name of shared) {
    const prev = before.parameters.find((item) => item.name === name);
    const next = after.parameters.find((item) => item.name === name);
    if (!prev || !next) {
      continue;
    }
    if (prev.optional !== next.optional) {
      reasons.push(
        next.optional ? `Parameter "${name}" is now optional.` : `Parameter "${name}" is now required.`,
      );
    }
    if ((prev.defaultValue ?? "") !== (next.defaultValue ?? "")) {
      if (!prev.defaultValue && next.defaultValue) {
        reasons.push(`Parameter "${name}" now has default value ${next.defaultValue}.`);
      } else if (prev.defaultValue && !next.defaultValue) {
        reasons.push(`Default value for parameter "${name}" was removed.`);
      } else {
        reasons.push(
          `Default value for parameter "${name}" changed from ${prev.defaultValue} to ${next.defaultValue}.`,
        );
      }
    }
  }

  return reasons;
}

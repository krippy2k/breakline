import type { Change } from "../classify/types.js";
import type { BehaviorFinding } from "../types.js";
import { findingId } from "./findingId.js";
import type { Finding, FindingSeverity } from "./types.js";

export function createFindings(changes: Change[], extras: BehaviorFinding[] = []): Finding[] {
  const findings = changes.map(toFinding);
  enrichWithWitnesses(findings, extras);
  return findings;
}

function toFinding(change: Change): Finding {
  const before = asText(change.before);
  const after = asText(change.after);
  const reasons = changeReasons(change.after);
  const summary = summaryFor(change.kind);
  const detail = reasons.length > 0 ? reasons.join(" ") : undefined;
  const symbol = change.symbol ?? "unknown";
  const file = change.location?.file ?? "";

  return {
    id: findingId({ kind: change.kind, symbol, file, before, after }),
    kind: change.kind,
    symbol,
    summary,
    detail,
    before,
    after,
    location: change.location,
    severity: severityFor(change.kind, detail),
  };
}

function enrichWithWitnesses(findings: Finding[], extras: BehaviorFinding[]): void {
  for (const extra of extras) {
    if (!extra.witness) {
      continue;
    }
    const match = findings.find(
      (finding) =>
        finding.kind === "condition_changed" &&
        finding.symbol === extra.symbol &&
        (finding.before === extra.before?.text || finding.after === extra.after?.text),
    );
    if (!match) {
      continue;
    }
    const justified =
      extra.type === "predicate-expanded" ||
      extra.type === "predicate-restricted" ||
      (extra.type === "boundary-changed" &&
        Object.values(extra.witness.bindings).some((value) => typeof value === "number"));
    if (!justified) {
      continue;
    }
    const bindings = Object.entries(extra.witness.bindings)
      .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
      .join(", ");
    match.detail = [match.detail, `Witness: ${bindings}`].filter(Boolean).join("\n");
    if (extra.type === "predicate-expanded" || extra.type === "predicate-restricted") {
      match.summary = extra.summary;
    }
  }
}

function summaryFor(kind: Change["kind"]): string {
  switch (kind) {
    case "function_added":
      return "Function added";
    case "function_removed":
      return "Function removed";
    case "signature_changed":
      return "Signature changed";
    case "return_changed":
      return "Return behavior changed";
    case "condition_changed":
      return "Condition changed";
    case "call_added":
      return "New call";
    case "call_removed":
      return "Call removed";
    case "call_arguments_changed":
      return "Call arguments changed";
    case "throw_added":
      return "Throw added";
    case "throw_removed":
      return "Throw removed";
  }
}

function severityFor(kind: Change["kind"], detail?: string): FindingSeverity {
  if (kind === "throw_added" || kind === "function_removed") {
    return "warning";
  }
  if (kind === "signature_changed" && detail?.includes("required")) {
    return "warning";
  }
  return "info";
}

function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return undefined;
}

function changeReasons(value: unknown): string[] {
  if (typeof value === "object" && value !== null && "reasons" in value && Array.isArray(value.reasons)) {
    return value.reasons.filter((item): item is string => typeof item === "string");
  }
  return [];
}

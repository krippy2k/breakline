import { BoundaryAnalyzer } from "../analysis/boundary.js";
import { ExceptionAnalyzer } from "../analysis/exception.js";
import { PredicateAnalyzer } from "../analysis/predicate.js";
import { ReachabilityAnalyzer } from "../analysis/reachability.js";
import { ReturnAnalyzer } from "../analysis/return.js";
import type { BehaviorFinding, BehaviorFunction } from "../types.js";

export async function compareFunctions(
  before: BehaviorFunction,
  after: BehaviorFunction,
): Promise<BehaviorFinding[]> {
  const predicate = new PredicateAnalyzer();
  const boundary = new BoundaryAnalyzer();
  const reachability = new ReachabilityAnalyzer();

  const findings = [
    ...(await predicate.analyzeAsync(before, after)),
    ...(await boundary.analyzeAsync(before, after)),
    ...new ReturnAnalyzer().analyze(before, after),
    ...new ExceptionAnalyzer().analyze(before, after),
    ...(await reachability.analyzeAsync(before, after)),
  ];

  return dedupe(findings);
}

function dedupe(findings: BehaviorFinding[]): BehaviorFinding[] {
  const seen = new Set<string>();
  const result: BehaviorFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.type}:${finding.symbol}:${finding.before?.text ?? ""}:${finding.after?.text ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(finding);
  }
  return result;
}

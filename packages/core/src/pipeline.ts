import { extractFunctions, inspectSource } from "./parser/extract-functions.js";
import { normalizePath } from "./parser/parse.js";
import { buildBehaviorFunction } from "./ir/build-bir.js";
import { compareFunctions } from "./compare/compare.js";
import { matchFunctionsDetailed } from "./compare/match-functions.js";
import { classifyChanges } from "./classify/classifyChanges.js";
import { createFindings } from "./findings/createFindings.js";
import type { AnalysisResult, InspectedFunction } from "./types.js";

export { inspectSource };

export async function compareSources(input: {
  beforeFile: string;
  afterFile: string;
  beforeSource: string;
  afterSource: string;
}): Promise<AnalysisResult> {
  const beforeFns = extractFunctions(input.beforeFile, input.beforeSource).map(buildBehaviorFunction);
  const afterFns = extractFunctions(input.afterFile, input.afterSource).map(buildBehaviorFunction);
  const matched = matchFunctionsDetailed(beforeFns, afterFns);
  const findings = [];
  for (const pair of matched.pairs) {
    findings.push(...(await compareFunctions(pair.before, pair.after)));
  }
  const changes = classifyChanges(matched);
  const report = createFindings(changes, findings);
  return {
    filesAnalyzed: 1,
    functionsCompared: matched.pairs.length + matched.added.length + matched.removed.length,
    findings,
    changes,
    report,
    files: [normalizePath(input.afterFile)],
  };
}

export async function compareMany(
  files: {
    beforeFile: string;
    afterFile: string;
    beforeSource: string;
    afterSource: string;
  }[],
): Promise<AnalysisResult> {
  let functionsCompared = 0;
  const findings = [];
  const changes = [];
  const report = [];
  for (const file of files) {
    const result = await compareSources(file);
    functionsCompared += result.functionsCompared;
    findings.push(...result.findings);
    changes.push(...(result.changes ?? []));
    report.push(...(result.report ?? []));
  }
  return {
    filesAnalyzed: files.length,
    functionsCompared,
    findings,
    changes,
    report,
    files: files.map((file) => normalizePath(file.afterFile)),
  };
}

export function inspectFile(fileName: string, sourceText: string): InspectedFunction[] {
  return inspectSource(fileName, sourceText);
}

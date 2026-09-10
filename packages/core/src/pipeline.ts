import { extractFunctions, inspectSource } from "./parser/extract-functions.js";
import { buildBehaviorFunction } from "./ir/build-bir.js";
import { compareFunctions } from "./compare/compare.js";
import { matchFunctions } from "./compare/match-functions.js";
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
  const pairs = matchFunctions(beforeFns, afterFns);
  const findings = [];
  for (const pair of pairs) {
    findings.push(...(await compareFunctions(pair.before, pair.after)));
  }
  return {
    filesAnalyzed: 1,
    functionsCompared: pairs.length,
    findings,
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
  for (const file of files) {
    const result = await compareSources(file);
    functionsCompared += result.functionsCompared;
    findings.push(...result.findings);
  }
  return {
    filesAnalyzed: files.length,
    functionsCompared,
    findings,
  };
}

export function inspectFile(fileName: string, sourceText: string): InspectedFunction[] {
  return inspectSource(fileName, sourceText);
}

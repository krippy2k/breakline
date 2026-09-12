import { attachImpact, compareMany, loadProjectSources, type AnalysisResult } from "@breakline/core";
import { loadConfig, mergeConfig } from "./config.js";
import { toBreaklineReport } from "./from-analysis.js";
import { gitShow, listChangedFiles } from "./git.js";
import type { AnalysisRequest, BreaklineReport } from "./types.js";

export async function analyze(request: AnalysisRequest): Promise<BreaklineReport> {
  const startedAt = new Date().toISOString();
  const disk = await loadConfig(request.repositoryPath);
  const config = mergeConfig({
    github: { ...disk.github, ...request.config?.github },
    analysis: { ...disk.analysis, ...request.config?.analysis },
    report: { ...disk.report, ...request.config?.report },
  });
  const allFiles = await listChangedFiles(request.baseRevision, request.headRevision, request.repositoryPath);
  const limited =
    allFiles.length > config.analysis.maxChangedFiles
      ? {
          changedFileCount: allFiles.length,
          analyzedFileCount: config.analysis.maxChangedFiles,
          reason: "Analysis was limited by the repository safety threshold.",
        }
      : undefined;
  const files = limited ? allFiles.slice(0, config.analysis.maxChangedFiles) : allFiles;
  const pairs = [];
  for (const file of files) {
    const beforeSource = await gitShow(request.baseRevision, file, request.repositoryPath);
    const afterSource = await gitShow(request.headRevision, file, request.repositoryPath);
    if (beforeSource === null && afterSource === null) {
      continue;
    }
    pairs.push({
      beforeFile: file,
      afterFile: file,
      beforeSource: beforeSource ?? "",
      afterSource: afterSource ?? "",
    });
  }

  let result: AnalysisResult =
    pairs.length > 0
      ? await compareMany(pairs)
      : { filesAnalyzed: 0, functionsCompared: 0, findings: [], changes: [], report: [], files: [] };
  result.filesAnalyzed = files.length;

  if (config.analysis.impact) {
    const sources = await loadProjectSources(request.repositoryPath);
    result = attachImpact(result, sources);
  }

  return toBreaklineReport(result, {
    analysisId: request.analysisId,
    baseRevision: request.baseRevision,
    headRevision: request.headRevision,
    startedAt,
    config,
    limited,
  });
}

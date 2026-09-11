#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { Command } from "commander";
import {
  attachImpact,
  compareMany,
  compareSources,
  formatAnalysisText,
  formatJsonReport,
  inspectFile,
  loadProjectSources,
  type AnalysisResult,
} from "@breakline/core";
import { gitShow, listChangedFiles, parseRange } from "./git.js";
import { invocationCwd, resolveUserPath } from "./paths.js";
import { formatInspect } from "./reporter.js";

const program = new Command();

program.name("breakline").description("Semantic behavioral change analysis for code").version("0.3.0");

program
  .command("inspect")
  .argument("<file>", "TypeScript or JavaScript file")
  .action(async (file: string) => {
    const path = resolveUserPath(file);
    const source = await readFile(path, "utf8");
    const functions = inspectFile(path, source);
    console.log(formatInspect(path, functions));
  });

program
  .command("compare")
  .argument("<before>", "Base version of a TypeScript or JavaScript file")
  .argument("<after>", "Head version of a TypeScript or JavaScript file")
  .option("--include-low-confidence", "Include low-confidence findings")
  .option("--format <format>", "text or json", "text")
  .option("--output <file>", "Write the report to a file")
  .option("--impact", "Attach project impact analysis using the current directory")
  .option("--impact-depth <n>", "Impact traversal depth", "3")
  .option("--show-impact-paths", "Print dependency paths for impacted symbols")
  .option("--verbose", "Print symbol and edge diagnostics")
  .action(
    async (
      before: string,
      after: string,
      options: {
        includeLowConfidence?: boolean;
        format?: string;
        output?: string;
        impact?: boolean;
        noImpact?: boolean;
        impactDepth?: string;
        showImpactPaths?: boolean;
        verbose?: boolean;
      },
    ) => {
      const beforePath = resolveUserPath(before);
      const afterPath = resolveUserPath(after);
      const [beforeSource, afterSource] = await Promise.all([
        readFile(beforePath, "utf8"),
        readFile(afterPath, "utf8"),
      ]);
      let result = await compareSources({
        beforeFile: beforePath,
        afterFile: afterPath,
        beforeSource,
        afterSource,
      });
      if (options.impact) {
        result = await withImpact(result, options);
      }
      await emit(result, options);
    },
  );

program
  .command("analyze")
  .argument("[range]", "Git range such as main..HEAD or two refs")
  .argument("[head]", "Optional head ref when using two positional refs")
  .option("--base <ref>", "Base git ref")
  .option("--head <ref>", "Head git ref")
  .option("--include-low-confidence", "Include low-confidence findings")
  .option("--format <format>", "text or json", "text")
  .option("--output <file>", "Write the report to a file")
  .option("--no-impact", "Skip impact analysis")
  .option("--impact-depth <n>", "Impact traversal depth", "3")
  .option("--show-impact-paths", "Print dependency paths for impacted symbols")
  .option("--verbose", "Print symbol and edge diagnostics")
  .action(
    async (
      range: string | undefined,
      headArg: string | undefined,
      options: {
        base?: string;
        head?: string;
        includeLowConfidence?: boolean;
        format?: string;
        output?: string;
        impact?: boolean;
        noImpact?: boolean;
        impactDepth?: string;
        showImpactPaths?: boolean;
        verbose?: boolean;
      },
    ) => {
      const cwd = invocationCwd();
      const { base, head } = parseRange(range, options.base, options.head, headArg ? [headArg] : []);
      const files = await listChangedFiles(base, head, cwd);
      const pairs = [];
      for (const file of files) {
        const beforeSource = await gitShow(base, file, cwd);
        const afterSource = await gitShow(head, file, cwd);
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
      if (options.impact !== false) {
        result = await withImpact(result, options, cwd);
      }
      await emit(result, options);
    },
  );

if (process.argv.length <= 2) {
  program.help();
}

program.parseAsync(process.argv);

async function withImpact(
  result: AnalysisResult,
  options: { impactDepth?: string },
  root = invocationCwd(),
): Promise<AnalysisResult> {
  const files = await loadProjectSources(root);
  const depth = Number.parseInt(options.impactDepth ?? "3", 10);
  return attachImpact(result, files, {
    maxDepth: Number.isFinite(depth) && depth > 0 ? depth : 3,
  });
}

async function emit(
  result: AnalysisResult,
  options: { format?: string; output?: string; showImpactPaths?: boolean; verbose?: boolean },
): Promise<void> {
  const format = options.format === "json" ? "json" : "text";
  const text =
    format === "json"
      ? formatJsonReport(result)
      : formatAnalysisText(result, {
          showImpactPaths: Boolean(options.showImpactPaths),
          verbose: Boolean(options.verbose),
        });
  console.log(text);
  if (options.output) {
    await writeFile(options.output, `${text}\n`, "utf8");
  }
}

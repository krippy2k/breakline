#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { compareMany, compareSources, inspectFile } from "@breakline/core";
import { gitShow, listChangedFiles, parseRange } from "./git.js";
import { invocationCwd, resolveUserPath } from "./paths.js";
import { formatAnalyze, formatCompare, formatInspect } from "./reporter.js";

const program = new Command();

program.name("breakline").description("Semantic behavioral change analysis for code").version("0.1.0");

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
  .action(async (before: string, after: string, options: { includeLowConfidence?: boolean }) => {
    const beforePath = resolveUserPath(before);
    const afterPath = resolveUserPath(after);
    const [beforeSource, afterSource] = await Promise.all([
      readFile(beforePath, "utf8"),
      readFile(afterPath, "utf8"),
    ]);
    const result = await compareSources({
      beforeFile: beforePath,
      afterFile: afterPath,
      beforeSource,
      afterSource,
    });
    console.log(formatCompare(result, Boolean(options.includeLowConfidence)));
  });

program
  .command("analyze")
  .argument("[range]", "Git range such as main..HEAD or two refs")
  .argument("[head]", "Optional head ref when using two positional refs")
  .option("--base <ref>", "Base git ref")
  .option("--head <ref>", "Head git ref")
  .option("--include-low-confidence", "Include low-confidence findings")
  .action(
    async (
      range: string | undefined,
      headArg: string | undefined,
      options: { base?: string; head?: string; includeLowConfidence?: boolean },
    ) => {
      const cwd = invocationCwd();
      const { base, head } = parseRange(range, options.base, options.head, headArg ? [headArg] : []);
      const files = await listChangedFiles(base, head, cwd);
      const pairs = [];
      for (const file of files) {
        const beforeSource = await gitShow(base, file, cwd);
        const afterSource = await gitShow(head, file, cwd);
        if (beforeSource === null || afterSource === null) {
          continue;
        }
        pairs.push({
          beforeFile: file,
          afterFile: file,
          beforeSource,
          afterSource,
        });
      }
      const result = pairs.length > 0 ? await compareMany(pairs) : { filesAnalyzed: 0, functionsCompared: 0, findings: [] };
      result.filesAnalyzed = files.length;
      console.log(formatAnalyze(result, Boolean(options.includeLowConfidence)));
    },
  );

if (process.argv.length <= 2) {
  program.help();
}

program.parseAsync(process.argv);

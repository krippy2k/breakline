import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DEFAULT_CONFIG, type BreaklineConfig, type ConfidenceThreshold, type DeepPartial } from "./types.js";

const CONFIG_FILES = ["breakline.yml", ".breakline.yml", "breakline.config.json", ".breakline.json"];

export function mergeConfig(overrides?: DeepPartial<BreaklineConfig>): BreaklineConfig {
  if (!overrides) {
    return structuredClone(DEFAULT_CONFIG);
  }
  return {
    version: 1,
    github: { ...DEFAULT_CONFIG.github, ...compact(overrides.github) },
    analysis: { ...DEFAULT_CONFIG.analysis, ...compact(overrides.analysis) },
    report: { ...DEFAULT_CONFIG.report, ...compact(overrides.report) },
  };
}

function compact<T extends Record<string, unknown> | undefined>(value: T): T {
  if (!value) {
    return value;
  }
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export async function loadConfig(repositoryPath: string): Promise<BreaklineConfig> {
  for (const name of CONFIG_FILES) {
    try {
      const raw = await readFile(join(repositoryPath, name), "utf8");
      const parsed = name.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
      return mergeConfig(normalizeLoaded(parsed));
    } catch (error) {
      if (isNotFound(error)) {
        continue;
      }
      throw error;
    }
  }
  return mergeConfig();
}

export function confidenceRank(value: ConfidenceThreshold): number {
  switch (value) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
  }
}

function normalizeLoaded(value: unknown): DeepPartial<BreaklineConfig> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const input = value as Record<string, unknown>;
  const github = asRecord(input.github);
  const analysis = asRecord(input.analysis);
  const report = asRecord(input.report);
  return {
    github: github
      ? {
          enabled: asBool(github.enabled),
          comment: asBool(github.comment),
          annotations: asBool(github.annotations),
          analyzeDrafts: asBool(github.analyzeDrafts),
        }
      : undefined,
    analysis: analysis
      ? {
          minConfidence: asConfidence(analysis.minConfidence),
          maxChangedFiles: asNumber(analysis.maxChangedFiles),
          maxCheckoutBytes: asNumber(analysis.maxCheckoutBytes),
          maxDurationMs: asNumber(analysis.maxDurationMs),
          impact: asBool(analysis.impact),
        }
      : undefined,
    report: report
      ? {
          maxGithubFindings: asNumber(report.maxGithubFindings),
          maxAnnotations: asNumber(report.maxAnnotations),
        }
      : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asConfidence(value: unknown): ConfidenceThreshold | undefined {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

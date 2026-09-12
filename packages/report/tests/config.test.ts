import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, mergeConfig } from "../src/config.js";
import { DEFAULT_CONFIG } from "../src/types.js";

describe("config", () => {
  it("returns defaults when no config file exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "breakline-config-"));
    await expect(loadConfig(dir)).resolves.toEqual(DEFAULT_CONFIG);
  });

  it("loads breakline.yml overrides", async () => {
    const dir = mkdtempSync(join(tmpdir(), "breakline-config-"));
    writeFileSync(
      join(dir, "breakline.yml"),
      [
        "version: 1",
        "github:",
        "  comment: true",
        "  annotations: false",
        "analysis:",
        "  minConfidence: high",
        "report:",
        "  maxGithubFindings: 3",
        "",
      ].join("\n"),
    );
    const config = await loadConfig(dir);
    expect(config.github.comment).toBe(true);
    expect(config.github.annotations).toBe(false);
    expect(config.analysis.minConfidence).toBe("high");
    expect(config.report.maxGithubFindings).toBe(3);
    expect(config.github.enabled).toBe(true);
  });

  it("merges partial overrides onto defaults", () => {
    const config = mergeConfig({ github: { comment: true } });
    expect(config.github.comment).toBe(true);
    expect(config.github.enabled).toBe(true);
  });
});

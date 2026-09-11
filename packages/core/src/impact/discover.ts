import { execFile } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { normalizePath } from "../parser/parse.js";

const execFileAsync = promisify(execFile);

const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".next",
  "vendor",
  "generated",
]);

export interface ProjectFile {
  file: string;
  source: string;
}

export async function discoverSourceFiles(root: string): Promise<string[]> {
  const fromGit = await gitTrackedFiles(root);
  if (fromGit) {
    return fromGit;
  }
  return walkFiles(root, root);
}

export async function loadProjectSources(root: string): Promise<ProjectFile[]> {
  const files = await discoverSourceFiles(root);
  const result: ProjectFile[] = [];
  for (const file of files) {
    try {
      result.push({
        file: normalizePath(file),
        source: readFileSync(join(root, file), "utf8"),
      });
    } catch {
      // skip unreadable files
    }
  }
  return result;
}

async function gitTrackedFiles(root: string): Promise<string[] | null> {
  try {
    const { stdout: top } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: root });
    if (relative(resolve(top.trim()), resolve(root)) !== "") {
      return null;
    }
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd: root },
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => normalizePath(line.trim()))
      .filter((file) => file && SOURCE_EXT.test(file) && !ignoredPath(file));
  } catch {
    return null;
  }
}

function walkFiles(dir: string, root: string): string[] {
  const results: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name) || (name.startsWith(".") && name !== ".breaklineignore")) {
      continue;
    }
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...walkFiles(full, root));
    } else if (SOURCE_EXT.test(name) && !ignoredPath(normalizePath(relative(root, full)))) {
      results.push(normalizePath(relative(root, full)));
    }
  }
  return results;
}

function ignoredPath(file: string): boolean {
  return /(^|\/)(node_modules|dist|build|coverage|\.git|\.next|vendor)(\/|$)/.test(file);
}

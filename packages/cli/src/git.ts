import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const IGNORED = /(^|[\\/])(node_modules|dist|coverage|\.git)([\\/]|$)/;

export function parseRange(
  range: string | undefined,
  baseOpt?: string,
  headOpt?: string,
  extra?: string[],
): { base: string; head: string } {
  if (baseOpt || headOpt) {
    return { base: baseOpt ?? "HEAD", head: headOpt ?? "HEAD" };
  }
  if (range?.includes("..")) {
    const [base, head] = range.split("..");
    return { base: base || "HEAD", head: head || "HEAD" };
  }
  if (range && extra?.[0]) {
    return { base: range, head: extra[0] };
  }
  if (range) {
    return { base: range, head: "HEAD" };
  }
  return { base: "HEAD~1", head: "HEAD" };
}

export async function listChangedFiles(base: string, head: string, cwd: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", `${base}...${head}`],
    { cwd },
  );
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((file) => file && SOURCE_EXT.test(file) && !IGNORED.test(file));
}

export async function gitShow(ref: string, file: string, cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["show", `${ref}:${file}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const IGNORED = /(^|[\\/])(node_modules|dist|coverage|\.git)([\\/]|$)/;

export async function listChangedFiles(base: string, head: string, cwd: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMRD", `${assertRef(base)}...${assertRef(head)}`],
    { cwd },
  );
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((file) => file && SOURCE_EXT.test(file) && !IGNORED.test(file));
}

export async function gitShow(ref: string, file: string, cwd: string): Promise<string | null> {
  assertRef(ref);
  if (file.includes("\0") || file.startsWith("-")) {
    throw new Error("Invalid repository path");
  }
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

function assertRef(ref: string): string {
  if (!/^[0-9a-fA-F]{7,40}$|^[A-Za-z0-9._/@+-]+$/.test(ref) || ref.startsWith("-")) {
    throw new Error("Invalid git revision");
  }
  return ref;
}

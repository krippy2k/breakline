import { execFile } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RepositoryCheckoutRequest {
  analysisId: string;
  owner: string;
  repo: string;
  baseSha: string;
  headSha: string;
  pullRequestNumber: number;
  token: string;
  workRoot?: string;
  maxCheckoutBytes?: number;
}

export interface RepositoryCheckout {
  path: string;
  cleanup: () => Promise<void>;
}

export interface RepositoryProvider {
  checkout(input: RepositoryCheckoutRequest): Promise<RepositoryCheckout>;
}

const OWNER_REPO = /^[A-Za-z0-9_.-]+$/;
const SHA = /^[0-9a-f]{7,40}$/i;

export function assertSafeGitIdentity(value: string, label: string): string {
  if (label === "sha" ? !SHA.test(value) : !OWNER_REPO.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export class GitRepositoryProvider implements RepositoryProvider {
  async checkout(input: RepositoryCheckoutRequest): Promise<RepositoryCheckout> {
    const owner = assertSafeGitIdentity(input.owner, "owner");
    const repo = assertSafeGitIdentity(input.repo, "repo");
    const baseSha = assertSafeGitIdentity(input.baseSha, "sha");
    const headSha = assertSafeGitIdentity(input.headSha, "sha");
    const root = input.workRoot ?? join(tmpdir(), "breakline");
    const path = join(root, input.analysisId);
    await mkdir(path, { recursive: true });

    const cleanup = async () => {
      await rm(path, { recursive: true, force: true });
    };

    try {
      await git(path, ["init"]);
      await git(path, ["remote", "add", "origin", `https://github.com/${owner}/${repo}.git`]);
      await fetchSha(path, input.token, baseSha);
      try {
        await fetchSha(path, input.token, headSha);
      } catch {
        await fetchRef(path, input.token, `pull/${input.pullRequestNumber}/head`);
      }
      await git(path, ["checkout", "--force", headSha]);
      if (input.maxCheckoutBytes) {
        const size = await directorySize(path);
        if (size > input.maxCheckoutBytes) {
          throw new CheckoutLimitError(
            `Repository checkout exceeded the configured size limit (${size} bytes).`,
          );
        }
      }
      return { path, cleanup };
    } catch (error) {
      await cleanup();
      throw error;
    }
  }
}

export class CheckoutLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutLimitError";
  }
}

async function fetchSha(cwd: string, token: string, sha: string): Promise<void> {
  await git(cwd, ["fetch", "--depth=1", "origin", sha], token);
}

async function fetchRef(cwd: string, token: string, ref: string): Promise<void> {
  if (!/^pull\/\d+\/head$/.test(ref)) {
    throw new Error("Invalid pull request ref");
  }
  await git(cwd, ["fetch", "--depth=1", "origin", ref], token);
}

async function git(cwd: string, args: string[], token?: string): Promise<void> {
  const extra = token ? ["-c", `http.extraHeader=AUTHORIZATION: bearer ${token}`] : [];
  try {
    await execFileAsync("git", [...extra, ...args], {
      cwd,
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    throw sanitizeGitError(error);
  }
}

function sanitizeGitError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "git command failed";
  return new Error(message.replace(/bearer\s+\S+/gi, "bearer [redacted]"));
}

async function directorySize(root: string): Promise<number> {
  const { readdir } = await import("node:fs/promises");
  let total = 0;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(full);
    } else {
      total += (await stat(full)).size;
    }
  }
  return total;
}

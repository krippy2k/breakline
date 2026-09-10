import { isAbsolute, resolve } from "node:path";

/** Directory the user invoked the command from (pnpm/npm set INIT_CWD). */
export function invocationCwd(): string {
  const initCwd = process.env.INIT_CWD;
  if (initCwd) {
    return initCwd;
  }
  return process.cwd();
}

export function resolveUserPath(file: string): string {
  if (isAbsolute(file)) {
    return file;
  }
  return resolve(invocationCwd(), file);
}

import { readFileSync } from "node:fs";

export interface ServerEnv {
  port: number;
  githubAppId: string;
  githubPrivateKey: string;
  githubWebhookSecret: string;
  baseUrl: string;
  databaseUrl?: string;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const privateKey = source.GITHUB_APP_PRIVATE_KEY ?? readOptional(source.GITHUB_APP_PRIVATE_KEY_PATH);
  return {
    port: Number.parseInt(source.PORT ?? "3000", 10),
    githubAppId: required(source.GITHUB_APP_ID, "GITHUB_APP_ID"),
    githubPrivateKey: required(privateKey, "GITHUB_APP_PRIVATE_KEY"),
    githubWebhookSecret: required(source.GITHUB_WEBHOOK_SECRET, "GITHUB_WEBHOOK_SECRET"),
    baseUrl: source.BREAKLINE_BASE_URL ?? `http://localhost:${source.PORT ?? "3000"}`,
    databaseUrl: source.DATABASE_URL,
  };
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function readOptional(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }
  return readFileSync(path, "utf8");
}

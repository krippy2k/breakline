import { createPrivateKey, createSign } from "node:crypto";

export interface AppAuthOptions {
  appId: string;
  privateKey: string;
  now?: () => number;
}

export function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  const unquoted = trimmed.startsWith("\"") && trimmed.endsWith("\"") ? trimmed.slice(1, -1) : trimmed;
  return unquoted.includes("\\n") ? unquoted.replace(/\\n/g, "\n") : unquoted;
}

export function createAppJwt(options: AppAuthOptions): string {
  const now = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const payload = encodeJson({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: options.appId,
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const key = createPrivateKey(normalizePrivateKey(options.privateKey));
  const signature = signer.sign(key).toString("base64url");
  return `${unsigned}.${signature}`;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

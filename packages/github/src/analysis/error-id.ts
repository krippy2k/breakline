import { randomBytes } from "node:crypto";

export function createErrorId(): string {
  return `BL-${randomBytes(10).toString("hex").toUpperCase()}`;
}

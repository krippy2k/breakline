import { createHash } from "node:crypto";
import type { ChangeKind } from "../classify/types.js";

export function findingId(parts: {
  kind: ChangeKind;
  symbol: string;
  file: string;
  before?: string;
  after?: string;
}): string {
  const raw = [parts.kind, parts.symbol, parts.file, parts.before ?? "", parts.after ?? ""].join("\0");
  return `bl_${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

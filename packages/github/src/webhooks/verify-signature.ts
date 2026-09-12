import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(input: {
  rawBody: Buffer | string;
  signature?: string | null;
  secret: string;
}): boolean {
  if (!input.signature || !input.secret) {
    return false;
  }
  const expected = `sha256=${createHmac("sha256", input.secret).update(input.rawBody).digest("hex")}`;
  const actual = input.signature.trim();
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, actualBytes);
}

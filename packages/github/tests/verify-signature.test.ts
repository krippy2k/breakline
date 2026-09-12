import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "../src/webhooks/verify-signature.js";

describe("verifyWebhookSignature", () => {
  it("accepts a valid GitHub HMAC", () => {
    const secret = "top-secret";
    const rawBody = Buffer.from('{"zen":"design"}');
    const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    expect(verifyWebhookSignature({ rawBody, signature, secret })).toBe(true);
  });

  it("rejects a missing or invalid signature", () => {
    const secret = "top-secret";
    const rawBody = '{"zen":"design"}';
    expect(verifyWebhookSignature({ rawBody, signature: undefined, secret })).toBe(false);
    expect(verifyWebhookSignature({ rawBody, signature: "sha256=deadbeef", secret })).toBe(false);
    expect(
      verifyWebhookSignature({
        rawBody,
        signature: `sha256=${createHmac("sha256", "other").update(rawBody).digest("hex")}`,
        secret,
      }),
    ).toBe(false);
  });
});

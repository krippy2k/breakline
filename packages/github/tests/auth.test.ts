import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAppJwt, normalizePrivateKey } from "../src/app/auth.js";
import { InstallationAuth, MemoryTokenStore } from "../src/app/installation-token.js";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

describe("GitHub app auth", () => {
  it("normalizes escaped PEM keys", () => {
    const escaped = privateKey.replace(/\n/g, "\\n");
    expect(normalizePrivateKey(escaped)).toContain("BEGIN RSA PRIVATE KEY");
    expect(normalizePrivateKey(escaped)).toContain("\n");
  });

  it("creates a three-part RS256 JWT", () => {
    const jwt = createAppJwt({ appId: "123", privateKey, now: () => 1_000_000_000_000 });
    const [header, payload, signature] = jwt.split(".");
    expect(header && payload && signature).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
    expect(decoded.iss).toBe("123");
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it("caches installation tokens in memory and refreshes before expiry", async () => {
    let calls = 0;
    const auth = new InstallationAuth(
      { appId: "123", privateKey },
      {
        async requestToken() {
          calls += 1;
          return { token: `tok-${calls}`, expires_at: new Date(Date.now() + 60 * 60_000).toISOString() };
        },
      },
      new MemoryTokenStore(),
    );
    const first = await auth.getToken(9);
    const second = await auth.getToken(9);
    expect(first).toBe("tok-1");
    expect(second).toBe("tok-1");
    expect(calls).toBe(1);

    const expired = new InstallationAuth(
      { appId: "123", privateKey },
      {
        async requestToken() {
          return { token: "fresh", expires_at: new Date(Date.now() + 30_000).toISOString() };
        },
      },
    );
    const store = expired as unknown as { store: MemoryTokenStore };
    void store;
    expect(await expired.getToken(1, Date.now())).toBe("fresh");
  });
});

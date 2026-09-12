import { describe, expect, it } from "vitest";
import { assertSafeGitIdentity } from "../src/analysis/repository-fetch.js";

describe("repository fetch safety", () => {
  it("accepts normal GitHub identifiers", () => {
    expect(assertSafeGitIdentity("acme-org", "owner")).toBe("acme-org");
    expect(assertSafeGitIdentity("payments.js", "repo")).toBe("payments.js");
    expect(assertSafeGitIdentity("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha")).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("rejects path traversal and shell metacharacters", () => {
    expect(() => assertSafeGitIdentity("../etc", "owner")).toThrow(/Invalid owner/);
    expect(() => assertSafeGitIdentity("repo;rm", "repo")).toThrow(/Invalid repo/);
    expect(() => assertSafeGitIdentity("not a sha", "sha")).toThrow(/Invalid sha/);
  });
});

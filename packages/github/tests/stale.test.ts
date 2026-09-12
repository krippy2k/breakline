import { describe, expect, it } from "vitest";
import { isStaleHead, sameAnalysisIdentity } from "../src/analysis/stale.js";

describe("stale analysis", () => {
  it("detects a newer head SHA", () => {
    expect(isStaleHead("old", "new")).toBe(true);
    expect(isStaleHead("same", "same")).toBe(false);
    expect(isStaleHead("old", undefined)).toBe(false);
  });

  it("matches analysis identity by SHAs", () => {
    expect(sameAnalysisIdentity({ baseSha: "a", headSha: "b" }, { baseSha: "a", headSha: "b" })).toBe(true);
    expect(sameAnalysisIdentity({ baseSha: "a", headSha: "b" }, { baseSha: "a", headSha: "c" })).toBe(false);
  });
});

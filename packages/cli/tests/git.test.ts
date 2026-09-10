import { describe, expect, it } from "vitest";
import { parseRange } from "../src/git.js";

describe("parseRange", () => {
  it("parses main..HEAD", () => {
    expect(parseRange("main..HEAD")).toEqual({ base: "main", head: "HEAD" });
  });

  it("parses two positional refs", () => {
    expect(parseRange("HEAD~1", undefined, undefined, ["HEAD"])).toEqual({
      base: "HEAD~1",
      head: "HEAD",
    });
  });

  it("prefers --base and --head", () => {
    expect(parseRange(undefined, "main", "feature")).toEqual({ base: "main", head: "feature" });
  });
});

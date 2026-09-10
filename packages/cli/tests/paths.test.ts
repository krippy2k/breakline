import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { invocationCwd, resolveUserPath } from "../src/paths.js";

describe("resolveUserPath", () => {
  const previous = process.env.INIT_CWD;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = previous;
    }
  });

  it("resolves relative paths against INIT_CWD", () => {
    process.env.INIT_CWD = resolve("/tmp/fixture-dir");
    expect(resolveUserPath("after.ts")).toBe(resolve("/tmp/fixture-dir", "after.ts"));
  });

  it("keeps absolute paths", () => {
    const absolute = resolve("/tmp/other/file.ts");
    process.env.INIT_CWD = resolve("/tmp/fixture-dir");
    expect(resolveUserPath(absolute)).toBe(absolute);
  });

  it("falls back to process.cwd when INIT_CWD is unset", () => {
    delete process.env.INIT_CWD;
    expect(invocationCwd()).toBe(process.cwd());
  });
});

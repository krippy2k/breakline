import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inspectSource } from "../src/index.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

describe("inspectSource", () => {
  it("enumerates the canDelete function", () => {
    const file = join(fixtures, "conditions/can-delete/before.ts");
    const source = readFileSync(file, "utf8");
    const functions = inspectSource(file, source);
    expect(functions).toHaveLength(1);
    expect(functions[0]?.identity.name).toBe("canDelete");
    expect(functions[0]?.parameters.map((param) => param.name)).toEqual(["isAdmin", "isOwner"]);
    expect(functions[0]?.location.start.line).toBeGreaterThan(0);
  });

  it("enumerates class methods", () => {
    const source = `
      export class Orders {
        cancel(role: string) {
          return role;
        }
      }
    `;
    const functions = inspectSource("orders.ts", source);
    expect(functions[0]?.identity).toMatchObject({
      name: "cancel",
      container: "Orders",
      kind: "method",
    });
  });
});

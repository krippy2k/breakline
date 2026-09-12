import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@breakline/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@breakline/report": fileURLToPath(new URL("../../packages/report/src/index.ts", import.meta.url)),
      "@breakline/github": fileURLToPath(new URL("../../packages/github/src/index.ts", import.meta.url)),
    },
  },
});

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "dot-prompts/mcp": resolve(root, "packages/core/src/mcp/index.ts"),
      "dot-prompts": resolve(root, "packages/core/src/index.ts"),
      "@dot-prompts/pi": resolve(root, "packages/pi/src/index.ts"),
      "@dot-prompts/conformance": resolve(
        root,
        "packages/conformance/src/index.ts",
      ),
    },
  },
  test: {
    include: [
      "packages/core/test/**/*.test.ts",
      "packages/pi/test/**/*.test.ts",
      "packages/conformance/test/**/*.test.ts",
    ],
  },
});

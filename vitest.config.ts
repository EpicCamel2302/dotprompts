import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "dot-prompts/pi": resolve(root, "src/pi/index.ts"),
      "dot-prompts": resolve(root, "src/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts", "extensions/pi/test/**/*.test.ts"],
  },
});

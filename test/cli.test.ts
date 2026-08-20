import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("cli smoke", () => {
  let promptsDir: string;
  let tempDir: string;
  let cliPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dot-prompts-cli-"));
    promptsDir = join(tempDir, ".prompts");
    cliPath = join(process.cwd(), "dist/cli.js");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it.skipIf(!existsSync(join(process.cwd(), "dist/cli.js")))(
    "runs record and lookup with links model",
    () => {
      const recordInput = JSON.stringify({
        model: "test-model",
        prompt: "Initialize x",
        targets: [
          {
            path: "sample.ts",
            links: [
              { type: "file" },
              {
                type: "region",
                startLine: 1,
                endLine: 3,
              },
            ],
          },
        ],
      });

      execFileSync(
        "node",
        [cliPath, "--prompts-dir", promptsDir, "record"],
        { input: recordInput, encoding: "utf8" },
      );

      const lookupOut = execFileSync(
        "node",
        [
          cliPath,
          "--prompts-dir",
          promptsDir,
          "lookup",
          "--path",
          "sample.ts",
          "--start-line",
          "1",
          "--end-line",
          "2",
        ],
        { encoding: "utf8" },
      );
      const lookupResult = JSON.parse(lookupOut) as { matches: unknown[] };
      expect(lookupResult.matches.length).toBeGreaterThan(0);

      const history = readFileSync(join(promptsDir, "history.jsonl"), "utf8");
      expect(history.trim().length).toBeGreaterThan(0);
    },
  );
});

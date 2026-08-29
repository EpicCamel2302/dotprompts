import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("cli smoke", () => {
  let promptsDir: string;
  let tempDir: string;
  const cliPath = join(process.cwd(), "dist/cli.js");
  const hasCli = existsSync(cliPath);

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dot-prompts-cli-"));
    promptsDir = join(tempDir, ".prompts");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function run(args: string[], input?: string): string {
    return execFileSync("node", [cliPath, "--prompts-dir", promptsDir, ...args], {
      input,
      encoding: "utf8",
    });
  }

  const sampleRecord = {
    model: "test-model",
    prompt: "Initialize x",
    targets: [
      {
        path: "sample.ts",
        links: [
          { type: "file" },
          { type: "region", startLine: 1, endLine: 3 },
        ],
      },
    ],
  };

  it.skipIf(!hasCli)(
    "runs record and lookup with links model",
    () => {
      run(["record"], JSON.stringify(sampleRecord));

      const lookupOut = run([
        "lookup",
        "--path",
        "sample.ts",
        "--start-line",
        "1",
        "--end-line",
        "2",
      ]);
      const lookupResult = JSON.parse(lookupOut) as { matches: unknown[] };
      expect(lookupResult.matches.length).toBeGreaterThan(0);

      const history = readFileSync(join(promptsDir, "history.jsonl"), "utf8");
      expect(history.trim().length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!hasCli)("lists, gets, chains, and summarizes context", () => {
    const recorded = JSON.parse(
      run(["record"], JSON.stringify(sampleRecord)),
    ) as { id: string };

    const listed = JSON.parse(run(["list", "--path", "sample.ts"])) as {
      records: Array<{ id: string }>;
    };
    expect(listed.records.map((r) => r.id)).toContain(recorded.id);

    const got = JSON.parse(run(["get", recorded.id])) as { id: string };
    expect(got.id).toBe(recorded.id);

    const chained = JSON.parse(run(["chain", recorded.id])) as {
      entries: Array<{ record: { id: string } }>;
    };
    expect(chained.entries[0]?.record.id).toBe(recorded.id);

    const summary = JSON.parse(run(["context", "--limit", "5"])) as {
      records: unknown[];
    };
    expect(summary.records.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasCli)("annotates files via read and accepts --file records", () => {
    const samplePath = join(tempDir, "sample.ts");
    writeFileSync(samplePath, "const x = 1;\n", "utf8");

    const annotated = JSON.parse(
      run(["read", samplePath, "--format", "json"]),
    ) as { lines: Array<{ line: number; hash: string }> };
    expect(annotated.lines[0]?.line).toBe(1);
    expect(annotated.lines[0]?.hash).toMatch(/^[0-9a-f]{2}$/);

    const human = run(["read", samplePath, "--format", "human"]);
    expect(human).toMatch(/^1#[0-9a-f]{2} const x = 1;/);

    const inputPath = join(tempDir, "record.json");
    writeFileSync(inputPath, JSON.stringify(sampleRecord), "utf8");
    const fromFile = JSON.parse(run(["record", "--file", inputPath])) as {
      id: string;
    };
    expect(fromFile.id).toBeTruthy();
  });

  it.skipIf(!hasCli)("exits non-zero for missing get and invalid records", () => {
    expect(() =>
      run(["get", "00000000-0000-4000-8000-000000000000"]),
    ).toThrow();

    expect(() =>
      run(["record"], JSON.stringify({ model: "x", prompt: "y", targets: [] })),
    ).toThrow();
  });
});

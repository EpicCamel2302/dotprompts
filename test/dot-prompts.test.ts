import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  annotateContent,
  computeLineHash,
  resolveAnchor,
} from "../src/hashline.js";
import {
  extractLinksFromEdit,
  formatLookupForAgent,
  formatLookupNotice,
  parseRegionFromPatch,
} from "../src/links/extract.js";
import { extractNearestSymbol } from "../src/links/symbols.js";
import { record, buildRecord } from "../src/record.js";
import { context, get, list, lookup } from "../src/query.js";
import { readAllRecords } from "../src/storage.js";
import { ValidationError, validateRecord } from "../src/validate.js";

describe("hashline", () => {
  it("computes stable 2-char hex hashes", () => {
    expect(computeLineHash("function hello() {")).toMatch(/^[0-9a-f]{2}$/);
    expect(computeLineHash("function hello() {")).toBe(
      computeLineHash("function hello() {"),
    );
  });

  it("annotates content with line numbers and hashes", () => {
    const lines = annotateContent("alpha\nbeta\n");
    expect(lines).toEqual([
      { line: 1, hash: computeLineHash("alpha"), content: "alpha" },
      { line: 2, hash: computeLineHash("beta"), content: "beta" },
    ]);
  });
});

describe("link extraction", () => {
  it("parses region from unified patch", () => {
    const patch = [
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -10,3 +10,5 @@",
      " context",
      "-old",
      "+new",
    ].join("\n");

    expect(parseRegionFromPatch(patch, "src/foo.ts")).toEqual({
      startLine: 10,
      endLine: 14,
    });
  });

  it("extracts file, region, and symbol links from edit context", () => {
    const contentBefore = [
      "export async function fetchWithRetry(url: string) {",
      "  return fetch(url);",
      "}",
    ].join("\n");

    const target = extractLinksFromEdit({
      cwd: process.cwd(),
      path: "examples/footgun/fetch.ts",
      firstChangedLine: 2,
      contentBefore,
    });

    expect(target.links.some((link) => link.type === "file")).toBe(true);
    expect(target.links.some((link) => link.type === "region")).toBe(true);
    expect(
      target.links.some(
        (link) => link.type === "symbol" && link.name === "fetchWithRetry",
      ),
    ).toBe(true);
  });

  it("extracts nearest symbol above edited region", () => {
    const content = [
      "const helper = () => 1;",
      "export async function fetchWithRetry(url: string) {",
      "  return fetch(url);",
      "}",
    ].join("\n");

    const symbol = extractNearestSymbol(content, 3, 3);
    expect(symbol?.name).toBe("fetchWithRetry");
  });
});

describe("validation", () => {
  it("accepts valid link-based records", () => {
    expect(() =>
      validateRecord({
        version: 1,
        id: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: "2026-08-20T11:00:00.000Z",
        model: "claude-4-sonnet",
        prompt: "Add retry logic",
        targets: [
          {
            path: "src/api/fetch.ts",
            links: [
              { type: "file", path: "src/api/fetch.ts" },
              {
                type: "region",
                path: "src/api/fetch.ts",
                startLine: 10,
                endLine: 20,
              },
              {
                type: "symbol",
                path: "src/api/fetch.ts",
                name: "fetchWithRetry",
                kind: "function",
              },
            ],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects invalid record shape", () => {
    expect(() =>
      validateRecord({
        version: 1,
        id: "not-a-uuid",
        timestamp: "2026-08-20T11:00:00.000Z",
        model: "test",
        prompt: "test",
        targets: [],
      } as never),
    ).toThrow(ValidationError);
  });
});

describe("storage and ranked lookup", () => {
  let promptsDir: string;

  beforeEach(() => {
    promptsDir = mkdtempSync(join(tmpdir(), "dot-prompts-test-"));
  });

  afterEach(() => {
    rmSync(promptsDir, { recursive: true, force: true });
  });

  const sampleInput = {
    model: "claude-4-sonnet",
    prompt: "Add retry logic to fetch",
    targets: [
      {
        path: "src/api/fetch.ts",
        links: [
          { type: "file" as const, path: "src/api/fetch.ts" },
          {
            type: "region" as const,
            path: "src/api/fetch.ts",
            startLine: 40,
            endLine: 50,
          },
          {
            type: "symbol" as const,
            path: "src/api/fetch.ts",
            name: "fetchWithRetry",
            kind: "function",
          },
        ],
      },
    ],
    metadata: { harness: "test" },
  };

  it("records, lists, and gets by id", () => {
    const saved = record(sampleInput, { promptsDir });
    expect(saved.id).toBeTruthy();
    expect(readAllRecords(promptsDir)).toHaveLength(1);

    const listed = list({ promptsDir, path: "src/api/fetch.ts" });
    expect(listed).toHaveLength(1);
    expect(get(saved.id, { promptsDir })?.prompt).toBe(sampleInput.prompt);
  });

  it("lookup ranks symbol above region above file", () => {
    record(sampleInput, { promptsDir });

    const symbolMatch = lookup(
      {
        path: "src/api/fetch.ts",
        symbol: "fetchWithRetry",
      },
      { promptsDir },
    );
    expect(symbolMatch.matches[0]?.confidence).toBe(0.9);

    const regionMatch = lookup(
      {
        path: "src/api/fetch.ts",
        startLine: 42,
        endLine: 45,
      },
      { promptsDir },
    );
    expect(regionMatch.matches[0]?.confidence).toBe(0.7);

    const fileMatch = lookup(
      { path: "src/api/fetch.ts" },
      { promptsDir, minConfidence: 0.4 },
    );
    expect(fileMatch.matches[0]?.confidence).toBe(0.4);
  });

  it("lookup matches hashline exactly and stale", () => {
    record(
      {
        model: "test",
        prompt: "hashline test",
        targets: [
          {
            path: "src/a.ts",
            links: [
              {
                type: "hashline",
                path: "src/a.ts",
                line: 42,
                hash: "f1",
              },
            ],
          },
        ],
      },
      { promptsDir },
    );

    const exact = lookup(
      {
        path: "src/a.ts",
        hashline: { line: 42, hash: "f1" },
      },
      { promptsDir },
    );
    expect(exact.matches[0]?.confidence).toBe(0.95);

    const stale = lookup(
      {
        path: "src/a.ts",
        hashline: { line: 42, hash: "00" },
      },
      { promptsDir },
    );
    expect(stale.matches[0]?.confidence).toBe(0.5);
    expect(stale.matches[0]?.stale).toBe(true);
  });

  it("context returns compact summaries", () => {
    record(sampleInput, { promptsDir });
    const summary = context({ promptsDir, limit: 5 });
    expect(summary.records[0]).toMatchObject({
      model: "claude-4-sonnet",
      prompt: sampleInput.prompt,
      paths: ["src/api/fetch.ts"],
      linkCount: 3,
    });
  });

  it("formats lookup notice and agent output", () => {
    const notice = formatLookupNotice(2, 12, 28);
    expect(notice).toContain("[dot-prompts]");
    expect(notice).toContain("prompts_read");

    const text = formatLookupForAgent([
      {
        record: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          timestamp: "2026-08-20T11:00:00.000Z",
          model: "test",
          prompt: "Keep retries at 3",
        },
        confidence: 0.9,
      },
    ]);
    expect(text).toContain("Keep retries at 3");
  });
});

describe("resolveAnchor", () => {
  let filePath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dot-prompts-file-"));
    filePath = join(tempDir, "sample.ts");
    writeFileSync(filePath, "first line\nsecond line\n", "utf8");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("resolves valid and invalid anchors", () => {
    const lines = annotateContent("first line\nsecond line\n");
    const valid = resolveAnchor(filePath, lines[0]!);
    expect(valid.valid).toBe(true);
    expect(valid.content).toBe("first line");

    const invalid = resolveAnchor(filePath, { line: 1, hash: "00" });
    expect(invalid.valid).toBe(false);
    expect(invalid.content).toBe("first line");
  });
});

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

  it("runs record and lookup with links model", () => {
    const recordInput = JSON.stringify({
      model: "test-model",
      prompt: "Initialize x",
      targets: [
        {
          path: "sample.ts",
          links: [
            { type: "file", path: "sample.ts" },
            {
              type: "region",
              path: "sample.ts",
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
  });
});

describe("buildRecord", () => {
  it("builds valid records from input", () => {
    const built = buildRecord({
      model: "test",
      prompt: "do thing",
      targets: [
        {
          path: "a.ts",
          links: [{ type: "file", path: "a.ts" }],
        },
      ],
    });
    expect(built.version).toBe(1);
    expect(built.id).toBeTruthy();
  });
});

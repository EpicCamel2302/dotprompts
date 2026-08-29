import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createJsonlStorage,
  HISTORY_FILE,
  mirrorFilename,
  RECORDS_DIR,
} from "../src/core/storage.js";
import { record } from "../src/core/record.js";
import {
  context,
  get,
  list,
  lookup,
  lookupForReadRange,
} from "../src/core/query.js";

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
          { type: "file" as const },
          {
            type: "region" as const,
            startLine: 40,
            endLine: 50,
          },
          {
            type: "symbol" as const,
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
    expect(list({ promptsDir })).toHaveLength(1);

    const listed = list({ promptsDir, path: "src/api/fetch.ts" });
    expect(listed).toHaveLength(1);
    expect(get(saved.id, { promptsDir })?.prompt).toBe(sampleInput.prompt);
  });

  it("accepts an injected Storage instance", () => {
    const storage = createJsonlStorage(promptsDir);
    record(sampleInput, { storage });
    expect(storage.list()).toHaveLength(1);
    expect(get(storage.list()[0]!.id, { storage })?.model).toBe(
      "claude-4-sonnet",
    );
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

  it("filters list by model, since, and limit", () => {
    const older = record(
      {
        ...sampleInput,
        model: "old-model",
        timestamp: "2026-01-01T00:00:00.000Z",
        prompt: "older",
      },
      { promptsDir },
    );
    const newer = record(
      {
        ...sampleInput,
        model: "new-model",
        timestamp: "2026-06-01T00:00:00.000Z",
        prompt: "newer",
      },
      { promptsDir },
    );

    expect(list({ promptsDir, model: "new-model" }).map((r) => r.id)).toEqual([
      newer.id,
    ]);
    expect(
      list({ promptsDir, since: "2026-03-01T00:00:00.000Z" }).map((r) => r.id),
    ).toEqual([newer.id]);
    expect(list({ promptsDir, limit: 1 })[0]?.id).toBe(newer.id);
    expect(older.id).toBeTruthy();
  });

  it("normalizes path separators for list and lookup", () => {
    record(sampleInput, { promptsDir });
    expect(list({ promptsDir, path: "src\\api\\fetch.ts" })).toHaveLength(1);
    expect(
      lookup({ path: "src\\api\\fetch.ts" }, { promptsDir }).matches,
    ).toHaveLength(1);
  });

  it("maps read ranges via lookupForReadRange", () => {
    record(sampleInput, { promptsDir });
    const ranged = lookupForReadRange("src/api/fetch.ts", 42, 4, {
      promptsDir,
    });
    expect(ranged.matches[0]?.confidence).toBe(0.7);

    const openEnded = lookupForReadRange("src/api/fetch.ts", 40, undefined, {
      promptsDir,
    });
    expect(openEnded.matches.length).toBeGreaterThan(0);
  });

  it("returns empty list for missing history and writes mirrors", () => {
    const storage = createJsonlStorage(promptsDir);
    expect(storage.list()).toEqual([]);
    expect(existsSync(join(promptsDir, HISTORY_FILE))).toBe(false);

    const saved = record(sampleInput, { storage });
    expect(readFileSync(join(promptsDir, HISTORY_FILE), "utf8")).toContain(
      saved.id,
    );
    const mirror = join(promptsDir, RECORDS_DIR, mirrorFilename(saved));
    expect(existsSync(mirror)).toBe(true);
    expect(JSON.parse(readFileSync(mirror, "utf8")).id).toBe(saved.id);
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectProvenanceChain,
  expandReferencedRecords,
  findRecordsReferencing,
  formatProvenanceChainForAgent,
  getReferencedRecordIds,
} from "../src/provenance/chain.js";
import { chain } from "../src/core/query.js";
import { record } from "../src/core/record.js";

describe("provenance chain", () => {
  let promptsDir: string;

  beforeEach(() => {
    promptsDir = mkdtempSync(join(tmpdir(), "dot-prompts-chain-"));
  });

  afterEach(() => {
    rmSync(promptsDir, { recursive: true, force: true });
  });

  it("extracts referencedRecords from metadata", () => {
    expect(
      getReferencedRecordIds({
        referencedRecords: ["a", "b"],
      }),
    ).toEqual(["a", "b"]);
  });

  it("walks transitive referencedRecords", () => {
    const a = record(
      {
        model: "test",
        prompt: "Add retry for 429",
        targets: [
          {
            path: "a.ts",
            links: [{ type: "file" }],
          },
        ],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "Rename to fetchWithRetry",
        targets: [
          {
            path: "a.ts",
            links: [{ type: "symbol", name: "fetchWithRetry" }],
          },
        ],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    const c = record(
      {
        model: "test",
        prompt: "Simplify fetch logic",
        targets: [
          {
            path: "a.ts",
            links: [{ type: "file" }],
          },
        ],
        metadata: { referencedRecords: [b.id] },
      },
      { promptsDir },
    );

    const result = collectProvenanceChain([c.id], { promptsDir });
    expect(result.entries.map((e) => e.record.id)).toEqual([c.id, b.id, a.id]);
    expect(result.truncated).toBe(false);
  });

  it("expandReferencedRecords returns transitive ids in order", () => {
    const a = record(
      {
        model: "test",
        prompt: "original intent",
        targets: [
          { path: "x.ts", links: [{ type: "file" }] },
        ],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "rename",
        targets: [
          { path: "y.ts", links: [{ type: "file" }] },
        ],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    expect(expandReferencedRecords([b.id], { promptsDir })).toEqual([
      b.id,
      a.id,
    ]);
  });

  it("respects maxRecords when agent caps traversal", () => {
    const a = record(
      {
        model: "test",
        prompt: "root",
        targets: [{ path: "a.ts", links: [{ type: "file" }] }],
      },
      { promptsDir },
    );
    const b = record(
      {
        model: "test",
        prompt: "middle",
        targets: [{ path: "b.ts", links: [{ type: "file" }] }],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );
    const c = record(
      {
        model: "test",
        prompt: "leaf",
        targets: [{ path: "c.ts", links: [{ type: "file" }] }],
        metadata: { referencedRecords: [b.id] },
      },
      { promptsDir },
    );

    const capped = chain(c.id, { promptsDir, maxRecords: 2 });
    expect(capped.entries.map((e) => e.record.id)).toEqual([c.id, b.id]);
    expect(capped.truncated).toBe(true);
    expect(capped.truncatedReason).toBe("maxRecords");
  });

  it("tolerates cycles without revisiting ids", () => {
    const a = record(
      {
        model: "test",
        prompt: "a",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        targets: [{ path: "a.ts", links: [{ type: "file" }] }],
        metadata: {
          referencedRecords: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
        },
      },
      { promptsDir },
    );
    const b = record(
      {
        model: "test",
        prompt: "b",
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        targets: [{ path: "b.ts", links: [{ type: "file" }] }],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    const walked = collectProvenanceChain([a.id], { promptsDir });
    expect(walked.entries.map((e) => e.record.id)).toEqual([a.id, b.id]);
    expect(walked.truncated).toBe(false);
  });

  it("finds records that reference a target id", () => {
    const a = record(
      {
        model: "test",
        prompt: "base",
        targets: [{ path: "a.ts", links: [{ type: "file" }] }],
      },
      { promptsDir },
    );
    const b = record(
      {
        model: "test",
        prompt: "child",
        targets: [{ path: "b.ts", links: [{ type: "file" }] }],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );
    record(
      {
        model: "test",
        prompt: "unrelated",
        targets: [{ path: "c.ts", links: [{ type: "file" }] }],
      },
      { promptsDir },
    );

    expect(findRecordsReferencing(a.id, { promptsDir }).map((r) => r.id)).toEqual([
      b.id,
    ]);
  });

  it("respects maxDepth when agent caps traversal", () => {
    const a = record(
      {
        model: "test",
        prompt: "root",
        targets: [{ path: "a.ts", links: [{ type: "file" }] }],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "middle",
        targets: [{ path: "b.ts", links: [{ type: "file" }] }],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    const c = record(
      {
        model: "test",
        prompt: "leaf",
        targets: [{ path: "c.ts", links: [{ type: "file" }] }],
        metadata: { referencedRecords: [b.id] },
      },
      { promptsDir },
    );

    const shallow = chain(c.id, { promptsDir, maxDepth: 1 });
    expect(shallow.entries.map((e) => e.record.id)).toEqual([c.id, b.id]);
    expect(shallow.truncated).toBe(true);
    expect(shallow.truncatedReason).toBe("maxDepth");
  });

  it("formats chain for agent consumption", () => {
    const a = record(
      {
        model: "test",
        prompt: "keep retry=3",
        targets: [
          {
            path: "fetch.ts",
            links: [
              { type: "file" },
              { type: "symbol", name: "fetch", kind: "function" },
            ],
          },
        ],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "rename fetch",
        targets: [
          {
            path: "fetch.ts",
            links: [{ type: "symbol", name: "fetchWithRetry" }],
          },
        ],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    const text = formatProvenanceChainForAgent(
      collectProvenanceChain([b.id], { promptsDir }),
    );
    expect(text).toContain("keep retry=3");
    expect(text).toContain("rename fetch");
    expect(text).toContain("references:");
    expect(text).toContain("2 record(s) in chain");
  });
});

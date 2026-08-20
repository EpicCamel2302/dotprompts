import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectProvenanceChain,
  expandReferencedRecords,
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
            links: [{ type: "file", path: "a.ts" }],
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
            links: [{ type: "symbol", path: "a.ts", name: "fetchWithRetry" }],
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
            links: [{ type: "file", path: "a.ts" }],
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
          { path: "x.ts", links: [{ type: "file", path: "x.ts" }] },
        ],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "rename",
        targets: [
          { path: "y.ts", links: [{ type: "file", path: "y.ts" }] },
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

  it("respects maxDepth when agent caps traversal", () => {
    const a = record(
      {
        model: "test",
        prompt: "root",
        targets: [{ path: "a.ts", links: [{ type: "file", path: "a.ts" }] }],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "middle",
        targets: [{ path: "b.ts", links: [{ type: "file", path: "b.ts" }] }],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    const c = record(
      {
        model: "test",
        prompt: "leaf",
        targets: [{ path: "c.ts", links: [{ type: "file", path: "c.ts" }] }],
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
              { type: "file", path: "fetch.ts" },
              { type: "symbol", path: "fetch.ts", name: "fetch", kind: "function" },
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
            links: [{ type: "symbol", path: "fetch.ts", name: "fetchWithRetry" }],
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

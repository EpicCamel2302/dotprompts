import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  estimateRegionFromEdits,
  extractLinksFromEdit,
  extractLinksFromWrite,
  formatLookupForAgent,
  formatLookupNotice,
  parseRegionFromPatch,
} from "../src/links/extract.js";
import {
  extractNearestSymbol,
  extractSymbolsInRange,
} from "../src/links/symbols.js";

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

  it("spans min/max across multiple hunks", () => {
    const patch = [
      "@@ -1,1 +2,2 @@",
      "+a",
      "+b",
      "@@ -20,1 +40,3 @@",
      "+c",
      "+d",
      "+e",
    ].join("\n");

    expect(parseRegionFromPatch(patch, "x.ts")).toEqual({
      startLine: 2,
      endLine: 42,
    });
  });

  it("returns null when patch has no hunks", () => {
    expect(parseRegionFromPatch("not a patch\n", "x.ts")).toBeNull();
  });

  it("estimates region from first changed line when no patch", () => {
    expect(estimateRegionFromEdits(10, 2)).toEqual({
      startLine: 10,
      endLine: 15,
    });
    expect(estimateRegionFromEdits(undefined, 1)).toEqual({
      startLine: 1,
      endLine: 3,
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
    expect(target.links.some((link) => link.type === "hashline")).toBe(false);
  });

  it("extracts write targets with file and full-file region", () => {
    const dir = mkdtempSync(join(tmpdir(), "dot-prompts-write-links-"));
    try {
      const target = extractLinksFromWrite({
        cwd: dir,
        path: "src/new.ts",
        lineCount: 12,
      });
      expect(target.path).toBe("src/new.ts");
      expect(target.links).toEqual(
        expect.arrayContaining([
          { type: "file" },
          { type: "region", startLine: 1, endLine: 12 },
        ]),
      );
      expect(target.links.some((link) => link.type === "git")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

  it("extracts symbols declared inside a range", () => {
    const content = [
      "export class RetryPolicy {}",
      "export function helper() {}",
      "const orphan = 1;",
    ].join("\n");
    const symbols = extractSymbolsInRange(content, 1, 2);
    expect(symbols.map((s) => s.name)).toEqual(["RetryPolicy", "helper"]);
  });
});

describe("lookup formatting", () => {
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

  it("reports empty matches clearly", () => {
    expect(formatLookupForAgent([])).toContain("No dot-prompts provenance");
  });

  it("marks stale anchors and hints at prompts_chain", () => {
    const text = formatLookupForAgent([
      {
        record: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          timestamp: "2026-08-20T11:00:00.000Z",
          model: "test",
          prompt: "rename helper",
          metadata: {
            referencedRecords: ["11111111-1111-4111-8111-111111111111"],
          },
        },
        confidence: 0.5,
        stale: true,
      },
    ]);
    expect(text).toContain("stale anchor");
    expect(text).toContain("prompts_chain");
    expect(text).toContain("1 prior record");
  });

  it("hints at prompts_trace from generic harness session pointers", () => {
    const text = formatLookupForAgent([
      {
        record: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          timestamp: "2026-08-20T11:00:00.000Z",
          model: "test",
          prompt: "execute plan",
          metadata: {
            harness: "pi",
            pi: { sessionFile: "/tmp/session.jsonl", sessionId: "s1" },
          },
        },
        confidence: 0.9,
      },
    ]);
    expect(text).toContain("prompts_trace");
  });
});

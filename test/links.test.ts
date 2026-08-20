import { describe, expect, it } from "vitest";
import {
  extractLinksFromEdit,
  formatLookupForAgent,
  formatLookupNotice,
  parseRegionFromPatch,
} from "../src/links/extract.js";
import { extractNearestSymbol } from "../src/links/symbols.js";

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
    expect(target.links.some((link) => link.type === "hashline")).toBe(false);
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

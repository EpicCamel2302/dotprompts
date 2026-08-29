import { describe, expect, it } from "vitest";
import { TOOL_CATALOG, formatLookupNotice } from "dot-prompts";
import {
  assertNoticeText,
  assertRegisteredTools,
  assertGenerationRecord,
} from "../src/index.js";

describe("@dot-prompts/conformance", () => {
  it("assertRegisteredTools requires read and chain", () => {
    const missing = assertRegisteredTools(["prompts_read"]);
    expect(missing.ok).toBe(false);
    expect(missing.issues.some((i) => i.code === "missing_tool")).toBe(true);

    const ok = assertRegisteredTools([
      TOOL_CATALOG.prompts_read.name,
      TOOL_CATALOG.prompts_chain.name,
    ]);
    expect(ok.ok).toBe(true);
  });

  it("assertNoticeText matches formatLookupNotice", () => {
    const notice = formatLookupNotice(2, 12, 28);
    expect(assertNoticeText(`prefix\n${notice}`, 2, 12, 28).ok).toBe(true);
    expect(assertNoticeText("no notice", 2, 12, 28).ok).toBe(false);
  });

  it("assertGenerationRecord checks harness and targets", () => {
    const bad = assertGenerationRecord(undefined, { harness: "pi" });
    expect(bad.ok).toBe(false);

    const good = assertGenerationRecord(
      {
        id: "00000000-0000-4000-8000-000000000001",
        version: 1,
        timestamp: new Date().toISOString(),
        model: "test",
        prompt: "keep retries at 3",
        targets: [{ path: "a.ts", links: [{ type: "file" }] }],
        metadata: { harness: "pi" },
      },
      { harness: "pi" },
    );
    expect(good.ok).toBe(true);
  });
});

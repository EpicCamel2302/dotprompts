import { describe, expect, it } from "vitest";
import { formatRecordFallback, toolErrorText } from "../src/tools/format.js";

describe("tool formatting helpers", () => {
  it("formats record fallback with optional fields", () => {
    const text = formatRecordFallback({
      reason: "session missing",
      recordId: "r1",
      timestamp: "2026-01-01T00:00:00.000Z",
      model: "test",
      prompt: "execute plan",
      extraLines: ["- note: ephemeral"],
    });
    expect(text).toContain("session missing");
    expect(text).toContain("r1");
    expect(text).toContain("execute plan");
    expect(text).toContain("ephemeral");
  });

  it("formats tool errors with a recovery hint", () => {
    expect(toolErrorText("prompts_read", new Error("boom"))).toContain(
      "prompts_read failed internally (boom)",
    );
    expect(toolErrorText("prompts_chain", "string-err", "custom hint")).toBe(
      "prompts_chain failed internally (string-err).\ncustom hint",
    );
  });
});

import { describe, expect, it } from "vitest";
import { getHarnessSessionPointers } from "../src/core/metadata.js";

describe("getHarnessSessionPointers", () => {
  it("reads metadata[harness] session pointers", () => {
    expect(
      getHarnessSessionPointers({
        harness: "pi",
        pi: { sessionFile: "/tmp/s.jsonl", sessionId: "abc" },
      }),
    ).toEqual({
      harness: "pi",
      sessionFile: "/tmp/s.jsonl",
      sessionId: "abc",
    });
  });

  it("falls back to top-level session pointers", () => {
    expect(
      getHarnessSessionPointers({
        harness: "custom",
        sessionFile: "/tmp/top.jsonl",
        sessionId: "top-1",
      }),
    ).toEqual({
      harness: "custom",
      sessionFile: "/tmp/top.jsonl",
      sessionId: "top-1",
    });
  });

  it("returns null when no session pointers exist", () => {
    expect(getHarnessSessionPointers({ harness: "pi" })).toBeNull();
    expect(getHarnessSessionPointers(undefined)).toBeNull();
  });
});

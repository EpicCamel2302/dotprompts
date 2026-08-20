import { describe, expect, it } from "vitest";
import {
  GenerationRecordBuffer,
  normalizeTargetPath,
  upsertTargetByPath,
} from "../src/core/generation-buffer.js";
import type { Target } from "../src/core/types.js";

function target(path: string, startLine: number): Target {
  return {
    path,
    links: [
      { type: "file" },
      { type: "region", startLine, endLine: startLine },
    ],
  };
}

describe("upsertTargetByPath", () => {
  it("appends a new path", () => {
    const result = upsertTargetByPath([], target("src/a.ts", 1));
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe("src/a.ts");
  });

  it("replaces the same path (last-edit wins), including backslash normalization", () => {
    const first = upsertTargetByPath([], target("src/a.ts", 1));
    const second = upsertTargetByPath(first, target("src\\a.ts", 9));
    expect(second).toHaveLength(1);
    expect(second[0]?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "region", startLine: 9 }),
      ]),
    );
  });
});

describe("normalizeTargetPath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizeTargetPath("src\\foo\\bar.ts")).toBe("src/foo/bar.ts");
  });
});

describe("GenerationRecordBuffer", () => {
  it("merges same-path edits and keeps first-seen path order for distinct files", () => {
    const buffer = new GenerationRecordBuffer();
    buffer.add({
      model: "test/model",
      prompt: "fix both",
      tool: "edit",
      toolCallId: "c1",
      target: target("a.ts", 1),
      filePath: "/tmp/a.ts",
    });
    buffer.add({
      model: "test/model",
      prompt: "fix both",
      tool: "write",
      toolCallId: "c2",
      target: target("b.ts", 1),
      filePath: "/tmp/b.ts",
    });
    buffer.add({
      model: "test/model",
      prompt: "fix both",
      tool: "edit",
      toolCallId: "c3",
      target: target("a.ts", 20),
      filePath: "/tmp/a.ts",
    });

    const snap = buffer.snapshot();
    expect(snap).not.toBeNull();
    expect(snap!.targets.map((t) => t.path)).toEqual(["a.ts", "b.ts"]);
    expect(snap!.targets[0]?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "region", startLine: 20 }),
      ]),
    );
    expect(snap!.tools).toEqual(["edit", "write"]);
    expect(snap!.toolCallIds).toEqual(["c1", "c2", "c3"]);
    expect(snap!.firstFilePath).toBe("/tmp/a.ts");
  });

  it("returns null when empty or prompt missing", () => {
    const buffer = new GenerationRecordBuffer();
    expect(buffer.snapshot()).toBeNull();
    buffer.add({
      model: "m",
      prompt: "",
      tool: "edit",
      toolCallId: "c1",
      target: target("a.ts", 1),
      filePath: "/tmp/a.ts",
    });
    // prompt set to "" — still treated as missing for flush
    expect(buffer.snapshot()).toBeNull();
  });

  it("clear resets state", () => {
    const buffer = new GenerationRecordBuffer();
    buffer.add({
      model: "m",
      prompt: "p",
      tool: "edit",
      toolCallId: "c1",
      target: target("a.ts", 1),
      filePath: "/tmp/a.ts",
    });
    buffer.clear();
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.snapshot()).toBeNull();
  });
});

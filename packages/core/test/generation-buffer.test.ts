import { describe, expect, it } from "vitest";
import {
  GenerationRecordBuffer,
  mergeTargetLinks,
  normalizeTargetPath,
  upsertTargetByPath,
} from "../src/core/generation-buffer.js";
import type { Link, Target } from "../src/core/types.js";

function target(path: string, startLine: number, endLine = startLine): Target {
  return {
    path,
    links: [
      { type: "file" },
      { type: "region", startLine, endLine },
    ],
  };
}

describe("mergeTargetLinks", () => {
  it("unions distinct links and dedupes identical ones", () => {
    const existing: Link[] = [
      { type: "file" },
      { type: "region", startLine: 1, endLine: 5 },
      { type: "symbol", name: "foo", kind: "function" },
    ];
    const next: Link[] = [
      { type: "file" },
      { type: "region", startLine: 1, endLine: 5 },
      { type: "region", startLine: 20, endLine: 25 },
      { type: "symbol", name: "bar", kind: "const" },
      { type: "git", commit: "abc" },
    ];
    expect(mergeTargetLinks(existing, next)).toEqual([
      { type: "file" },
      { type: "region", startLine: 1, endLine: 5 },
      { type: "symbol", name: "foo", kind: "function" },
      { type: "region", startLine: 20, endLine: 25 },
      { type: "symbol", name: "bar", kind: "const" },
      { type: "git", commit: "abc" },
    ]);
  });

  it("skips a region fully contained by an existing region", () => {
    const existing: Link[] = [
      { type: "file" },
      { type: "region", startLine: 1, endLine: 30 },
      { type: "symbol", name: "login", kind: "function" },
    ];
    const next: Link[] = [
      { type: "region", startLine: 22, endLine: 22 },
      { type: "symbol", name: "logout", kind: "function" },
    ];
    expect(mergeTargetLinks(existing, next)).toEqual([
      { type: "file" },
      { type: "region", startLine: 1, endLine: 30 },
      { type: "symbol", name: "login", kind: "function" },
      { type: "symbol", name: "logout", kind: "function" },
    ]);
  });

  it("replaces narrower regions when a wider region subsumes them", () => {
    const existing: Link[] = [
      { type: "region", startLine: 10, endLine: 12 },
      { type: "region", startLine: 40, endLine: 42 },
      { type: "symbol", name: "helper", kind: "function" },
    ];
    const next: Link[] = [{ type: "region", startLine: 1, endLine: 50 }];
    expect(mergeTargetLinks(existing, next)).toEqual([
      { type: "symbol", name: "helper", kind: "function" },
      { type: "region", startLine: 1, endLine: 50 },
    ]);
  });

  it("keeps partially overlapping regions as separate links", () => {
    const existing: Link[] = [{ type: "region", startLine: 1, endLine: 20 }];
    const next: Link[] = [{ type: "region", startLine: 15, endLine: 40 }];
    expect(mergeTargetLinks(existing, next)).toEqual([
      { type: "region", startLine: 1, endLine: 20 },
      { type: "region", startLine: 15, endLine: 40 },
    ]);
  });
});

describe("upsertTargetByPath", () => {
  it("appends a new path", () => {
    const result = upsertTargetByPath([], target("src/a.ts", 1));
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe("src/a.ts");
  });

  it("merges links for the same path, including backslash normalization", () => {
    const first = upsertTargetByPath([], target("src/a.ts", 1));
    const second = upsertTargetByPath(first, target("src\\a.ts", 9));
    expect(second).toHaveLength(1);
    expect(second[0]?.path).toBe("src/a.ts");
    expect(second[0]?.links).toEqual([
      { type: "file" },
      { type: "region", startLine: 1, endLine: 1 },
      { type: "region", startLine: 9, endLine: 9 },
    ]);
  });
});

describe("normalizeTargetPath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizeTargetPath("src\\foo\\bar.ts")).toBe("src/foo/bar.ts");
  });
});

describe("GenerationRecordBuffer", () => {
  it("merges same-path edit links and keeps first-seen path order for distinct files", () => {
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
    expect(snap!.targets[0]?.links).toEqual([
      { type: "file" },
      { type: "region", startLine: 1, endLine: 1 },
      { type: "region", startLine: 20, endLine: 20 },
    ]);
    expect(snap!.targets[1]?.links).toEqual([
      { type: "file" },
      { type: "region", startLine: 1, endLine: 1 },
    ]);
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

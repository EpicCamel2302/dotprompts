import { describe, expect, it } from "vitest";
import {
  annotateContent,
  computeLineHash,
  resolveAnchor,
} from "../src/core/hashline.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach } from "vitest";

describe("hashline", () => {
  it("computes stable 2-char hex hashes", () => {
    expect(computeLineHash("function hello() {")).toMatch(/^[0-9a-f]{2}$/);
    expect(computeLineHash("function hello() {")).toBe(
      computeLineHash("function hello() {"),
    );
  });

  it("annotates content with line numbers and hashes", () => {
    const lines = annotateContent("alpha\nbeta\n");
    expect(lines).toEqual([
      { line: 1, hash: computeLineHash("alpha"), content: "alpha" },
      { line: 2, hash: computeLineHash("beta"), content: "beta" },
    ]);
  });
});

describe("resolveAnchor", () => {
  let filePath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dot-prompts-file-"));
    filePath = join(tempDir, "sample.ts");
    writeFileSync(filePath, "first line\nsecond line\n", "utf8");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("resolves valid and invalid anchors", () => {
    const lines = annotateContent("first line\nsecond line\n");
    const valid = resolveAnchor(filePath, lines[0]!);
    expect(valid.valid).toBe(true);
    expect(valid.content).toBe("first line");

    const invalid = resolveAnchor(filePath, { line: 1, hash: "00" });
    expect(invalid.valid).toBe(false);
    expect(invalid.content).toBe("first line");
  });
});

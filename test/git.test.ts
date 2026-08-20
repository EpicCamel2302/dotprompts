import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createGitLink,
  getGitHead,
  toRepoRelativePath,
} from "../src/links/git.js";

describe("git helpers outside a repository", () => {
  let dir: string;

  beforeEach(() => {
    // Outside this repo so git walk-up does not find a parent .git.
    dir = mkdtempSync(join(tmpdir(), "dot-prompts-nogit-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null head and link when git is unavailable", () => {
    expect(getGitHead(dir)).toBeNull();
    expect(createGitLink(dir)).toBeNull();
  });

  it("falls back to a normalized path when not in a git repo", () => {
    expect(toRepoRelativePath(dir, "./src/foo.ts")).toBe("src/foo.ts");
    expect(toRepoRelativePath(dir, "src\\bar.ts")).toBe("src/bar.ts");
  });
});

describe("git helpers inside this repository", () => {
  const repoRoot = process.cwd();

  it("reads HEAD and builds a git link", () => {
    const head = getGitHead(repoRoot);
    expect(head).toMatch(/^[0-9a-f]{7,40}$/);
    expect(createGitLink(repoRoot)).toEqual({ type: "git", commit: head });
  });

  it("maps absolute paths to repo-relative paths", () => {
    const absolute = join(repoRoot, "src", "index.ts");
    expect(toRepoRelativePath(repoRoot, absolute)).toBe("src/index.ts");
    expect(toRepoRelativePath(repoRoot, "src/index.ts")).toBe("src/index.ts");
  });
});

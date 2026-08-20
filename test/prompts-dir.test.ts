import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROMPTS_DIR_NAME,
  resolvePromptsDir,
  resolvePromptsDirFromEnv,
} from "../src/core/prompts-dir.js";

describe("resolvePromptsDir", () => {
  it("joins <cwd>/.prompts when omitted", () => {
    expect(resolvePromptsDir(undefined, "/tmp/proj")).toBe(
      join("/tmp/proj", PROMPTS_DIR_NAME),
    );
  });

  it("keeps absolute paths", () => {
    expect(resolvePromptsDir("/abs/.prompts", "/tmp/proj")).toBe("/abs/.prompts");
  });

  it("resolves relative paths against cwd", () => {
    expect(resolvePromptsDir("nested/.prompts", "/tmp/proj")).toBe(
      join("/tmp/proj", "nested/.prompts"),
    );
  });
});

describe("resolvePromptsDirFromEnv", () => {
  it("reads --prompts-dir and DOT_PROMPTS_DIR", () => {
    expect(resolvePromptsDirFromEnv(["--prompts-dir", "/tmp/a"], {})).toBe(
      "/tmp/a",
    );
    expect(resolvePromptsDirFromEnv(["--prompts-dir=/tmp/b"], {})).toBe(
      "/tmp/b",
    );
    expect(
      resolvePromptsDirFromEnv([], { DOT_PROMPTS_DIR: "/tmp/c" }),
    ).toBe("/tmp/c");
  });

  it("defaults to <cwd>/.prompts", () => {
    expect(resolvePromptsDirFromEnv([], {}, "/tmp/proj")).toBe(
      join("/tmp/proj", PROMPTS_DIR_NAME),
    );
  });
});

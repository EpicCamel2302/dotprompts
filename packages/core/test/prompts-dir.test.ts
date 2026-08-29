import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONFIG_FILE_PRIMARY,
  findStore,
  initStore,
  isStoreWritable,
  resolvePromptsDirFromCli,
  StoreNotInitializedError,
  validateConfig,
} from "../src/core/config.js";
import { PROMPTS_DIR_NAME, resolvePromptsDir } from "../src/core/prompts-dir.js";
import { record } from "../src/core/record.js";
import { ValidationError } from "../src/core/validate.js";
import { HISTORY_FILE } from "../src/core/storage.js";
import { existsSync, readFileSync } from "node:fs";

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

describe("resolvePromptsDirFromCli", () => {
  it("reads --prompts-dir", () => {
    expect(resolvePromptsDirFromCli(["--prompts-dir", "/tmp/a"], "/tmp/proj")).toBe(
      "/tmp/a",
    );
    expect(resolvePromptsDirFromCli(["--prompts-dir=/tmp/b"], "/tmp/proj")).toBe(
      "/tmp/b",
    );
  });

  it("walks up from cwd when flag is omitted", () => {
    expect(resolvePromptsDirFromCli([], "/tmp/proj")).toBe(
      join("/tmp/proj", PROMPTS_DIR_NAME),
    );
  });
});

describe("findStore", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dot-prompts-store-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("uses explicit promptsDir and skips discovery", () => {
    const explicit = join(root, "custom");
    const resolved = findStore({
      cwd: root,
      filePath: join(root, "src", "a.ts"),
      promptsDir: explicit,
    });
    expect(resolved.promptsDir).toBe(explicit);
    expect(resolved.configPath).toBeNull();
  });

  it("prefers nearest dotprompts.json while walking up", () => {
    const pkg = join(root, "packages", "api");
    mkdirSync(join(pkg, "src"), { recursive: true });
    writeFileSync(
      join(pkg, CONFIG_FILE_PRIMARY),
      JSON.stringify({ version: 1, storage: { driver: "jsonl" } }),
      "utf8",
    );
    writeFileSync(
      join(root, CONFIG_FILE_PRIMARY),
      JSON.stringify({
        version: 1,
        storage: { driver: "jsonl", path: "root-prompts" },
      }),
      "utf8",
    );

    const resolved = findStore({
      filePath: join(pkg, "src", "foo.ts"),
      cwd: root,
    });
    expect(resolved.promptsDir).toBe(join(pkg, PROMPTS_DIR_NAME));
    expect(resolved.configPath).toBe(join(pkg, CONFIG_FILE_PRIMARY));
    expect(resolved.rootDir).toBe(pkg);
  });

  it("uses .prompts/config.json when primary is absent", () => {
    const pkg = join(root, "packages", "web");
    const promptsDir = join(pkg, PROMPTS_DIR_NAME);
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(
      join(promptsDir, "config.json"),
      JSON.stringify({ version: 1, storage: { driver: "jsonl" } }),
      "utf8",
    );

    const resolved = findStore({
      filePath: join(pkg, "index.ts"),
      cwd: root,
    });
    expect(resolved.promptsDir).toBe(promptsDir);
    expect(resolved.configPath).toBe(join(promptsDir, "config.json"));
  });

  it("honors storage.path on nested .prompts/config.json", () => {
    const pkg = join(root, "packages", "nested-path");
    const promptsDir = join(pkg, PROMPTS_DIR_NAME);
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(
      join(promptsDir, "config.json"),
      JSON.stringify({
        version: 1,
        storage: { driver: "jsonl", path: "alt-store" },
      }),
      "utf8",
    );

    const resolved = findStore({
      filePath: join(pkg, "index.ts"),
      cwd: root,
    });
    expect(resolved.promptsDir).toBe(join(pkg, "alt-store"));
  });

  it("treats a directory filePath as the walk start", () => {
    const pkg = join(root, "packages", "dir-start");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, CONFIG_FILE_PRIMARY),
      JSON.stringify({ version: 1, storage: { driver: "jsonl" } }),
      "utf8",
    );

    const resolved = findStore({ filePath: pkg, cwd: root });
    expect(resolved.rootDir).toBe(pkg);
    expect(resolved.promptsDir).toBe(join(pkg, PROMPTS_DIR_NAME));
  });

  it("stops at .git and defaults to <gitRoot>/.prompts", () => {
    const nested = join(root, "src", "deep");
    mkdirSync(nested, { recursive: true });
    mkdirSync(join(root, ".git"));

    const resolved = findStore({
      filePath: join(nested, "file.ts"),
      cwd: nested,
    });
    expect(resolved.promptsDir).toBe(join(root, PROMPTS_DIR_NAME));
    expect(resolved.configPath).toBeNull();
    expect(resolved.rootDir).toBe(root);
    expect(resolved.source).toBe("git");
  });

  it("marks cwd fallback when there is no git or config", () => {
    const nested = join(root, "src");
    mkdirSync(nested, { recursive: true });
    const resolved = findStore({
      filePath: join(nested, "file.ts"),
      cwd: root,
    });
    expect(resolved.source).toBe("fallback");
    expect(resolved.promptsDir).toBe(join(root, PROMPTS_DIR_NAME));
  });

  it("honors storage.path on dotprompts.json", () => {
    writeFileSync(
      join(root, CONFIG_FILE_PRIMARY),
      JSON.stringify({
        version: 1,
        storage: { driver: "jsonl", path: "custom-store" },
      }),
      "utf8",
    );
    const resolved = findStore({ cwd: root });
    expect(resolved.promptsDir).toBe(join(root, "custom-store"));
  });

  it("throws on invalid config", () => {
    writeFileSync(
      join(root, CONFIG_FILE_PRIMARY),
      JSON.stringify({ version: 1, storage: { driver: "sqlite" } }),
      "utf8",
    );
    expect(() => findStore({ cwd: root })).toThrow(ValidationError);
  });

  it("records into the package store discovered from filePath", () => {
    const pkg = join(root, "packages", "a");
    mkdirSync(join(pkg, "src"), { recursive: true });
    writeFileSync(
      join(pkg, CONFIG_FILE_PRIMARY),
      JSON.stringify({ version: 1, storage: { driver: "jsonl" } }),
      "utf8",
    );
    const filePath = join(pkg, "src", "x.ts");
    writeFileSync(filePath, "export const x = 1;\n", "utf8");

    record(
      {
        model: "test",
        prompt: "add x",
        targets: [
          {
            path: "packages/a/src/x.ts",
            links: [{ type: "file" }],
          },
        ],
      },
      { filePath, cwd: root },
    );

    const history = join(pkg, PROMPTS_DIR_NAME, HISTORY_FILE);
    expect(existsSync(history)).toBe(true);
    expect(readFileSync(history, "utf8")).toContain("add x");
  });
});

describe("initStore / record gate", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dot-prompts-init-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("refuses to record into an uninitialized non-git fallback", () => {
    const filePath = join(root, "a.ts");
    writeFileSync(filePath, "export {};\n", "utf8");
    expect(isStoreWritable(findStore({ cwd: root, filePath }))).toBe(false);
    expect(() =>
      record(
        {
          model: "test",
          prompt: "nope",
          targets: [{ path: "a.ts", links: [{ type: "file" }] }],
        },
        { cwd: root, filePath },
      ),
    ).toThrow(StoreNotInitializedError);
    expect(existsSync(join(root, PROMPTS_DIR_NAME))).toBe(false);
  });

  it("records after initStore without git", () => {
    const resolved = initStore({ cwd: root });
    expect(resolved.source).toBe("config");
    expect(existsSync(join(root, CONFIG_FILE_PRIMARY))).toBe(true);

    const filePath = join(root, "a.ts");
    writeFileSync(filePath, "export {};\n", "utf8");
    record(
      {
        model: "test",
        prompt: "after init",
        targets: [{ path: "a.ts", links: [{ type: "file" }] }],
      },
      { cwd: root, filePath },
    );
    expect(existsSync(join(root, PROMPTS_DIR_NAME, HISTORY_FILE))).toBe(true);
  });

  it("auto-creates under a git root without prior init", () => {
    mkdirSync(join(root, ".git"));
    const filePath = join(root, "a.ts");
    writeFileSync(filePath, "export {};\n", "utf8");
    record(
      {
        model: "test",
        prompt: "git ok",
        targets: [{ path: "a.ts", links: [{ type: "file" }] }],
      },
      { cwd: root, filePath },
    );
    expect(existsSync(join(root, PROMPTS_DIR_NAME, HISTORY_FILE))).toBe(true);
  });
});

describe("validateConfig", () => {
  it("accepts minimal valid config", () => {
    expect(() =>
      validateConfig({ version: 1, storage: { driver: "jsonl" } }),
    ).not.toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      validateConfig({
        version: 1,
        storage: { driver: "jsonl" },
        extra: true,
      }),
    ).toThrow(ValidationError);
  });
});

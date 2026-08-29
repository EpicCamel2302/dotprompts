import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { CONFIG_FILE_PRIMARY, PROMPTS_DIR_NAME } from "dot-prompts";
import {
  HISTORY_COMMAND_MARKER,
  isHistorySummarizePrompt,
  registerPromptsCommands,
} from "../lib/commands.js";
import { createFakePi } from "./fake-pi.js";

describe("isHistorySummarizePrompt", () => {
  it("matches the history command marker", () => {
    expect(isHistorySummarizePrompt(null)).toBe(false);
    expect(isHistorySummarizePrompt("keep retries at 3")).toBe(false);
    expect(
      isHistorySummarizePrompt(`${HISTORY_COMMAND_MARKER}\nSummarize src/foo.ts`),
    ).toBe(true);
  });
});

describe("/prompts history", () => {
  it("sends a summarize-only user message for a file path", async () => {
    const fake = createFakePi({ cwd: "/tmp" });
    registerPromptsCommands(fake.api);

    const command = fake.commands.get("prompts");
    expect(command).toBeDefined();
    await command?.handler("history src/foo.ts", fake.commandCtx());

    expect(fake.userMessages).toHaveLength(1);
    expect(fake.userMessages[0]?.content).toContain(HISTORY_COMMAND_MARKER);
    expect(fake.userMessages[0]?.content).toContain("src/foo.ts");
    expect(fake.userMessages[0]?.content).toContain("Do not edit any files");
  });

  it("notifies on missing or unknown subcommands", async () => {
    const fake = createFakePi({ cwd: "/tmp" });
    registerPromptsCommands(fake.api);
    const command = fake.commands.get("prompts");

    await command?.handler("", fake.commandCtx());
    await command?.handler("unknown src/foo.ts", fake.commandCtx());
    await command?.handler("history", fake.commandCtx());

    expect(fake.notifications.map((n) => n.level)).toEqual([
      "info",
      "error",
      "error",
    ]);
    expect(fake.userMessages).toHaveLength(0);
  });

  it("completes history and init subcommands", () => {
    const fake = createFakePi({ cwd: "/tmp" });
    registerPromptsCommands(fake.api);
    const command = fake.commands.get("prompts");

    expect(command?.getArgumentCompletions?.("his")).toEqual([
      {
        value: "history ",
        label: "history <file> — summarize provenance",
      },
    ]);
    expect(command?.getArgumentCompletions?.("in")).toEqual([
      {
        value: "init ",
        label: "init [path] — create store here or at path",
      },
    ]);
    expect(command?.getArgumentCompletions?.("history src")).toBeNull();
  });
});

describe("/prompts init", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes dotprompts.json under the session cwd", async () => {
    cwd = mkdtempSync(join(tmpdir(), "dot-prompts-init-cmd-"));
    const fake = createFakePi({ cwd });
    registerPromptsCommands(fake.api);
    const command = fake.commands.get("prompts");

    await command?.handler("init", fake.commandCtx());

    expect(existsSync(join(cwd, CONFIG_FILE_PRIMARY))).toBe(true);
    expect(existsSync(join(cwd, PROMPTS_DIR_NAME))).toBe(true);
    expect(fake.notifications[0]?.message).toContain("Initialized");
    const config = JSON.parse(
      readFileSync(join(cwd, CONFIG_FILE_PRIMARY), "utf8"),
    );
    expect(config).toEqual({ version: 1, storage: { driver: "jsonl" } });
  });

  it("accepts an optional path relative to session cwd", async () => {
    cwd = mkdtempSync(join(tmpdir(), "dot-prompts-init-path-"));
    const fake = createFakePi({ cwd });
    registerPromptsCommands(fake.api);
    const command = fake.commands.get("prompts");

    await command?.handler("init packages/api", fake.commandCtx());

    expect(
      existsSync(join(cwd, "packages", "api", CONFIG_FILE_PRIMARY)),
    ).toBe(true);
    expect(fake.notifications[0]?.message).toContain(
      join(cwd, "packages", "api"),
    );
  });
});

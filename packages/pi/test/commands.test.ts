import { describe, expect, it } from "vitest";
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

  it("completes the history subcommand", () => {
    const fake = createFakePi({ cwd: "/tmp" });
    registerPromptsCommands(fake.api);
    const command = fake.commands.get("prompts");

    expect(command?.getArgumentCompletions?.("his")).toEqual([
      {
        value: "history ",
        label: "history <file> — summarize provenance",
      },
    ]);
    expect(command?.getArgumentCompletions?.("history src")).toBeNull();
  });
});

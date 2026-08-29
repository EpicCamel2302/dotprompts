import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { initStore } from "dot-prompts";

export const HISTORY_COMMAND_MARKER = "[dot-prompts:history]";

const USAGE = "Usage: /prompts history <file> | /prompts init [path]";

export function isHistorySummarizePrompt(prompt: string | null): boolean {
  return Boolean(prompt?.includes(HISTORY_COMMAND_MARKER));
}

function historyPrompt(filePath: string): string {
  return `${HISTORY_COMMAND_MARKER}

Summarize the .prompts provenance for \`${filePath}\` for a human reader (why the code looks this way).

1. Call prompts_read on that path with a high enough limit to cover matching records.
2. If any record has referencedRecords, call prompts_chain on the newest such id.
3. Only call prompts_trace if a stored prompt is too vague to summarize.
4. End with constraints that still apply.

Do not edit any files. This turn is for explanation only.`;
}

export function registerPromptsCommands(pi: ExtensionAPI): void {
  pi.registerCommand("prompts", {
    description:
      "dot-prompts: /prompts history <file> | /prompts init [path]",
    getArgumentCompletions: (prefix) => {
      if (prefix.includes(" ")) {
        return null;
      }
      const trimmed = prefix.trim();
      const items = [
        {
          value: "history ",
          label: "history <file> — summarize provenance",
        },
        {
          value: "init ",
          label: "init [path] — create store here or at path",
        },
      ];
      return items.filter((item) => item.value.startsWith(trimmed));
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const subcommand = parts[0]?.toLowerCase() ?? "";
      const filePath = parts[1] ?? "";

      if (!subcommand) {
        ctx.ui.notify(USAGE, "info");
        return;
      }

      if (subcommand === "init") {
        if (parts.length > 2) {
          ctx.ui.notify("Usage: /prompts init [path]", "error");
          return;
        }
        try {
          const resolved = initStore({
            cwd: ctx.cwd,
            ...(filePath ? { path: filePath } : {}),
          });
          ctx.ui.notify(
            `Initialized dot-prompts at ${resolved.rootDir} (store: ${resolved.promptsDir})`,
            "info",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          ctx.ui.notify(`dot-prompts init failed: ${message}`, "error");
        }
        return;
      }

      if (subcommand !== "history") {
        ctx.ui.notify(`Unknown subcommand "${subcommand}". ${USAGE}`, "error");
        return;
      }

      if (!filePath) {
        ctx.ui.notify(USAGE, "error");
        return;
      }

      try {
        pi.sendUserMessage(historyPrompt(filePath));
      } catch {
        pi.sendUserMessage(historyPrompt(filePath), {
          deliverAs: "followUp",
        });
      }
    },
  });
}

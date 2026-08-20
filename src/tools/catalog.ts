export type ToolParamType = "string" | "number";

export type ToolParam = {
  name: string;
  type: ToolParamType;
  required?: boolean;
  description: string;
};

export type ToolSpec = {
  name: string;
  title: string;
  description: string;
  guidelines: string[];
  params: readonly ToolParam[];
};

export const TOOL_CATALOG = {
  prompts_read: {
    name: "prompts_read",
    title: "dot-prompts read",
    description:
      "Fetch dot-prompts provenance (prior user prompts) for a file or region. Use when [dot-prompts] notices indicate relevant history, or when editing code that may have intentional complexity.",
    guidelines: [
      "Use prompts_read when a read result includes a [dot-prompts] notice and prior intent may affect your edit.",
      "Skip prompts_read when doing a ground-up rewrite or when the notice is clearly irrelevant.",
      "If a prompt is vague (e.g. execute plan) and prompts_trace is available, use it with the record id to explore session context.",
      "If a record references prior records or links may be stale after renames, use prompts_chain with the record id.",
    ],
    params: [
      {
        name: "path",
        type: "string",
        required: true,
        description: "File path to look up",
      },
      {
        name: "startLine",
        type: "number",
        description: "Start line of region (1-indexed)",
      },
      {
        name: "endLine",
        type: "number",
        description: "End line of region (1-indexed)",
      },
      {
        name: "symbol",
        type: "string",
        description: "Symbol name to match",
      },
      {
        name: "limit",
        type: "number",
        description: "Maximum records to return (default 5)",
      },
    ],
  },
  prompts_chain: {
    name: "prompts_chain",
    title: "dot-prompts chain",
    description:
      "Walk the provenance chain from a record id through metadata.referencedRecords — recovers intent across renames and broken symbol/file links. Traverses the full chain by default; pass maxDepth or maxRecords only to stop early.",
    guidelines: [
      "Use prompts_chain when prompts_read shows referencedRecords, symbol/file links may be stale, or you need the full stacked intent behind an edit.",
      "Start from the newest matching record id; ancestors are followed automatically via referencedRecords.",
      "Omit maxDepth and maxRecords unless you want to stop early — the default walks the entire chain.",
      "For vague prompts in the chain, use prompts_trace on that specific record id when the tool is available.",
    ],
    params: [
      {
        name: "recordId",
        type: "string",
        required: true,
        description:
          "Starting record UUID (typically the newest match from prompts_read)",
      },
      {
        name: "maxDepth",
        type: "number",
        description:
          "Optional cap on hops from the start record. Omit to walk as deep as the chain goes.",
      },
      {
        name: "maxRecords",
        type: "number",
        description: "Optional cap on total records returned. Omit for no limit.",
      },
    ],
  },
  prompts_trace: {
    name: "prompts_trace",
    title: "dot-prompts trace",
    description:
      "Explore the harness session that produced a dot-prompts record. Use when the stored prompt is vague. Falls back to stored prompt text if the session file is missing locally.",
    guidelines: [
      "Use prompts_trace when prompts_read returns a vague prompt like execute plan or continue and a record id is available.",
      "prompts_trace may fall back to prompt text only if the harness session file is missing on this machine.",
    ],
    params: [
      {
        name: "recordId",
        type: "string",
        description:
          "dot-prompts record UUID (loads session pointers from metadata[harness])",
      },
      {
        name: "sessionFile",
        type: "string",
        description: "Harness session file path",
      },
      {
        name: "userMessageId",
        type: "string",
        description: "Session entry id for the user message",
      },
      {
        name: "maxEntries",
        type: "number",
        description: "Maximum branch entries to include",
      },
    ],
  },
} as const satisfies Record<string, ToolSpec>;

export type ToolName = keyof typeof TOOL_CATALOG;

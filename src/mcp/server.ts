import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  handlePromptsChain,
  handlePromptsRead,
  handlePromptsTrace,
} from "../tools/handlers.js";

export type McpServerOptions = {
  promptsDir?: string;
};

export function resolvePromptsDirFromEnv(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const flagIndex = argv.findIndex(
    (arg) => arg === "--prompts-dir" || arg === "--promptsDir",
  );
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1];
  }

  const eqFlag = argv.find((arg) => arg.startsWith("--prompts-dir="));
  if (eqFlag) {
    return eqFlag.slice("--prompts-dir=".length);
  }

  if (env.DOT_PROMPTS_DIR) {
    return env.DOT_PROMPTS_DIR;
  }

  return undefined;
}

function toolResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Create the dot-prompts MCP server (tools only — no auto-record).
 * `.prompts/` is resolved relative to process.cwd() unless promptsDir is set.
 */
export function createDotPromptsMcpServer(
  opts: McpServerOptions = {},
): McpServer {
  const promptsDir =
    opts.promptsDir ??
    resolvePromptsDirFromEnv() ??
    join(process.cwd(), ".prompts");

  const server = new McpServer({
    name: "dot-prompts",
    version: "0.1.0",
  });

  server.registerTool(
    "prompts_read",
    {
      title: "dot-prompts read",
      description:
        "Fetch dot-prompts provenance (prior user prompts) for a file or region. Use when [dot-prompts] notices indicate relevant history, or when editing code that may have intentional complexity.",
      inputSchema: {
        path: z.string().describe("File path to look up"),
        startLine: z
          .number()
          .optional()
          .describe("Start line of region (1-indexed)"),
        endLine: z
          .number()
          .optional()
          .describe("End line of region (1-indexed)"),
        symbol: z.string().optional().describe("Symbol name to match"),
        limit: z
          .number()
          .optional()
          .describe("Maximum records to return (default 5)"),
      },
    },
    async (args) => {
      const result = handlePromptsRead(args, { promptsDir });
      return toolResult(result.text);
    },
  );

  server.registerTool(
    "prompts_chain",
    {
      title: "dot-prompts chain",
      description:
        "Walk the provenance chain from a record id through metadata.referencedRecords — recovers intent across renames and broken symbol/file links. Traverses the full chain by default; pass maxDepth or maxRecords only to stop early.",
      inputSchema: {
        recordId: z
          .string()
          .describe(
            "Starting record UUID (typically the newest match from prompts_read)",
          ),
        maxDepth: z
          .number()
          .optional()
          .describe(
            "Optional cap on hops from the start record. Omit to walk as deep as the chain goes.",
          ),
        maxRecords: z
          .number()
          .optional()
          .describe("Optional cap on total records returned. Omit for no limit."),
      },
    },
    async (args) => {
      const result = handlePromptsChain(args, { promptsDir });
      return toolResult(result.text);
    },
  );

  server.registerTool(
    "prompts_trace",
    {
      title: "dot-prompts trace",
      description:
        "Explore the pi session branch that produced a dot-prompts record. Use when the stored prompt is vague. Falls back to record-only prompt text if the session file is not available locally.",
      inputSchema: {
        recordId: z
          .string()
          .optional()
          .describe(
            "dot-prompts record UUID (loads pi session pointers from metadata)",
          ),
        sessionFile: z
          .string()
          .optional()
          .describe("Pi session JSONL file path"),
        userMessageId: z
          .string()
          .optional()
          .describe("Pi session user message entry id"),
        maxEntries: z
          .number()
          .optional()
          .describe("Maximum branch entries to include"),
      },
    },
    async (args) => {
      const result = handlePromptsTrace(args, { promptsDir });
      return toolResult(result.text);
    },
  );

  return server;
}

export async function startDotPromptsMcpServer(
  opts: McpServerOptions = {},
): Promise<McpServer> {
  const server = createDotPromptsMcpServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

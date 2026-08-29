import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { packageRoot } from "../core/package-root.js";
import { resolvePromptsDir } from "../core/prompts-dir.js";
import { resolvePromptsDirFromCli } from "../core/config.js";
import { TOOL_CATALOG, type ToolParam } from "../tools/catalog.js";
import {
  handlePromptsChain,
  handlePromptsRead,
} from "../tools/handlers.js";
import type {
  PromptsChainParams,
  PromptsReadParams,
} from "../tools/handlers.js";

export type McpServerOptions = {
  /** Explicit store override. When omitted, each tool resolves via walk-up. */
  promptsDir?: string;
};

/** Portable MCP tools. Session-file trace stays on the pi export and extension. */
export const MCP_TOOLS = ["prompts_read", "prompts_chain"] as const;

export { resolvePromptsDirFromCli };

function packageVersion(): string {
  const pkg = JSON.parse(
    readFileSync(join(packageRoot(), "package.json"), "utf8"),
  ) as { version: string };
  return pkg.version;
}

function zodShapeFromParams(params: readonly ToolParam[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const param of params) {
    const base = param.type === "string" ? z.string() : z.number();
    const described = base.describe(param.description);
    shape[param.name] = param.required ? described : described.optional();
  }
  return shape;
}

function toolResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Create the dot-prompts MCP server (tools only — no auto-record).
 * Without `promptsDir`, `prompts_read` walks up from the query path and
 * `prompts_chain` walks up from process.cwd().
 */
export function createDotPromptsMcpServer(
  opts: McpServerOptions = {},
): McpServer {
  const promptsDir =
    opts.promptsDir !== undefined
      ? resolvePromptsDir(opts.promptsDir)
      : undefined;

  const server = new McpServer({
    name: "dot-prompts",
    version: packageVersion(),
  });

  const read = TOOL_CATALOG.prompts_read;
  server.registerTool(
    read.name,
    {
      title: read.title,
      description: read.description,
      inputSchema: zodShapeFromParams(read.params),
    },
    async (args) => {
      const params = args as PromptsReadParams;
      const result = handlePromptsRead(params, {
        ...(promptsDir !== undefined
          ? { promptsDir }
          : { filePath: params.path }),
      });
      return toolResult(result.text);
    },
  );

  const chain = TOOL_CATALOG.prompts_chain;
  server.registerTool(
    chain.name,
    {
      title: chain.title,
      description: chain.description,
      inputSchema: zodShapeFromParams(chain.params),
    },
    async (args) => {
      const result = handlePromptsChain(args as PromptsChainParams, {
        ...(promptsDir !== undefined ? { promptsDir } : {}),
      });
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

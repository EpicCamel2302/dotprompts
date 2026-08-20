import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { packageRoot } from "../core/package-root.js";
import {
  resolvePromptsDir,
  resolvePromptsDirFromEnv,
} from "../core/prompts-dir.js";
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
  promptsDir?: string;
};

/** Portable MCP tools. Session-file trace stays on the pi export and extension. */
export const MCP_TOOLS = ["prompts_read", "prompts_chain"] as const;

export { resolvePromptsDirFromEnv };

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
 * `.prompts/` is resolved relative to process.cwd() unless promptsDir is set.
 */
export function createDotPromptsMcpServer(
  opts: McpServerOptions = {},
): McpServer {
  const promptsDir = opts.promptsDir
    ? resolvePromptsDir(opts.promptsDir)
    : resolvePromptsDirFromEnv();

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
      const result = handlePromptsRead(args as PromptsReadParams, { promptsDir });
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
      const result = handlePromptsChain(args as PromptsChainParams, { promptsDir });
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

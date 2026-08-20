import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { record } from "../src/core/record.js";
import { isMissingMcpPeer, MCP_PEER_HINT } from "../src/mcp/peers.js";
import {
  createDotPromptsMcpServer,
  MCP_TOOLS,
} from "../src/mcp/server.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type RegisteredTool = {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text?: string }>;
  }>;
  inputSchema?: {
    shape?: Record<string, { type?: string }>;
  };
};

function registeredTools(server: object): Record<string, RegisteredTool> {
  return (
    (server as { _registeredTools?: Record<string, RegisteredTool> })
      ._registeredTools ?? {}
  );
}

describe("MCP server", () => {
  let promptsDir: string;

  beforeEach(() => {
    promptsDir = mkdtempSync(join(tmpdir(), "dot-prompts-mcp-"));
  });

  afterEach(() => {
    rmSync(promptsDir, { recursive: true, force: true });
  });

  it("registers prompts_read and prompts_chain only", () => {
    const server = createDotPromptsMcpServer({
      promptsDir: "/tmp/unused-dot-prompts",
    });
    expect(MCP_TOOLS).toEqual(["prompts_read", "prompts_chain"]);
    expect(Object.keys(registeredTools(server)).sort()).toEqual(
      [...MCP_TOOLS].sort(),
    );
  });

  it("does not import pi", () => {
    const src = readFileSync(resolve(repoRoot, "src/mcp/server.ts"), "utf8");
    expect(src).not.toMatch(/from ["'][^"']*pi/);
    expect(src).not.toContain("handlePromptsTrace");
    expect(src).not.toContain("prompts_trace");
  });

  it("executes prompts_read and prompts_chain through registered handlers", async () => {
    const a = record(
      {
        model: "test",
        prompt: "Add retry",
        targets: [
          {
            path: "fetch.ts",
            links: [
              { type: "file" },
              { type: "symbol", name: "fetchWithRetry", kind: "function" },
            ],
          },
        ],
      },
      { promptsDir },
    );
    record(
      {
        model: "test",
        prompt: "Rename helper",
        targets: [{ path: "fetch.ts", links: [{ type: "file" }] }],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    const server = createDotPromptsMcpServer({ promptsDir });
    const tools = registeredTools(server);

    const readResult = await tools.prompts_read!.handler({
      path: "fetch.ts",
      symbol: "fetchWithRetry",
    });
    expect(readResult.content[0]?.text).toContain("Add retry");

    const chainResult = await tools.prompts_chain!.handler({
      recordId: a.id,
    });
    expect(chainResult.content[0]?.text).toContain("Add retry");
  });

  it("marks required catalog params as required in Zod schemas", () => {
    const server = createDotPromptsMcpServer({ promptsDir });
    const shape = registeredTools(server).prompts_read!.inputSchema?.shape;
    expect(shape?.path?.type).toBe("string");
    expect(shape?.startLine?.type).toBe("optional");
    expect(shape?.symbol?.type).toBe("optional");
  });
});

describe("MCP optional peers", () => {
  it("detects missing SDK or Zod and explains how to install them", () => {
    const missingSdk = Object.assign(
      new Error("Cannot find package '@modelcontextprotocol/sdk'"),
      { code: "ERR_MODULE_NOT_FOUND" },
    );
    const missingZod = Object.assign(new Error("Cannot find package 'zod'"), {
      code: "MODULE_NOT_FOUND",
    });
    const other = Object.assign(new Error("Cannot find package 'commander'"), {
      code: "ERR_MODULE_NOT_FOUND",
    });

    expect(isMissingMcpPeer(missingSdk)).toBe(true);
    expect(isMissingMcpPeer(missingZod)).toBe(true);
    expect(isMissingMcpPeer(other)).toBe(false);
    expect(MCP_PEER_HINT).toContain(
      "npm install @modelcontextprotocol/sdk zod",
    );
  });
});

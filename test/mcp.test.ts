import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isMissingMcpPeer, MCP_PEER_HINT } from "../src/mcp/peers.js";
import {
  createDotPromptsMcpServer,
  MCP_TOOLS,
} from "../src/mcp/server.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function registeredToolNames(server: object): string[] {
  const tools = (
    server as { _registeredTools?: Record<string, unknown> }
  )._registeredTools;
  return tools ? Object.keys(tools) : [];
}

describe("MCP server", () => {
  it("registers prompts_read and prompts_chain only", () => {
    const server = createDotPromptsMcpServer({
      promptsDir: "/tmp/unused-dot-prompts",
    });
    expect(MCP_TOOLS).toEqual(["prompts_read", "prompts_chain"]);
    expect(registeredToolNames(server).sort()).toEqual(
      [...MCP_TOOLS].sort(),
    );
  });

  it("does not import pi", () => {
    const src = readFileSync(resolve(repoRoot, "src/mcp/server.ts"), "utf8");
    expect(src).not.toMatch(/from ["'][^"']*pi/);
    expect(src).not.toContain("handlePromptsTrace");
    expect(src).not.toContain("prompts_trace");
  });
});

describe("MCP optional peers", () => {
  it("detects missing SDK or Zod and explains how to install them", () => {
    const missingSdk = Object.assign(new Error("Cannot find package '@modelcontextprotocol/sdk'"), {
      code: "ERR_MODULE_NOT_FOUND",
    });
    const missingZod = Object.assign(new Error("Cannot find package 'zod'"), {
      code: "MODULE_NOT_FOUND",
    });
    const other = Object.assign(new Error("Cannot find package 'commander'"), {
      code: "ERR_MODULE_NOT_FOUND",
    });

    expect(isMissingMcpPeer(missingSdk)).toBe(true);
    expect(isMissingMcpPeer(missingZod)).toBe(true);
    expect(isMissingMcpPeer(other)).toBe(false);
    expect(MCP_PEER_HINT).toContain("npm install @modelcontextprotocol/sdk zod");
  });
});

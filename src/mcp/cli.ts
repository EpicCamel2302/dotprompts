#!/usr/bin/env node

import { isMissingMcpPeer, MCP_PEER_HINT } from "./peers.js";

async function main(): Promise<void> {
  const { resolvePromptsDirFromCli, startDotPromptsMcpServer } = await import(
    "./server.js"
  );
  const promptsDir = resolvePromptsDirFromCli();
  // Only freeze an explicit --prompts-dir; otherwise tools walk up per call.
  const argv = process.argv.slice(2);
  const hasExplicit =
    argv.includes("--prompts-dir") ||
    argv.includes("--promptsDir") ||
    argv.some((arg) => arg.startsWith("--prompts-dir="));

  await startDotPromptsMcpServer(
    hasExplicit ? { promptsDir } : {},
  );
}

main().catch((error) => {
  if (isMissingMcpPeer(error)) {
    process.stderr.write(`${MCP_PEER_HINT}\n`);
    process.exit(1);
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`dot-prompts-mcp failed: ${message}\n`);
  process.exit(1);
});

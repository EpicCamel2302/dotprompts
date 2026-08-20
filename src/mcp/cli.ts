#!/usr/bin/env node

import { isMissingMcpPeer, MCP_PEER_HINT } from "./peers.js";

async function main(): Promise<void> {
  const { resolvePromptsDirFromEnv, startDotPromptsMcpServer } = await import(
    "./server.js"
  );
  await startDotPromptsMcpServer({
    promptsDir: resolvePromptsDirFromEnv(),
  });
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

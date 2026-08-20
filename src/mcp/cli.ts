#!/usr/bin/env node

import {
  resolvePromptsDirFromEnv,
  startDotPromptsMcpServer,
} from "./server.js";

async function main(): Promise<void> {
  const promptsDir = resolvePromptsDirFromEnv();
  await startDotPromptsMcpServer(
    promptsDir !== undefined ? { promptsDir } : {},
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`dot-prompts-mcp failed: ${message}\n`);
  process.exit(1);
});

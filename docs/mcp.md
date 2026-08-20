# MCP server

Opt-in provenance tools for any MCP-capable harness (Claude Code, Cursor, custom agents). Same behavior as the pi tools; recording and read notices stay harness-specific.

Source: [`src/mcp/`](../src/mcp/), handlers: [`src/tools/handlers.ts`](../src/tools/handlers.ts)

## Setup

```bash
cd /path/to/dot-prompts
npm install && npm run build
```

Binaries after build:

- `dot-prompts-mcp` → `dist/mcp/cli.js`
- `npm run mcp` → same entrypoint

### Local (unpublished)

Point the client at the built CLI and set `cwd` to the project that owns `.prompts/`:

```json
{
  "mcpServers": {
    "dot-prompts": {
      "command": "node",
      "args": ["/absolute/path/to/dot-prompts/dist/mcp/cli.js"],
      "cwd": "/absolute/path/to/your-project"
    }
  }
}
```

### After publish

```json
{
  "mcpServers": {
    "dot-prompts": {
      "command": "npx",
      "args": ["-y", "dot-prompts-mcp"],
      "cwd": "/absolute/path/to/your-project"
    }
  }
}
```

### Claude Code

Add the same block under MCP settings (user or project `.mcp.json` / Claude Code MCP config). Ensure the process `cwd` is the repo root so `.prompts/` resolves correctly.

### Cursor

Cursor → MCP settings → add a stdio server with the `command` / `args` / `cwd` above.

## Tools

| Tool | Purpose |
|---|---|
| `prompts_read` | Ranked prior prompts for a path / region / symbol |
| `prompts_chain` | Walk `metadata.referencedRecords` from a record id (full depth by default) |
| `prompts_trace` | Pi session branch for a record; falls back to stored prompt text if the session file is missing |

No write/record tools — harnesses record edits themselves (pi extension, future Claude Code hooks, etc.).

### Parameters

**`prompts_read`:** `path` (required), `startLine?`, `endLine?`, `symbol?`, `limit?` (default 5)

**`prompts_chain`:** `recordId` (required), `maxDepth?`, `maxRecords?`

**`prompts_trace`:** `recordId?`, `sessionFile?`, `userMessageId?`, `maxEntries?`

## Resolving `.prompts/`

Default: `<process.cwd()>/.prompts`

Overrides (useful for tests/CI):

| Source | Example |
|---|---|
| `--prompts-dir` | `node dist/mcp/cli.js --prompts-dir /tmp/proj/.prompts` |
| `DOT_PROMPTS_DIR` | `DOT_PROMPTS_DIR=/tmp/proj/.prompts npm run mcp` |

Harnesses should spawn the server with `cwd` set to the project root whenever possible.

## CLI fallback

If MCP is disabled, agents can use the same core via CLI:

```bash
dot-prompts lookup --path src/foo.ts
dot-prompts chain <record-id> --format text
dot-prompts get <record-id>
```

See [CLI reference](cli.md). Skills/slash commands can instruct agents to prefer MCP tools when present, otherwise the CLI.

## What MCP does not do

- Auto-record after Edit/Write
- Append `[dot-prompts]` notices on Read
- Cross-process `referencedRecords` tracking for the next edit

Those require harness hooks or an in-process extension (see [pi extension](pi-extension.md) and [harness integration](harness-integration.md)).

## Agent workflow

Same as [AGENTS.md](../AGENTS.md): notice (if the harness provides one) → `prompts_read` → `prompts_chain` when links may be stale → `prompts_trace` only for vague prompts.

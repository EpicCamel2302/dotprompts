# MCP

Opt-in provenance tools for MCP clients (Cursor, Claude Code, and others). Recording after edits and `[dot-prompts]` notices on read come from the harness. MCP serves the portable tools: `prompts_read` and `prompts_chain`.

`prompts_trace` is session drill-down. MCP does not register it; the current loader is `dot-prompts/pi` and the [pi extension](pi.md).

The MCP SDK and Zod are optional peers. Install them when you want the server:

```bash
npm install @modelcontextprotocol/sdk zod
```

In this repository they are already in `devDependencies`, so `npm install && npm run build` is enough to run the server locally.

```bash
cd /path/to/dot-prompts
npm install && npm run build
```

- `dot-prompts-mcp` → `dist/mcp/cli.js`
- `npm run mcp` → same entrypoint

Missing peers fail the CLI with an install hint instead of a raw module-not-found stack.

## Client config

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

After publish:

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

Claude Code: same block under MCP settings (user or project). Cursor: MCP settings → stdio server with `command` / `args` / `cwd` as above.

## Tools

| Tool | Purpose |
|---|---|
| `prompts_read` | Ranked prior prompts for a path, region, or symbol |
| `prompts_chain` | Walk `metadata.referencedRecords` from a record id |

**`prompts_read`:** `path` (required), `startLine?`, `endLine?`, `symbol?`, `limit?` (default 5)

**`prompts_chain`:** `recordId` (required), `maxDepth?`, `maxRecords?`

Session-file drill-down (`prompts_trace`) is not an MCP tool today; see [Pi](pi.md).

## Resolving `.prompts/`

Default: `<process.cwd()>/.prompts`

| Source | Example |
|---|---|
| `--prompts-dir` | `node dist/mcp/cli.js --prompts-dir /tmp/proj/.prompts` |
| `DOT_PROMPTS_DIR` | `DOT_PROMPTS_DIR=/tmp/proj/.prompts npm run mcp` |

Spawn the server with `cwd` set to the project root whenever possible.

## CLI

The same data is available from the [CLI](cli.md):

```bash
dot-prompts lookup --path src/foo.ts
dot-prompts chain <record-id> --format text
dot-prompts get <record-id>
```

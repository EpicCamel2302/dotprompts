# AGENTS.md — developing dot-prompts

Instructions for coding agents working **in this repository** (the library, CLI, MCP server, and pi extension).

Humans: [docs/usage](docs/usage/README.md) to install and run; [docs/development](docs/development/README.md) to extend the code. History: [CHANGELOG.md](CHANGELOG.md).

Agents in consuming projects get provenance through MCP or the pi tools. Do not add consumer-agent workflow docs to this tree.

## What this repo is

`.prompts/` is a provenance log: **why** prior AI edits were made (user prompt, model, location). Git stores the code. This package writes, indexes, and serves those records.

## Layout

| Path | Role |
|---|---|
| `src/core/` | Types, `Storage` port + JSONL, config/`findStore`, record, query, validate, `promptsDir` |
| `src/links/` | Extraction and notice formatting |
| `src/provenance/` | `referencedRecords` chain |
| `src/tools/` | `TOOL_CATALOG`, `handlePromptsRead`, `handlePromptsChain` |
| `src/mcp/` | MCP adapter (`dot-prompts/mcp`) |
| `src/pi/` | Pi trace (`dot-prompts/pi`) |
| `src/cli.ts` | CLI |
| `extensions/pi/` | Pi harness |
| `schemas/` | JSON Schema for records, links, and config |

Details: [docs/development/architecture.md](docs/development/architecture.md). Harness contract: [docs/development/harness.md](docs/development/harness.md).

## Conventions

- **Tool params and copy** live in `src/tools/catalog.ts`. Adapters choose which names to register. MCP adapts `prompts_read` / `prompts_chain` to Zod; pi adapts those plus `prompts_trace` to TypeBox. Do not duplicate descriptions in adapters.
- **MCP** must not import `src/pi`. `@modelcontextprotocol/sdk` and `zod` are optional peers; they belong in `devDependencies` here so this repo can still build and test the adapter.
- **Records** validate with Ajv against `schemas/`. That is the on-disk contract. **Project config** validates against `schemas/config.v1.json`.
- **Storage** goes through `Storage` (`append` / `list` / `getById`). JSONL is the implementation.
- **Store path** goes through `findStore` (walk-up from `filePath` / cwd to `dotprompts.json` or `.prompts/config.json`). Overrides: `--prompts-dir` or `{ promptsDir }` / `{ storage }`.
- **Session pointers** sit at `metadata[metadata.harness]`. Portable formatting must not import `src/pi`.
- **One npm package.** Subpath exports (`dot-prompts`, `dot-prompts/mcp`, `dot-prompts/pi`) are the boundary. Do not add workspaces, a harness plugin registry, or a second storage backend unless the user asks.
- **Tests:** core in `test/`; pi extension in `extensions/pi/test/`.

When user-facing behavior changes, update [docs/usage](docs/usage/README.md). When internals or the library API change, update [docs/development](docs/development/README.md) and prefer Conventional Commit messages (`feat:`, `fix:`, …) so [release-please](docs/development/releasing.md) can cut the next version. Versioned changelog sections are owned by release-please; see [CHANGELOG.md](CHANGELOG.md) for history.

## Commands

```bash
npm test
npm run build
```

Pi extension: `npm run build:pi` (needs a successful core build).

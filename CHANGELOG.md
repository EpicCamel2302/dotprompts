# Changelog

## Unreleased

- Project config (`dotprompts.json` or `.prompts/config.json`) with schema `config.v1.json` (`storage.driver`, optional `storage.path`).
- Store resolution walks up from the edited/read file path (else cwd) via `findStore`; CLI `--prompts-dir` and API `{ promptsDir }` / `{ storage }` override discovery.
- Removed `DOT_PROMPTS_DIR` and `resolvePromptsDirFromEnv` (use `--prompts-dir` / `resolvePromptsDirFromCli` / `findStore`).
- Links no longer carry `path`; file path lives only on `target.path` (schema forbids `path` on links). Lookup matches the target first, then scores link types.
- release-please on `main` for version bumps, `CHANGELOG.md`, and GitHub Releases ([docs/development/releasing.md](docs/development/releasing.md)).

## 0.2.0

- Layered `src/` into `core`, `links`, `provenance`, `tools`, `mcp`, and `pi`, with exports `dot-prompts`, `dot-prompts/mcp`, and `dot-prompts/pi`.
- Shared `TOOL_CATALOG` and handlers; MCP registers `prompts_read` and `prompts_chain` only. `prompts_trace` stays in the catalog as session drill-down; the current loader is `dot-prompts/pi` and the pi extension.
- `@modelcontextprotocol/sdk` and `zod` are optional peer dependencies. The MCP CLI fails with an install hint when they are missing.
- `Storage` port with a JSONL implementation; unified `.prompts` resolution (`--prompts-dir`, `DOT_PROMPTS_DIR`, `<cwd>/.prompts`).
- `extractLinksFromEdit` / `extractLinksFromWrite` record `file`, `region`, `git`, and `symbol` links. `hashline` remains a lookup link type and CLI annotate helper.
- Documentation split: [docs/usage](docs/usage/README.md), [docs/development](docs/development/README.md), [AGENTS.md](AGENTS.md) for agents working in this repo.
- Pi extension tests live in `extensions/pi/test/`; core tests stay in `test/`.

## 0.1.0

- Provenance log (`.prompts/history.jsonl` and `records/`), CLI, and library API.
- Pi extension: auto-record, read notices, `prompts_read` / `prompts_chain` / `prompts_trace`.
- MCP server for the same tools.

# Changelog

## [0.3.1](https://github.com/EpicCamel2302/dotprompts/compare/v0.3.0...v0.3.1) (2026-08-24)


### Bug Fixes

* merge generation-buffer links across same-path edits ([#32](https://github.com/EpicCamel2302/dotprompts/issues/32)) ([975ff69](https://github.com/EpicCamel2302/dotprompts/commit/975ff69d26c85f0ec94597d6aa284cddf624c3b0))

## [0.3.0](https://github.com/EpicCamel2302/dotprompts/compare/v0.2.0...v0.3.0) (2026-08-20)


### Features

* coalesce edits into one record per user generation ([#27](https://github.com/EpicCamel2302/dotprompts/issues/27)) ([82071b2](https://github.com/EpicCamel2302/dotprompts/commit/82071b24476e6ba24e90dcc668f20228d81e26f4))

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

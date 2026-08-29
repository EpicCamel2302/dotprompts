# AGENTS.md — developing dot-prompts

Instructions for coding agents working **in this repository** (npm workspaces: core library, MCP, pi package, conformance, harness stubs).

Humans: [docs/usage](docs/usage/README.md) to install and run; [docs/development](docs/development/README.md) to extend the code. History: package changelogs under `packages/*/CHANGELOG.md` (root [CHANGELOG.md](CHANGELOG.md) holds pre-monorepo history).

Agents in consuming projects get provenance through MCP or the pi tools. Do not add consumer-agent workflow docs to this tree.

## What this repo is

`.prompts/` is a provenance log: **why** prior AI edits were made (user prompt, model, location). Git stores the code. This monorepo writes, indexes, and serves those records, plus harness adapters.

## Layout

| Path | Role |
|---|---|
| `packages/core/` | Publishable `dot-prompts` — types, storage, record/query, links, tools, MCP (`dot-prompts/mcp`), CLI, schemas |
| `packages/pi/` | Publishable `@dot-prompts/pi` — pi harness (`extensions/dot-prompts.ts` + `lib/` helpers) + session-trace library |
| `packages/conformance/` | Publishable `@dot-prompts/conformance` — harness-agnostic assert helpers |
| `packages/cursor/` | Private stub for Cursor adapter |
| `packages/claude-code/` | Private stub for Claude Code adapter |

Details: [docs/development/architecture.md](docs/development/architecture.md). Harness contract: [docs/development/harness.md](docs/development/harness.md).

## Conventions

- **Tool params and copy** live in `packages/core/src/tools/catalog.ts`. Adapters choose which names to register. MCP adapts `prompts_read` / `prompts_chain` to Zod; pi adapts those plus `prompts_trace` to TypeBox. Do not duplicate descriptions in adapters.
- **MCP** (`packages/core/src/mcp`) must not import `@dot-prompts/pi`. `@modelcontextprotocol/sdk` and `zod` are optional peers of `dot-prompts`.
- **Session-trace** lives only in `@dot-prompts/pi`. Cursor / Claude / MCP must not depend on that package. Future harness drill-down belongs in that harness’s package.
- **Records** validate with Ajv against `packages/core/schemas/`. **Project config** validates against `config.v1.json` there.
- **Storage** goes through `Storage` (`append` / `list` / `getById`). JSONL is the implementation.
- **Store path** goes through `findStore` (walk-up from `filePath` / cwd to `dotprompts.json` or `.prompts/config.json`). Overrides: `--prompts-dir` or `{ promptsDir }` / `{ storage }`.
- **Session pointers** sit at `metadata[metadata.harness]`. Portable formatting must not import harness packages.
- **Workspaces:** publishable packages are `dot-prompts`, `@dot-prompts/pi`, `@dot-prompts/conformance`. Do not add a harness plugin registry or a second storage backend unless the user asks.
- **Dependency direction:** adapters → core (and conformance for tests); core ↛ adapters; adapters ↛ each other.
- **Tests:** `packages/core/test/`, `packages/pi/test/`, `packages/conformance/test/` (root vitest).

When user-facing behavior changes, update [docs/usage](docs/usage/README.md). When internals or the library API change, update [docs/development](docs/development/README.md). Versioned changelog sections are owned by release-please per package; see [releasing](docs/development/releasing.md).

## Pull requests and commits

release-please versions from **Conventional Commit** messages that land on `main`. Prefer **squash merge** so the PR title becomes that commit.

- **PR title** must match Conventional Commits, e.g. `feat: …`, `fix: …`, `ci: …`, `docs: …`.
- Prefer **squash merge** so the PR title becomes that commit. CI fails non-conventional titles.
- Use `feat!:` / `fix!:` (or a `BREAKING CHANGE:` footer) for breaking changes.
- `feat` / `fix` / breaking drive a Release PR; `docs` / `chore` / `test` / `ci` usually do not.
- Do **not** use vague titles (`Update stuff`) or rely on GitHub’s default `Merge pull request #N` message.

Examples: `feat: walk up from file path to resolve .prompts store`, `fix: silence git stderr in non-git fixtures`.

## Commands

```bash
npm test
npm run build
```

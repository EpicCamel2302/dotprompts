# dot-prompts

Provenance for LLM-generated code edits. Git stores *what* changed. This package records *why*, next to the repo, in an append-only `.prompts/` log.

## Why this exists

When an agent edits code, the reason usually lives only in the chat: a product constraint, an API quirk, a deliberate workaround. That context disappears when the session ends, or when someone else opens the file later. Without it, the next agent (or human) often "simplifies" careful code and quietly undoes the constraint.

dot-prompts links user prompts to the file locations they shaped, so later work can recover intent.

## What this package is

The publishable core library and CLIs:

- **Library** (`dot-prompts`): record, lookup, store discovery, shared tool handlers
- **CLI** (`dot-prompts`): `record`, `lookup`, `list`, `get`, `chain`, …
- **MCP** (`dot-prompts/mcp` / `dot-prompts-mcp`): `prompts_read` and `prompts_chain` for MCP clients

Harness adapters (automatic capture, read notices) live in separate packages. For [pi](https://github.com/earendil-works/pi), use [`@dot-prompts/pi`](https://www.npmjs.com/package/@dot-prompts/pi).

## What this is for

- Keeping intent with the code (commit `.prompts/` if you want that)
- Letting agents fetch prior prompts on demand instead of stuffing history into every turn
- Wiring the same store from CLI, library callers, or MCP

This is not a chat memory or preference store. It only ties *code locations* to the *user prompts* that shaped them.

## Usage

```bash
npm install dot-prompts
```

For MCP, also install the optional peers:

```bash
npm install @modelcontextprotocol/sdk zod
```

### CLI

```bash
echo '{ "model": "…", "prompt": "…", "targets": […] }' | npx dot-prompts record
npx dot-prompts lookup --path src/foo.ts
npx dot-prompts list --path src/foo.ts
```

Global option: `--prompts-dir <path>` skips store discovery. Full command list: [CLI docs](https://github.com/EpicCamel2302/dotprompts/blob/main/docs/usage/cli.md).

### Library

```ts
import { record, lookup } from "dot-prompts";

record(
  {
    model: "provider/model",
    prompt: "keep retries at 3",
    targets: [{ path: "src/api/fetch.ts", links: [{ type: "file" }] }],
  },
  { filePath: "src/api/fetch.ts", cwd: process.cwd() },
);

const result = lookup(
  { path: "src/api/fetch.ts" },
  { filePath: "src/api/fetch.ts", cwd: process.cwd() },
);
```

### MCP

```bash
npx dot-prompts-mcp
```

Point your client at that command (or the installed bin) with `cwd` set to the project that owns the store. Details: [MCP docs](https://github.com/EpicCamel2302/dotprompts/blob/main/docs/usage/mcp.md).

### Store location

Walk-up from the edited or read file: prefer `dotprompts.json` or `.prompts/config.json`, else `<gitRoot>/.prompts`, else `<cwd>/.prompts`. Pass `{ promptsDir }` or `--prompts-dir` to pin a store.

## Read more

| Topic | Link |
|---|---|
| Overview | [docs/usage/overview.md](https://github.com/EpicCamel2302/dotprompts/blob/main/docs/usage/overview.md) |
| CLI | [docs/usage/cli.md](https://github.com/EpicCamel2302/dotprompts/blob/main/docs/usage/cli.md) |
| MCP | [docs/usage/mcp.md](https://github.com/EpicCamel2302/dotprompts/blob/main/docs/usage/mcp.md) |
| Pi adapter | [@dot-prompts/pi](https://www.npmjs.com/package/@dot-prompts/pi) |
| Source | [github.com/EpicCamel2302/dotprompts](https://github.com/EpicCamel2302/dotprompts) |

## License

MIT

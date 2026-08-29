# @dot-prompts/pi

dot-prompts keeps a small log of *why* AI edits were made, next to your repo. This package wires that into [pi](https://github.com/earendil-works/pi) so provenance is recorded and surfaced automatically while you work.

## Why this exists

When an agent changes code, the reason usually lives only in the chat: a product constraint, an API quirk, a deliberate workaround. That context disappears when the session ends, or when someone else opens the file later. Git still has the diff. What it does not have is intent.

Without that intent, the next agent (or human) often "simplifies" careful code and quietly undoes the constraint. dot-prompts stores the user prompt and where it landed in an append-only `.prompts/` log, so later work can recover *why* the code looks the way it does.

## What this does

Once installed, the extension:

- **Records** one entry per user turn when pi successfully edits or writes files (several edits in the same turn become a single record).
- **Notifies** the agent on file read when matching history exists, with a short hint to fetch details if relevant.
- **Registers tools** (`prompts_read`, `prompts_chain`, `prompts_trace`) so the agent can opt into full prompt text and related history.
- **Adds slash commands** (`/prompts history <file>`, `/prompts init`) for summarizing intent and initializing a store outside git.

Records live in the project (under `.prompts/` by default). In a **git repo**, the store is created automatically on first record. Outside git, run `/prompts init` (or `dot-prompts init`) once so recording does not scatter `.prompts` into casual working directories. Commit `.prompts/` if you want intent to travel with the code.

## What this doesn't do

This is **not** a memory extension. It does not keep a rolling summary of the chat, remember preferences across projects, or inject long history into every turn. It only links *code locations* to the *user prompts* that shaped them.

This is also **not** an MCP server. MCP (via the separate `dot-prompts` package) exposes the same read/chain tools to other clients. This package is the pi harness: automatic capture, read notices, and tools/commands inside pi. You do not need MCP for the default pi workflow.

## Usage

Install into pi (user or project settings):

```bash
pi install npm:@dot-prompts/pi
```

Or try it for one run without installing:

```bash
pi -e npm:@dot-prompts/pi
```

After that, the default path needs no extra setup:

1. You ask pi to change code as usual.
2. On a successful edit/write, the extension buffers what changed. When the turn ends, it appends one record (prompt, model, file/region pointers) to the nearest `.prompts` store (auto-created in git repos; requires `/prompts init` otherwise).
3. Later, when the agent **reads** a file that has matching history, the read result includes a short notice, for example:

```
---
[dot-prompts] 2 prior intent records may apply to lines 12–28 of this file.
Use the prompts_read tool to fetch details if relevant to your task.
---
```

1. The agent can ignore the notice, or call `prompts_read` (and related tools) when prior intent might matter. Full prompt text is opt-in; the notice alone stays small so context is not flooded on every read.

You do not have to call tools yourself for recording or notices. That happens on its own.

### Commands

```
/prompts history <file>
/prompts init [path]
```

`/prompts history` asks the agent to load provenance for that file and summarize intent for a human (why the code looks this way). The turn is explanation-only: it should not edit files, and auto-record is skipped so the summary itself does not become a new provenance entry.

Example: `/prompts history src/api/fetch.ts`

`/prompts init` writes `dotprompts.json` (and `.prompts/`) at the session working directory so auto-record works in trees that are not a git repository. Pass an optional path (relative to the session cwd or absolute) to initialize a nested package instead, e.g. `/prompts init packages/api`. In a git repo you usually do not need this.

### Skills

There are no separate pi skills to install. The tools are already registered. To pull history on demand, ask in natural language, for example:

- "Use prompts_read on `src/foo.ts` and summarize any prior intent."
- "If the prompt is vague, use prompts_trace on that record id."
- "Walk referencedRecords with prompts_chain from the newest match."

`prompts_read` returns ranked prior prompts for a path (and optional line range or symbol). `prompts_chain` follows linked earlier records. `prompts_trace` opens the local pi session behind a record when the session file is still on disk (otherwise it falls back to the stored prompt text).

## Configuration

Optional. With no config, the store is discovered by walking up from the edited or read file: prefer `dotprompts.json` or `.prompts/config.json`, else use `<gitRoot>/.prompts`. Outside git, recording requires an initialized store (`/prompts init` or `dot-prompts init`); discovery still falls back to `<cwd>/.prompts` for reads once that store exists.

To pin a store for a package or repo, add `dotprompts.json` at the root you care about:

```json
{
  "version": 1,
  "storage": {
    "driver": "jsonl"
  }
}
```

Optional `storage.path` sets the store directory (relative to the config file's directory). Nested config at `.prompts/config.json` is also supported; relative `storage.path` there resolves against the parent of `.prompts`.

Today `jsonl` is the only storage driver.

## Read more

Source, schema, CLI, and MCP docs: [github.com/EpicCamel2302/dotprompts](https://github.com/EpicCamel2302/dotprompts)

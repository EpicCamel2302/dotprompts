# Overview

dot-prompts records **why** AI agents changed code.

When an agent edits a file, the intent lives in the chat session. That context disappears when a new session starts, or when another person or agent picks up the work. Git stores *what* changed. `.prompts/` stores *why*.

## What is stored

An append-only log:

```
.prompts/
  history.jsonl       # one JSON object per line
  records/            # mirrored individual records
```

Each record captures:

| Field | Meaning |
|---|---|
| `timestamp` | When the edit happened |
| `model` | Which model made the edit |
| `prompt` | The user's original prompt |
| `targets[].links[]` | Where the edit applied |
| `metadata` | Harness-specific extensions |

Records store **location pointers**, not diffs or line content. Code lives in git.

## How agents see it

A harness that supports read notices appends a short marker when a file has matching history:

```
---
[dot-prompts] 2 prior intent records may apply to lines 12–28 of this file.
Use the prompts_read tool to fetch details if relevant to your task.
---
```

Full prompt text is opt-in via tools. MCP exposes `prompts_read` and `prompts_chain`. The pi extension adds `prompts_trace` for local session drill-down. That keeps context windows from filling with history on every read.

## Provenance chains

Records may list other record ids in `metadata.referencedRecords` — the entries the agent read before editing. Walking that chain recovers stacked intent after renames, when file and symbol links no longer match.

## Getting started

| If you want to… | See |
|---|---|
| Record and query from the shell | [CLI](cli.md) |
| Expose tools to Cursor, Claude Code, etc. | [MCP](mcp.md) |
| Auto-record with pi | [Pi](pi.md) |
| Inspect the JSON | [Schema](schema.md) |

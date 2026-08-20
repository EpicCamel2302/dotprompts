# Pi extension

Automatic dot-prompts integration for the [pi](https://github.com/earendil-works/pi) coding agent.

Source: [`extensions/pi/dot-prompts.ts`](../extensions/pi/dot-prompts.ts)

## Setup

```bash
cd /path/to/dot-prompts
npm run build
cd extensions/pi && npm install
```

### Per-project

```bash
pi -e ./extensions/pi/dot-prompts.ts
```

### Global pi config

Add to your global pi extensions list (absolute path required):

```
/Users/you/src/dot-prompts/extensions/pi/dot-prompts.ts
```

Rebuild dot-prompts after pulling changes: `npm run build`.

## What it does

### Auto-record (edit / write)

On successful `edit` or `write` tool results:

1. Captures the user prompt from the current turn
2. Derives links (`file`, `region`, `git`, `symbol`) from the patch
3. Stores pi session metadata in `metadata.pi`
4. Stores ids of records read this turn in `metadata.referencedRecords` (provenance chain)
5. Appends to `.prompts/history.jsonl` in the project cwd

### Read awareness

On successful `read`, if matching provenance exists, appends:

```
---
[dot-prompts] 2 prior intent records may apply to lines 12–28 of this file.
Use the prompts_read tool to fetch details if relevant to your task.
---
```

No prompt text is injected automatically.

## Agent tools

### `prompts_read`

Fetch ranked prior prompts for a file or region.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `path` | string | File path |
| `startLine` | number? | Region start (1-indexed) |
| `endLine` | number? | Region end |
| `symbol` | string? | Symbol name |
| `limit` | number? | Max records (default 5) |

**When to use:** After seeing a `[dot-prompts]` notice and prior intent may affect your edit.

**When to skip:** Ground-up rewrites, unrelated changes, notice clearly irrelevant.

### `prompts_trace`

Explore the pi session branch that produced a record.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `recordId` | string? | dot-prompts record UUID (loads pi pointers from metadata) |
| `sessionFile` | string? | Override pi session file path |
| `userMessageId` | string? | Override anchor message id |
| `maxEntries` | number? | Max branch entries (default 20) |

**When to use:** `prompts_read` returned a vague prompt (e.g. "execute plan", "continue", "simplify it").

**Fallback:** If the session file is missing locally, returns the stored prompt text with an explanation. Portable intent from `.prompts/` is always available; full session tree is local-only.

### `prompts_chain`

Walk the provenance chain from a record id through `metadata.referencedRecords`.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `recordId` | string | Starting record UUID (usually newest from `prompts_read`) |
| `maxDepth` | number? | Optional hop cap from start. Omit for unlimited. |
| `maxRecords` | number? | Optional total record cap. Omit for unlimited. |

**When to use:** Record has `referencedRecords`, symbol/file links may be stale after renames, or you need the full stacked intent behind an edit.

**Default behavior:** Walks the entire chain — agents only pass limits when they want to stop early.

## Session metadata

Each record includes:

```json
"metadata": {
  "harness": "pi",
  "tool": "edit",
  "pi": {
    "sessionId": "…",
    "sessionFile": "/Users/you/.pi/agent/sessions/….jsonl",
    "userMessageId": "msg_…",
    "toolCallId": "…",
    "leafId": "…"
  }
}
```

`userMessageId` is captured on `agent_start` by walking the session branch for the current user message.

### Provenance chain (`metadata.referencedRecords`)

When the agent calls `prompts_read` or `prompts_trace` during a turn, those record ids are remembered. On the next auto-recorded edit/write, they are stored as:

```json
"metadata": {
  "referencedRecords": ["uuid-of-record-read", "uuid-of-record-traced"]
}
```

This stacks context across agents without dumping full history into one turn. Symbol and file links may break after renames; UUID references remain valid and can be walked transitively via `collectProvenanceChain()`.

## Slash commands

### `/prompts history <file>`

Asks the agent to load `.prompts` for that file (`prompts_read` / `prompts_chain`) and summarize the intent history for a human. Does not edit files. Auto-record is skipped for that turn so a summary cannot pollute provenance.

## Agent workflow

See [AGENTS.md](../AGENTS.md) for the full drill-down flow agents should follow.

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| No records written | No user prompt or edit failed | Check pi completed edit successfully |
| No `[dot-prompts]` notice | No matching history for read range | Expected on fresh files |
| `prompts_trace` falls back | Session file moved/deleted/ephemeral | Use `prompts_read` prompt text |
| Tool returns an internal-error message instead of crashing | Execute is wrapped; portable record text is returned when possible | Rebuild `dot-prompts` (`npm run build`) and reload pi |
| Records in wrong project | pi cwd differs from repo root | Records write to pi's cwd |

## Validation

See [examples/footgun/SCENARIO.md](../examples/footgun/SCENARIO.md) for the manual integration test.

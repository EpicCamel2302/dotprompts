# Pi

Automatic dot-prompts integration for the [pi](https://github.com/earendil-works/pi) coding agent.

```bash
cd /path/to/dot-prompts
npm run build
cd extensions/pi && npm install
```

Per-project:

```bash
pi -e ./extensions/pi/dot-prompts.ts
```

Global pi config (absolute path):

```
/Users/you/src/dot-prompts/extensions/pi/dot-prompts.ts
```

The extension imports `dot-prompts` and `dot-prompts/pi` from the built package, so rebuild after pulling (`npm run build`).

## What it does

On successful `edit` or `write`:

1. Captures the user prompt for the turn
2. Derives `file`, `region`, `git`, and `symbol` links from the patch
3. Stores pi session pointers in `metadata.pi`
4. Stores ids of records read this turn in `metadata.referencedRecords`
5. Appends to the store discovered by walking up from the edited file (`dotprompts.json` / `.prompts/config.json`, else `<gitRoot>/.prompts`)

On successful `read`, if matching provenance exists, appends:

```
---
[dot-prompts] 2 prior intent records may apply to lines 12–28 of this file.
Use the prompts_read tool to fetch details if relevant to your task.
---
```

Lookup and `prompts_read` use the same walk-up from the file path.

It also registers `prompts_read`, `prompts_chain`, and `prompts_trace`. Read and chain share parameters with the [MCP tools](mcp.md). `prompts_trace` is session-file drill-down; this extension loads pi session JSONL.

## Session metadata

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

`userMessageId` is captured on `agent_start` from the session branch. Session files stay on the machine; `.prompts/` holds the portable prompt text.

When the agent calls `prompts_read` or `prompts_trace` during a turn, those record ids are stored on the next recorded edit as `metadata.referencedRecords`.

## `/prompts history <file>`

Asks the agent to load `.prompts` for that file and summarize intent for a human. The turn does not edit files, and auto-record is skipped so a summary does not become a provenance entry.

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| No records written | No user prompt, or the edit failed | Confirm pi completed the edit |
| No `[dot-prompts]` notice | No matching history for the read range | Expected on files without records |
| `prompts_trace` returns stored prompt text | Session file moved, deleted, or ephemeral | The `.prompts/` prompt is the portable layer |
| Tool returns an internal-error message | Execute is wrapped; portable record text is returned when possible | `npm run build` and reload pi |
| Records in the wrong package | Nearest config / `.prompts` is not the one you expect | Add `dotprompts.json` in the package root, or pass an explicit store via library opts |

Manual integration fixture: [examples/footgun/SCENARIO.md](../../examples/footgun/SCENARIO.md).

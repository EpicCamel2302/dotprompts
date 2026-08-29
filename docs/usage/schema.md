# Schema (v1)

Files: [`schemas/record.v1.json`](../../packages/core/schemas/record.v1.json), [`schemas/link.v1.json`](../../packages/core/schemas/link.v1.json)

A **record** is one provenance event: a user prompt that caused one or more file edits.

```json
{
  "version": 1,
  "id": "8553b8c8-30e7-4185-9f20-1bfc25b6e9f1",
  "timestamp": "2026-08-19T23:49:09.897Z",
  "model": "openrouter/deepseek/deepseek-v4-flash-0731",
  "prompt": "Ensure fetchWithRetry retries 3 times because our API returns 429",
  "targets": [
    {
      "path": "examples/footgun/fetch.ts",
      "links": [
        { "type": "file" },
        {
          "type": "region",
          "startLine": 1,
          "endLine": 22
        },
        {
          "type": "symbol",
          "name": "fetchWithRetry",
          "kind": "function"
        }
      ]
    }
  ],
  "metadata": {
    "harness": "pi",
    "tool": "edit",
    "pi": {
      "sessionId": "abc123",
      "sessionFile": "/Users/you/.pi/agent/sessions/….jsonl",
      "userMessageId": "msg_xyz",
      "toolCallId": "call_abc",
      "leafId": "entry_123"
    }
  }
}
```

## Record fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | `1` | yes | Schema version |
| `id` | UUID string | yes | Unique id; CLI generates if omitted on write |
| `timestamp` | ISO 8601 UTC | yes | When the record was created |
| `model` | string | yes | Model slug (e.g. `anthropic/claude-sonnet-4-5`) |
| `prompt` | string | yes | User prompt that caused the edit |
| `targets` | array (min 1) | yes | Files affected |
| `$schema` | string | no | JSON Schema URI for editors |
| `metadata` | object | no | Extensible; `additionalProperties: true` |

Top-level record uses `additionalProperties: false`. Harness extensions go in `metadata`.

## Target

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | yes | Repo-relative file path (the only place path is stored) |
| `links` | array (min 1) | yes | Typed [links](link-types.md) for this file — no per-link `path` |

`target` uses `additionalProperties: false`.

## Metadata conventions

### `metadata.harness`

String identifying the recording harness: `"pi"`, `"cursor"`, `"manual"`, etc.

### `metadata.tool`

Which tool caused the edit: `"edit"`, `"write"`, etc.

### `metadata.pi`

Pi session pointers for `prompts_trace`:

| Field | Type | Description |
|---|---|---|
| `sessionId` | string | Pi session UUID |
| `sessionFile` | string | Absolute path to the pi session JSONL |
| `userMessageId` | string | Session entry id for the user message |
| `toolCallId` | string | Tool call id for the edit |
| `leafId` | string | Session leaf at record time |

Session files are local. `.prompts/` holds the portable `prompt` field.

### `metadata.referencedRecords`

UUID array of other records the agent read (`prompts_read`, `prompts_trace`) before this edit:

```json
"metadata": {
  "referencedRecords": [
    "8553b8c8-30e7-4185-9f20-1bfc25b6e9f1",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  ]
}
```

Walk with `dot-prompts chain <id>` or `prompts_chain`. File and symbol links can go stale after renames; UUID references stay valid.

### Custom keys

Harnesses may add keys. Prefer namespaced names (`myTool.feature`) to avoid collisions.

## Storage

**`history.jsonl`** — canonical append-only log; one complete record object per line.

**`records/<timestamp>_<id>.json`** — mirrored copy of each record for browsing.

**`dotprompts.json`** or **`.prompts/config.json`** — optional project config (`schemas/config.v1.json`). See [CLI](cli.md) for discovery and `storage.path`.

Writes are validated with Ajv against `record.v1.json`.

## Versioning

Current version is **1**. Later versions increment `version` and may add parallel schema files. Readers should accept unknown `metadata` keys and skip unrecognized link types they cannot score.

Records store location pointers. Diffs and file content live in git. Conversation traces live in the harness session file.

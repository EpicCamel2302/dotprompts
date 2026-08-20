# Schema reference (v1)

Schema files: [`schemas/record.v1.json`](../schemas/record.v1.json), [`schemas/link.v1.json`](../schemas/link.v1.json)

## Record

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
        { "type": "file", "path": "examples/footgun/fetch.ts" },
        {
          "type": "region",
          "path": "examples/footgun/fetch.ts",
          "startLine": 1,
          "endLine": 22
        },
        {
          "type": "symbol",
          "path": "examples/footgun/fetch.ts",
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

### Required fields

| Field | Type | Description |
|---|---|---|
| `version` | `1` | Schema version (integer constant) |
| `id` | UUID string | Unique record identifier; CLI generates if omitted on write |
| `timestamp` | ISO 8601 UTC | When the record was created |
| `model` | string | Model slug (e.g. `anthropic/claude-sonnet-4-5`) |
| `prompt` | string | Original user prompt that caused the edit |
| `targets` | array (min 1) | Files affected; see [Target](#target) |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `$schema` | string | JSON Schema URI for editors |
| `metadata` | object | Extensible; `additionalProperties: true` |

Top-level record uses `additionalProperties: false`. **Put harness extensions in `metadata`**, not at the record root.

## Target

Groups all links for one file path.

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | yes | Repo-relative file path |
| `links` | array (min 1) | yes | Typed links; see [link types](link-types.md) |

`target` uses `additionalProperties: false`.

## Metadata conventions

`metadata` is open-ended. Documented conventions:

### `metadata.harness`

String identifying the recording harness: `"pi"`, `"cursor"`, `"manual"`, etc.

### `metadata.tool`

Which tool caused the edit: `"edit"`, `"write"`, etc.

### `metadata.pi`

Pi session pointers for local drill-down via `prompts_trace`:

| Field | Type | Description |
|---|---|---|
| `sessionId` | string | Pi session UUID |
| `sessionFile` | string | Absolute path to pi session JSONL |
| `userMessageId` | string | Pi session entry id for the user message |
| `toolCallId` | string | Pi tool call id for the edit |
| `leafId` | string | Pi session leaf at record time |

Session files are **local only** — not committed with `.prompts/`.

### `metadata.referencedRecords`

UUID array of other dot-prompts records the agent **read** (`prompts_read`, `prompts_trace`) before making this edit. Written by the pi extension on auto-record.

```json
"metadata": {
  "referencedRecords": [
    "8553b8c8-30e7-4185-9f20-1bfc25b6e9f1",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  ]
}
```

This forms a **provenance chain** that stacks as agents build on each other:

- Each edit stores only ids read that turn — not the full history in one blob
- Symbol and file links may break after renames; UUID references remain valid
- Walk the chain with `collectProvenanceChain(recordId)` or `dot-prompts chain <id>` to recover earlier intent
- Agents use `prompts_chain` in pi; defaults to unlimited depth

Example: record A adds retry logic → record B renames the function (references A) → record C simplifies cosmetics (references B). Even if the symbol link on B is stale, C still points at B which points at A.

### Custom metadata

Harnesses may add arbitrary keys. Prefer namespaced keys (`myTool.feature`) to avoid collisions.

## Storage

### `history.jsonl`

Canonical append-only log. One complete record JSON object per line.

### `records/<timestamp>_<id>.json`

Mirrored copy of each record for browsing. Same content as the JSONL line.

## Validation

Records are validated with Ajv against `record.v1.json` on write. Invalid records are rejected with structured error output.

## Versioning

- Current version: **1**
- Future versions will increment `version` and may introduce parallel schema files
- Readers should accept unknown `metadata` keys and ignore unrecognized link types they cannot score

## What is NOT stored

- Edit payloads (`oldText` / `newText`, hashline `payload` arrays)
- Full file content or diffs
- Assistant thinking traces (available via pi session drill-down, not in `.prompts/`)

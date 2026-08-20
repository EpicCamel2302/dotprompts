# CLI reference

Install and build:

```bash
npm install && npm run build
```

Global option (all commands):

```
--prompts-dir <path>   Path to .prompts directory (default: .prompts)
```

## `record`

Append a provenance record from JSON on stdin.

```bash
dot-prompts record [--file <path>]
```

**Input:** JSON matching [record schema](schema.md). The CLI assigns `id` and `timestamp` if omitted.

**Output:** The validated record JSON on stdout.

**Example:**

```bash
echo '{
  "model": "test-model",
  "prompt": "Add retry logic",
  "targets": [{
    "path": "src/foo.ts",
    "links": [{ "type": "file", "path": "src/foo.ts" }]
  }]
}' | dot-prompts record
```

## `lookup`

Ranked search for prior records affecting a file/region/symbol/hashline.

```bash
dot-prompts lookup --path <path> [options]
```

| Option | Description |
|---|---|
| `--path` | **Required.** File path to match |
| `--start-line`, `--end-line` | Query region (1-indexed) |
| `--symbol` | Symbol name to match |
| `--hashline` | JSON anchor: `'{"line":42,"hash":"f1"}'` |
| `--limit` | Max matches (default 5) |
| `--min-confidence` | Minimum score (default 0.4) |

**Output:** `{ "matches": [{ "record", "confidence", "matchedLinks", "stale?" }] }`

## `read`

Annotate a file with hashline anchors (`LINE#HASH`).

```bash
dot-prompts read <path> [--format json|human]
```

Used by harnesses that need line-level hashes. Default output is JSON:

```json
{
  "path": "src/foo.ts",
  "lines": [{ "line": 1, "hash": "a3", "content": "..." }]
}
```

## `list`

List records with optional filters.

```bash
dot-prompts list [--limit N] [--since ISO] [--path PATH] [--model MODEL]
```

**Output:** `{ "records": [...] }`

## `get`

Fetch a single record by UUID.

```bash
dot-prompts get <id>
```

Exits 1 with `{ "error": "not_found" }` if missing.

## `chain`

Walk `metadata.referencedRecords` from one or more starting record ids. Traverses the **full chain by default** (no depth cap).

```bash
dot-prompts chain <id> [more-ids...] [--format json|text] [--max-depth N] [--max-records N]
```

**Output (json):** `{ "entries": [{ "record", "depth", "via?" }], "truncated", "missingIds" }`

**Output (text):** Human-readable stacked prompts with targets and references.

Use when symbol/file links are stale but UUID references remain. Pass `--max-depth` or `--max-records` only to stop early.

## `context`

Compact summary for agent context injection.

```bash
dot-prompts context [--limit N] [--since ISO] [--path PATH] [--model MODEL]
```

**Output:** `{ "records": [{ "id", "timestamp", "model", "prompt", "paths", "linkCount" }] }`

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Validation error, not found, or other failure |

Errors on stderr are JSON: `{ "error": "validation"|"failure"|"not_found", ... }`

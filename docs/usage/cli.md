# CLI

```bash
npm install && npm run build
```

Global option (all commands):

```
--prompts-dir <path>   Path to .prompts directory (skips config discovery)
```

Relative `--prompts-dir` values resolve against the process working directory.

## Store discovery

When `--prompts-dir` is omitted, the store is resolved by walking up from a relevant file path (when the command has one) or from the process cwd:

1. `dotprompts.json` in the current directory
2. `.prompts/config.json` in the current directory
3. Repeat on the parent directory
4. Stop at a `.git` directory → use `<gitRoot>/.prompts`
5. If the filesystem root is reached with no config and no `.git` → use `<cwd>/.prompts`

Minimal `dotprompts.json`:

```json
{
  "version": 1,
  "storage": {
    "driver": "jsonl"
  }
}
```

Optional `storage.path` sets the store directory (relative to the config’s directory for `dotprompts.json`, or relative to the parent of `.prompts` for nested config).

## `record`

Append a provenance record from JSON on stdin.

```bash
dot-prompts record [--file <path>]
```

**Input:** JSON matching the [record schema](schema.md). The CLI assigns `id` and `timestamp` if omitted. When `--prompts-dir` is omitted, walk-up uses the first target path when present.

**Output:** The validated record JSON on stdout.

```bash
echo '{
  "model": "test-model",
  "prompt": "Add retry logic",
  "targets": [{
    "path": "src/foo.ts",
    "links": [{ "type": "file" }]
  }]
}' | dot-prompts record
```

## `lookup`

Ranked search by file, region, symbol, or hashline.

```bash
dot-prompts lookup --path <path> [options]
```

| Option | Description |
|---|---|
| `--path` | **Required.** File path to match (also used for store walk-up) |
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

Default output is JSON:

```json
{
  "path": "src/foo.ts",
  "lines": [{ "line": 1, "hash": "a3", "content": "..." }]
}
```

## `list`

```bash
dot-prompts list [--limit N] [--since ISO] [--path PATH] [--model MODEL]
```

**Output:** `{ "records": [...] }`

## `get`

```bash
dot-prompts get <id>
```

Exits 1 with `{ "error": "not_found" }` if missing.

## `chain`

Walk `metadata.referencedRecords` from one or more record ids. Traverses the full chain unless you pass a cap.

```bash
dot-prompts chain <id> [more-ids...] [--format json|text] [--max-depth N] [--max-records N]
```

**Output (json):** `{ "entries": [{ "record", "depth", "via?" }], "truncated", "missingIds" }`

**Output (text):** Stacked prompts with targets and references.

## `context`

Compact summary of recent records.

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

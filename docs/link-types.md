# Link types

Links identify **where** an edit applied. They are pointers, not content.

Schema: [`schemas/link.v1.json`](../schemas/link.v1.json)

## Registry

| Type | Required fields | Purpose |
|---|---|---|
| `file` | `path` | Coarse file-level anchor; always recorded |
| `region` | `path`, `startLine`, `endLine` | Line range (1-indexed, inclusive) |
| `git` | `path`, `commit` | Git commit correlation at record time |
| `symbol` | `path`, `name` | Function/class/const name (optional `kind`) |
| `hashline` | `path`, `line`, `hash` | Line-level content hash anchor |

Each link type allows **`additionalProperties: true`** for per-link extensions.

## Examples

```json
{ "type": "file", "path": "src/api/fetch.ts" }

{
  "type": "region",
  "path": "src/api/fetch.ts",
  "startLine": 12,
  "endLine": 28
}

{
  "type": "git",
  "path": "src/api/fetch.ts",
  "commit": "a3f9c2d4e5f6789012345678901234567890abcd"
}

{
  "type": "symbol",
  "path": "src/api/fetch.ts",
  "name": "fetchWithRetry",
  "kind": "function"
}

{
  "type": "hashline",
  "path": "src/api/fetch.ts",
  "line": 42,
  "hash": "f1"
}
```

## Lookup confidence

When querying via `lookup` or pi tools, links score at different confidence levels:

| Match | Confidence | Notes |
|---|---|---|
| `hashline` exact (`line` + `hash`) | 0.95 | Highest precision |
| `symbol` name match | 0.90 | Same path + symbol name |
| `region` overlap | 0.70 | Query range intersects stored range |
| `hashline` stale (same line, different hash) | 0.50 | Line drifted; intent may still apply |
| `file` path only | 0.40 | Coarsest match |

Results below `--min-confidence` (default `0.4`) are excluded.

### Region overlap

Two ranges overlap when:

```
query.startLine <= stored.endLine AND stored.startLine <= query.endLine
```

### Multiple links per target

A single target typically includes several links at different granularities:

```
file → region → symbol → git
```

Lookup uses the **best-matching link** to determine confidence for that record.

## Adding new link types

Link types are defined in the JSON Schema `oneOf` union. Adding a new type requires:

1. A new definition in `schemas/link.v1.json`
2. TypeScript types in `src/types.ts`
3. Scoring logic in `src/query.ts`

Until registered, use **`metadata`** for experimental pointers rather than unvalidated link types.

## Path normalization

All paths should be **repo-relative** with forward slashes (e.g. `src/api/fetch.ts`). The pi extension and link extractors normalize paths automatically.

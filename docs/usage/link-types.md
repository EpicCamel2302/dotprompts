# Link types

Links identify **where** an edit applied. They are pointers; the code itself lives in git.

Schema: [`schemas/link.v1.json`](../../schemas/link.v1.json)

## Registry

| Type | Required fields | Purpose |
|---|---|---|
| `file` | `path` | File-level anchor |
| `region` | `path`, `startLine`, `endLine` | Line range (1-indexed, inclusive) |
| `git` | `path`, `commit` | Git commit at record time |
| `symbol` | `path`, `name` | Function, class, or const (optional `kind`) |
| `hashline` | `path`, `line`, `hash` | Line identified by content hash |

Each link type allows **`additionalProperties: true`**.

`extractLinksFromEdit` and `extractLinksFromWrite` produce `file`, `region`, `git`, and `symbol` links. A `hashline` link can be stored and queried the same way as the others.

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

| Match | Confidence |
|---|---|
| `hashline` exact (`line` + `hash`) | 0.95 |
| `symbol` name match | 0.90 |
| `region` overlap | 0.70 |
| `hashline` same line, different hash | 0.50 (`stale`) |
| `file` path only | 0.40 |

Results below `--min-confidence` (default `0.4`) are excluded. A record's score is the best-matching link.

Region overlap:

```
query.startLine <= stored.endLine AND stored.startLine <= query.endLine
```

A typical recorded target includes several granularities:

```
file → region → symbol → git
```

## Paths

Repo-relative, forward slashes (e.g. `src/api/fetch.ts`). The pi extension and link extractors normalize paths.

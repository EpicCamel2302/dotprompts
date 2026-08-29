# Link types

Links identify **where** an edit applied within a target file. They are pointers; the code itself lives in git. The file path lives on the parent **target**, not on each link.

Schema: [`schemas/link.v1.json`](../../packages/core/schemas/link.v1.json)

## Registry

| Type | Required fields | Purpose |
|---|---|---|
| `file` | (none beyond `type`) | File-level anchor |
| `region` | `startLine`, `endLine` | Line range (1-indexed, inclusive) |
| `git` | `commit` | Git commit at record time |
| `symbol` | `name` | Function, class, or const (optional `kind`) |
| `hashline` | `line`, `hash` | Line identified by content hash |

Links must **not** include `path` (forbidden in the schema). Each link type allows other **`additionalProperties`**.

`extractLinksFromEdit` and `extractLinksFromWrite` produce `file`, `region`, `git`, and `symbol` links. A `hashline` link can be stored and queried the same way as the others.

## Examples

```json
{ "type": "file" }

{
  "type": "region",
  "startLine": 12,
  "endLine": 28
}

{
  "type": "git",
  "commit": "a3f9c2d4e5f6789012345678901234567890abcd"
}

{
  "type": "symbol",
  "name": "fetchWithRetry",
  "kind": "function"
}

{
  "type": "hashline",
  "line": 42,
  "hash": "f1"
}
```

## Lookup confidence

Lookup first matches `target.path` to the query path, then scores links inside that target:

| Match | Confidence |
|---|---|
| `hashline` exact (`line` + `hash`) | 0.95 |
| `symbol` name match | 0.90 |
| `region` overlap | 0.70 |
| `hashline` same line, different hash | 0.50 (`stale`) |
| `file` | 0.40 |

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

Repo-relative, forward slashes (e.g. `src/api/fetch.ts`), stored once on `target.path`. The pi extension and link extractors normalize paths when building the target.

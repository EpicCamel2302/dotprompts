# AGENTS.md — dot-prompts

Instructions for AI agents working in repositories that use dot-prompts.

## What this is

`.prompts/` is a provenance log: it records **why** prior AI edits were made (user prompts, model, location), not the code itself. Git stores what changed; dot-prompts stores intent.

It is not a place for standing domain rules. Constraints that should always apply belong in the user prompt, a comment, or project docs — same as without an agent.

## When you see `[dot-prompts]`

After reading a file, you may see:

```
---
[dot-prompts] 2 prior intent records may apply to lines 12–28 of this file.
Use the prompts_read tool to fetch details if relevant to your task.
---
```

This means prior AI-driven edits touched this area. **You are not required to act on it.**

### Decision guide

| Situation | Action |
|---|---|
| Editing code that may have intentional complexity | Call `prompts_read` |
| Prompt is vague after `prompts_read` ("execute plan", "continue") | Call `prompts_trace` with the record id |
| Record has `referencedRecords` or links may be stale (renames) | Call `prompts_chain` with the newest record id |
| Ground-up rewrite or unrelated change | Skip — do not call tools |
| Notice mentions many records, only some relevant | Call `prompts_read` with `symbol` or line range |

## Drill-down stages (all optional)

```
Stage 0: [dot-prompts] notice     → free, automatic on read
Stage 1: prompts_read             → portable prompt text (in git)
Stage 2: prompts_chain            → walk referencedRecords (survives renames)
Stage 3: prompts_trace            → local pi session context (best-effort)
```

Each stage adds context cost. Stop when you have enough to respect prior intent.

## Tools (pi extension)

### `prompts_read`

Returns ranked prior user prompts that may apply to a file or region.

```
prompts_read({ path: "src/foo.ts", symbol: "fetchWithRetry" })
prompts_read({ path: "src/foo.ts", startLine: 12, endLine: 28 })
```

**Treat prior prompts as constraints on intent, not as sacred code.** Prior agents may have added complexity for documented reasons (product requirements, API limits, workarounds). You may simplify *structure* but should preserve *intent* unless the user explicitly overrides it.

Example: if a prior prompt says "keep retry count at 3 — product requirement", do not reduce retries when asked to "simplify."

### `prompts_trace`

Explores the pi conversation branch around a vague prompt.

```
prompts_trace({ recordId: "<uuid-from-prompts_read>" })
```

Use when the stored prompt alone does not explain why code exists (e.g. "execute plan", "do it", "simplify").

**Fallback:** If the pi session file is unavailable on this machine, you receive the stored prompt text only. That is the portable provenance layer — use it.

### `prompts_chain`

Walks `metadata.referencedRecords` from a starting record id through all ancestors. Default is **unlimited depth** — the full chain is returned unless you pass `maxDepth` or `maxRecords` to stop early.

```
prompts_chain({ recordId: "<uuid-from-prompts_read>" })
prompts_chain({ recordId: "<uuid>", maxDepth: 2 })  // optional early stop
```

Use when symbol/file links are broken after renames, or when `prompts_read` shows a record references prior context. Each record in the chain includes its prompt, targets, and further references.

For vague prompts within the chain, call `prompts_trace` on that specific record id.

## What dot-prompts does NOT tell you

- Exact line content at edit time (read the live file or git history)
- Whether prior intent is still valid (requirements may have changed — weigh prompt age and user instructions)
- Standing domain rules (those live in prompts, comments, tests, or docs)
- Full diffs (use git)

## Respecting vs. overriding intent

Prior prompts explain **why** code looks the way it does. When the user asks to simplify or refactor:

1. Check if prior intent applies to the region you're changing
2. Preserve behavioral constraints from prior prompts (retry counts, error handling, API workarounds)
3. You may remove ceremony (dead code, redundant constants) if behavior is unchanged
4. If the user's current instruction **conflicts** with prior intent, follow the **current user instruction** and note the override

## Record schema (essential fields)

Each `.prompts/` record contains:

```json
{
  "version": 1,
  "id": "<uuid>",
  "timestamp": "<iso8601>",
  "model": "<model-slug>",
  "prompt": "<user-prompt-that-caused-edit>",
  "targets": [{
    "path": "<repo-relative-path>",
    "links": [
      { "type": "file", "path": "..." },
      { "type": "region", "path": "...", "startLine": N, "endLine": M },
      { "type": "symbol", "path": "...", "name": "...", "kind": "function" }
    ]
  }],
  "metadata": { "harness": "pi", "pi": { "sessionId": "...", "sessionFile": "..." } }
}
```

Links are location pointers. `metadata` may contain harness-specific drill-down pointers.

### Provenance chains (`metadata.referencedRecords`)

When an agent reads prior records via `prompts_read` or `prompts_trace` and then edits code, the new record stores those record ids in `metadata.referencedRecords`. This chains intent across edits without loading full history into context at once.

**Why it matters for renames:** Symbol links break when a function is renamed. But the latest record still references the record from the rename edit, which references the original intent record. Follow the chain:

```
prompts_read → record C (simplify)
  referencedRecords: [B]
prompts_read B → "rename fetch to fetchWithRetry"
  referencedRecords: [A]
prompts_read A → "keep retry=3 for 429 responses"
```

Use `dot-prompts get <id>` or `prompts_chain` / `prompts_trace` on each id in the chain when symbol/file links no longer resolve.

## CLI (without pi tools)

If tools are unavailable, use the CLI:

```bash
dot-prompts lookup --path src/foo.ts --symbol myFunction
dot-prompts get <record-id>
```

## Further reading

- [docs/overview.md](docs/overview.md) — design principles
- [docs/schema.md](docs/schema.md) — full schema
- [docs/link-types.md](docs/link-types.md) — link type registry
- [docs/pi-extension.md](docs/pi-extension.md) — pi setup

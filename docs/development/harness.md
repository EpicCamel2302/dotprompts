# Harnesses

Wire record, read notices, and opt-in tools into an agent harness.

## Checklist

1. **Record** once per user generation (buffer successful edits, flush at generation end)
2. **Notify** on file read when matching history exists
3. **Provide opt-in tools** for prompt text and further drill-down
4. Inject the notice only — full history stays behind tools

## Write path

**Buffer during the generation, flush once at generation end.**

A *generation* is one submitted user prompt (Pi: `before_agent_start` → `agent_end`), not each tool round inside the agent loop.

1. On each successful edit/write: derive links and **upsert** into an in-generation buffer by path (last-edit wins for the same file)
2. On generation end (`agent_end`, with a safety flush on `session_shutdown` if needed): call `record` once with all buffered targets
3. Skip flush when there is no user prompt, the turn is a history-summarize prompt, or the buffer is empty

Shared helpers: `GenerationRecordBuffer`, `upsertTargetByPath` from `dot-prompts`.

Call `record` with:

- `model` — active model slug
- `prompt` — the user's prompt for the generation
- `targets` — one entry per file touched, with derived [links](../usage/link-types.md)
- `metadata` — harness id, tool name(s), session pointers

### CLI

```bash
echo '<record-json>' | dot-prompts record
```

### Programmatic

```typescript
import { record, extractLinksFromEdit } from "dot-prompts";

const target = extractLinksFromEdit({
  cwd: process.cwd(),
  path: "src/foo.ts",
  patch: unifiedPatchFromEditTool,
  firstChangedLine: 12,
  contentBefore: fileContentBeforeEdit,
});

record({
  model: "provider/model-id",
  prompt: userPrompt,
  targets: [target],
  metadata: { harness: "my-harness", tool: "edit" },
}, { filePath: absolutePathToEditedFile });
```

Pass `filePath` (or `promptsDir` / `storage`) so the store is resolved via walk-up from the edited file. See [CLI](../usage/cli.md) for discovery rules.

| Function | Use when |
|---|---|
| `extractLinksFromEdit()` | Search/replace or patch-based edits |
| `extractLinksFromWrite()` | Whole-file write |

Both produce `file` and `region` links. Edit extraction also adds `git` and `symbol` when those resolve.

Records store location pointers. Diffs live in git. Skip a record when there is no user prompt.

One generation → one record. Multiple files become multiple `targets`. Repeated edits to the same file keep only the **last** link set for that path:

```json
{
  "targets": [
    { "path": "src/a.ts", "links": [...] },
    { "path": "src/b.ts", "links": [...] }
  ],
  "metadata": {
    "harness": "pi",
    "tool": "write",
    "tools": ["edit", "write"],
    "pi": { "toolCallId": "…", "toolCallIds": ["…", "…"] }
  }
}
```

`metadata.tool` is the last successful write tool; `metadata.tools` lists unique tools in first-seen order when more than one tool was used. Cursor hooks should use the same buffer→flush shape (durable turn state keyed by conversation + generation id).

## Read path

### Notice

After a successful file read:

```typescript
import { lookupForReadRange, formatLookupNotice } from "dot-prompts";

const result = lookupForReadRange(path, offset, limit, {
  minConfidence: 0.4,
  limit: 5,
  filePath: absolutePath,
});

if (result.matches.length > 0) {
  appendToToolOutput(formatLookupNotice(result.matches.length, startLine, endLine));
}
```

### Tools

Use the shared handlers so MCP and in-process extensions stay aligned on `prompts_read` / `prompts_chain`. Register `prompts_trace` when the harness can load a local session file (pi is the current implementation):

```typescript
import { handlePromptsRead, handlePromptsChain, TOOL_CATALOG } from "dot-prompts";
import { handlePromptsTrace } from "dot-prompts/pi";

const result = handlePromptsRead(
  { path, startLine, endLine, symbol },
  {
    filePath: absolutePath,
    onReadRecords: (ids) => {
      for (const id of ids) referencedRecordIds.add(id);
    },
  },
);
```

`TOOL_CATALOG` is the description and params source. Map it to Zod or TypeBox at the harness edge.

Alternatively, spawn the [MCP server](../usage/mcp.md) (`import { createDotPromptsMcpServer } from "dot-prompts/mcp"`) for read and chain, or call the [CLI](../usage/cli.md). Do not import `dot-prompts/pi` from an MCP adapter.

`prompts_trace` loads the pi session branch when `metadata.pi` (or another harness block with `sessionFile`) is present. Missing session files fall back to the stored prompt.

## Metadata

Portable provenance lives in `prompt` and `links`. Local drill-down pointers live in `metadata`, nested under `metadata[metadata.harness]`:

```json
{
  "harness": "pi",
  "tool": "edit",
  "tools": ["edit", "write"],
  "pi": { "sessionFile": "…", "sessionId": "…", "toolCallId": "…", "toolCallIds": ["…"] }
}
```

`formatLookupForAgent` treats `sessionFile` / `sessionId` on that nested object as a hint to use `prompts_trace`.

## Committing `.prompts/`

Commit `.prompts/` in projects where AI provenance should travel with the repo.

## Reference

The [pi extension](../../extensions/pi/dot-prompts.ts) implements record, notices, tools, and `referencedRecords` tracking. Usage: [Pi](../usage/pi.md).

# Harnesses

Wire record, read notices, and opt-in tools into an agent harness.

## Checklist

1. **Record** after every successful AI edit
2. **Notify** on file read when matching history exists
3. **Provide opt-in tools** for prompt text and further drill-down
4. Inject the notice only — full history stays behind tools

## Write path

After the harness applies an edit, call `record` with:

- `model` — active model slug
- `prompt` — the user's prompt for the current turn
- `targets` — one entry per file, with derived [links](../usage/link-types.md)
- `metadata` — harness id, tool name, session pointers

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

Prefer one record per user turn when a single prompt caused several file edits:

```json
{
  "targets": [
    { "path": "src/a.ts", "links": [...] },
    { "path": "src/b.ts", "links": [...] }
  ]
}
```

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
  "pi": { "sessionFile": "…", "sessionId": "…" }
}
```

`formatLookupForAgent` treats `sessionFile` / `sessionId` on that nested object as a hint to use `prompts_trace`.

## Committing `.prompts/`

Commit `.prompts/` in projects where AI provenance should travel with the repo.

## Reference

The [pi extension](../../extensions/pi/dot-prompts.ts) implements record, notices, tools, and `referencedRecords` tracking. Usage: [Pi](../usage/pi.md).

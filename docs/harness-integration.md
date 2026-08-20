# Harness integration

Guide for wiring dot-prompts into an agent harness (pi, Cursor, custom tools, CI, etc.).

## Integration checklist

1. **Record** after every successful AI edit
2. **Notify** on file read when matching history exists
3. **Provide opt-in tools** for agents to fetch prompt text and drill deeper
4. **Never** inject full history automatically into every read

## Write path: recording

After the harness applies an edit, call `record` with:

- `model` — active model slug
- `prompt` — the user's prompt for the current turn
- `targets` — one entry per file, with derived [links](link-types.md)
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
});
```

### Link extraction helpers

| Function | Use when |
|---|---|
| `extractLinksFromEdit()` | Search/replace or patch-based edits |
| `extractLinksFromWrite()` | Whole-file write |

Both produce `file` + `region` links. Edit extraction also attempts `git` and `symbol` links.

### What NOT to record

- Edit payloads or diffs (git handles this)
- Line content or replacement text
- Records without a user prompt (skip or use a placeholder — prefer skip)

## Read path: awareness + opt-in fetch

### Step 1: Notice (automatic, cheap)

After a successful file read, query for matching records:

```typescript
import { lookupForReadRange, formatLookupNotice } from "dot-prompts";

const result = lookupForReadRange(path, offset, limit, {
  minConfidence: 0.4,
  limit: 5,
});

if (result.matches.length > 0) {
  appendToToolOutput(formatLookupNotice(result.matches.length, startLine, endLine));
}
```

The notice tells the agent history exists without injecting prompt text.

### Step 2: `prompts_read` (agent opt-in)

Agent tool that returns ranked prior prompts for a path/region/symbol.

Use [`formatLookupForAgent()`](../src/links/extract.ts) to format results. Include record ids so the agent can trace further.

**Portable option:** expose the same tools via the [MCP server](mcp.md) (`prompts_read`, `prompts_chain`, `prompts_trace`) so Claude Code, Cursor, and other MCP clients share one implementation. Harnesses that cannot run MCP can call the [CLI](cli.md) instead.

### Step 3: `prompts_trace` (agent opt-in, local)

For vague prompts ("execute plan"), drill into the harness session branch. See [pi extension](pi-extension.md) for the reference implementation.

## Metadata conventions

Use `metadata` for harness-specific data:

```json
{
  "harness": "pi",
  "tool": "edit",
  "sessionId": "optional-session-id",
  "pi": { "...": "see schema.md" }
}
```

Keep portable provenance in `prompt` and `links`. Keep local drill-down pointers in `metadata`.

## Multi-file edits

One record can contain multiple targets:

```json
{
  "targets": [
    { "path": "src/a.ts", "links": [...] },
    { "path": "src/b.ts", "links": [...] }
  ]
}
```

Prefer one record per user turn, not one record per file, when a single prompt caused multiple edits.

## Committing `.prompts/`

Recommend committing `.prompts/` in projects where AI provenance matters. Add to `.gitignore` only for throwaway repos.

## Reference implementation

The [pi extension](../extensions/pi/dot-prompts.ts) implements the full write/read/trace flow. Use it as a template.

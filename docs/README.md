# dot-prompts documentation

Provenance and observability for LLM-generated code edits.

## For humans

| Document | Description |
|---|---|
| [Overview](overview.md) | Goals, design principles, architecture |
| [Schema reference](schema.md) | Record format, fields, validation rules |
| [Link types](link-types.md) | Typed link registry and lookup confidence |
| [CLI reference](cli.md) | `dot-prompts` command-line usage |
| [MCP server](mcp.md) | Portable opt-in tools (`prompts_read` / `chain` / `trace`) |
| [Harness integration](harness-integration.md) | Building record/lookup into agent harnesses |
| [Pi extension](pi-extension.md) | Automatic capture with pi coding agent |

## For agents and LLMs

| Document | Description |
|---|---|
| [../AGENTS.md](../AGENTS.md) | Agent workflow: notice → read → trace (start here) |

## Examples

| Document | Description |
|---|---|
| [../examples/footgun/SCENARIO.md](../examples/footgun/SCENARIO.md) | Validation scenario and test results |

## JSON Schemas

Machine-readable schemas live in [`../schemas/`](../schemas/):

- [`record.v1.json`](../schemas/record.v1.json)
- [`link.v1.json`](../schemas/link.v1.json)

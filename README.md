# dot-prompts

Provenance and observability for LLM-generated code edits. Records **when**, **who**, **why**, and **where** — without duplicating the codebase.

## Documentation

| Audience | Start here |
|---|---|
| **Agents / LLMs** | [AGENTS.md](AGENTS.md) |
| **Humans** | [docs/README.md](docs/README.md) |
| **Pi users** | [docs/pi-extension.md](docs/pi-extension.md) |
| **Harness authors** | [docs/harness-integration.md](docs/harness-integration.md) |

## Quick start

```bash
npm install && npm run build

# Record
echo '{ "model": "...", "prompt": "...", "targets": [...] }' | dot-prompts record

# Lookup
dot-prompts lookup --path src/foo.ts --symbol myFunction

# Pi (automatic)
pi -e /path/to/dot-prompts/extensions/pi/dot-prompts.ts
```

## Design principle

`.prompts` stores provenance **pointers**, not code. Agents get a notice on read, then opt in to `prompts_read` and `prompts_trace` for context.

Commit `.prompts/` to git so intent travels with the repo.

## Development

```bash
npm test
npm run build
```

## License

MIT

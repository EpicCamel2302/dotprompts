# dot-prompts

Provenance for LLM-generated code edits. Records **when**, **who**, **why**, and **where** — without duplicating the codebase.

Git stores *what* changed. `.prompts/` stores *why*.

## Why dot-prompts

When an agent edits a file, the reason lives in the chat: a product constraint, an API quirk, a workaround. That context disappears when the session ends, or when someone else (human or agent) next opens the code. The result looks like unexplained complexity, and the next pass often "simplifies" it away.

dot-prompts keeps a small, append-only log in `.prompts/` beside the repo. Each entry points at *where* an edit landed and stores the user prompt that caused it. Git still owns the diffs. Agents can be told that history exists, then fetch it only when they need it.

Commit `.prompts/` so intent travels with the code.

## Quick start

### Use

```bash
npm install && npm run build

echo '{ "model": "...", "prompt": "...", "targets": [...] }' | dot-prompts record

dot-prompts lookup --path src/foo.ts --symbol myFunction

node /path/to/dot-prompts/dist/mcp/cli.js
# optional peers: npm install @modelcontextprotocol/sdk zod

pi -e /path/to/dot-prompts/extensions/pi/dot-prompts.ts
```

CLI, MCP client config, and pi setup: [docs/usage](docs/usage/README.md).

### Develop

```bash
npm install
npm test
npm run build
```

Architecture and harnesses: [docs/development](docs/development/README.md). Coding agents in this repository: [AGENTS.md](AGENTS.md).

## Maintenance

This is a spare-time project. It is not maintained full time, and there is no promised response window.

Pull requests and forks are welcome — take it, change it, and keep it alive wherever it helps.

## License

MIT

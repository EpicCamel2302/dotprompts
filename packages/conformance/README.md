# @dot-prompts/conformance

Harness-agnostic assert helpers for [dot-prompts](https://github.com/EpicCamel2302/dotprompts) adapters.

Checks **outcomes** (records, notices, catalog tools, `referencedRecords`) — not harness lifecycle APIs (no FakePi / `agent_end`).

```ts
import {
  assertHarnessRecord,
  assertNoticeText,
  assertRegisteredTools,
} from "@dot-prompts/conformance";
```

`prompts_read` and `prompts_chain` are required. `prompts_trace` is optional unless you pass `{ requireTrace: true }`.

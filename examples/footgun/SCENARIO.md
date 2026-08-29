# Footgun validation scenario

This fixture tests whether dot-prompts helps a **cold-start** pi session avoid undoing intentional complexity.

## Fixture

`[fetch.ts](fetch.ts)` exports `fetchWithRetry` with:

- Exactly **3 retries** (product requirement)
- **Exponential backoff** specifically for **429** responses
- Logic that looks simplifiable without context

## Session 1 — build provenance history

Run pi with the extension from repo root:

```bash
npm run build
pi -e ./packages/pi
```

Execute these prompts in order (each should trigger an edit + auto-record):

1. `In examples/footgun/fetch.ts, ensure fetchWithRetry retries 3 times because our API returns 429 rate limits.`
2. `Use exponential backoff specifically for 429 responses in fetchWithRetry.`
3. `Keep the retry count at 3 in fetchWithRetry — product requirement, do not reduce it.`

### Verify

```bash
cat .prompts/history.jsonl | wc -l   # expect >= 3
dot-prompts lookup --path examples/footgun/fetch.ts --symbol fetchWithRetry
```

Records should include `file`, `region`, and ideally `symbol` links.

Optionally commit `.prompts/` so session 2 reads real history.

## Session 2 — cold start footgun test

Start a **new pi session** (no conversation context):

```bash
pi -e ./packages/pi
```

Prompt:

```
Simplify examples/footgun/fetch.ts — remove unnecessary complexity from the fetch logic.
```


Success criteria


| Signal                     | Pass                                                     |
| -------------------------- | -------------------------------------------------------- |
| Agent reads the file       | Output includes `[dot-prompts]` notice                   |
| Agent calls `prompts_read` | Retrieves prompts mentioning 429 / backoff / retry count |
| Final code                 | Still retries 3 times; still handles 429 with backoff    |
| Control (no extension)     | Agent typically removes retry/backoff as "unnecessary"   |


### Record results

Session 2 run (2026-08-20):

```
Date: 2026-08-20
Model: DeepseekV4-flash
Noticed [dot-prompts] on read: yes
Called prompts_read: yes — received both prompts from history
Preserved retry=3 and 429 backoff: yes
Notes:
  Agent simplified cosmetic complexity only (removed dead throw, inlined backoff constant)
  but kept retry logic unchanged: exactly 3 retries on 429 with exponential backoff,
  per documented product requirement. Behavior identical, less ceremony.
```

**Outcome: pass.** dot-prompts informed the agent of prior intent; the agent treated it as
constraint rather than sacred code — simplified structure without undoing intentional behavior.

## Control run

Repeat session 2 **without** the extension:

```bash
pi
```

Same simplification prompt. Compare whether retry logic survives.

### Control results

Session 2 control run (2026-08-20, no extension):

```
Date: 2026-08-20
Model: DeepseekV4-flash
Extension: none
Preserved retry=3 and 429 backoff: yes (behavior unchanged)
Referenced design constraints: no
Notes:
  Model still preserved functionality when simplifying — likely inferred intent from
  the code itself (429 checks, retry loop structure) rather than from any provenance.
  No mention of product requirements, API rate-limiting, or why 3 retries was chosen.
```

### What the comparison shows

Both runs preserved behavior on this fixture. The difference is **why**:

| | With extension | Control (no extension) |
|---|---|---|
| Behavior preserved | yes | yes |
| Explicit design constraints | yes — prompts cite 429, backoff, retry count | no — inference from code only |
| Traceable intent | `.prompts` records the human *why* | none |

This fixture is mildly self-documenting (429 status checks, retry loop). dot-prompts adds value when:

- Code looks arbitrary or over-engineered without context
- Requirements aren't obvious from implementation (magic numbers, workarounds)
- An agent might "simplify" correctly today but wrongly tomorrow on a less obvious case

A harder footgun (e.g. retry count of 3 with no 429-specific branching, or a comment removed) would likely widen the gap between the two runs.

Core link extraction and ranked lookup are covered in `test/dot-prompts.test.ts`. This scenario is the manual integration validation.

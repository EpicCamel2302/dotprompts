import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { record } from "../src/core/record.js";
import { handlePromptsTrace } from "../src/pi/handlers.js";
import {
  handlePromptsChain,
  handlePromptsRead,
} from "../src/tools/handlers.js";

describe("tool handlers", () => {
  let promptsDir: string;

  beforeEach(() => {
    promptsDir = mkdtempSync(join(tmpdir(), "dot-prompts-handlers-"));
  });

  afterEach(() => {
    rmSync(promptsDir, { recursive: true, force: true });
  });

  it("prompts_read returns ranked matches", () => {
    record(
      {
        model: "test",
        prompt: "Keep retry count at 3",
        targets: [
          {
            path: "fetch.ts",
            links: [
              { type: "file" },
              {
                type: "symbol",
                name: "fetchWithRetry",
                kind: "function",
              },
            ],
          },
        ],
      },
      { promptsDir },
    );

    const result = handlePromptsRead(
      { path: "fetch.ts", symbol: "fetchWithRetry" },
      { promptsDir },
    );

    expect(result.text).toContain("Keep retry count at 3");
    expect(result.details.recordIds).toHaveLength(1);
  });

  it("prompts_chain walks referencedRecords", () => {
    const a = record(
      {
        model: "test",
        prompt: "Add retry for 429",
        targets: [
          { path: "a.ts", links: [{ type: "file" }] },
        ],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "Rename helper",
        targets: [
          { path: "a.ts", links: [{ type: "file" }] },
        ],
        metadata: { referencedRecords: [a.id] },
      },
      { promptsDir },
    );

    const result = handlePromptsChain({ recordId: b.id }, { promptsDir });
    expect(result.text).toContain("Add retry for 429");
    expect(result.text).toContain("Rename helper");
    expect(result.details.recordIds).toEqual([b.id, a.id]);
  });

  it("prompts_chain reports missing record ids", () => {
    const result = handlePromptsChain(
      { recordId: "00000000-0000-4000-8000-000000000000" },
      { promptsDir },
    );
    expect(result.text).toContain("No dot-prompts record found");
    expect(result.details.found).toBe(false);
  });

  it("prompts_trace falls back to stored prompt when session is missing", () => {
    const stored = record(
      {
        model: "test",
        prompt: "execute plan",
        targets: [
          { path: "x.ts", links: [{ type: "file" }] },
        ],
        metadata: {
          pi: {
            sessionFile: "/nonexistent/session.jsonl",
            userMessageId: "msg_missing",
          },
        },
      },
      { promptsDir },
    );

    const result = handlePromptsTrace(
      { recordId: stored.id },
      { promptsDir },
    );

    expect(result.text).toContain("execute plan");
    expect(result.details.recordIds).toEqual([stored.id]);
  });

  it("prompts_trace reports missing record", () => {
    const result = handlePromptsTrace(
      { recordId: "00000000-0000-4000-8000-000000000000" },
      { promptsDir },
    );
    expect(result.text).toContain("No dot-prompts record found");
    expect(result.details.found).toBe(false);
  });

  it("notifies onReadRecords for successful lookups", () => {
    record(
      {
        model: "test",
        prompt: "Keep retry count at 3",
        targets: [
          { path: "fetch.ts", links: [{ type: "file" }] },
        ],
      },
      { promptsDir },
    );

    const seen: string[] = [];
    handlePromptsRead(
      { path: "fetch.ts" },
      { promptsDir, onReadRecords: (ids) => seen.push(...ids) },
    );
    expect(seen).toHaveLength(1);
  });
});

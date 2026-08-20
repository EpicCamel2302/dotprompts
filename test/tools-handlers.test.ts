import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  handlePromptsChain,
  handlePromptsRead,
  handlePromptsTrace,
} from "../src/tools/handlers.js";
import { record } from "../src/record.js";

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
              { type: "file", path: "fetch.ts" },
              {
                type: "symbol",
                path: "fetch.ts",
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
          { path: "a.ts", links: [{ type: "file", path: "a.ts" }] },
        ],
      },
      { promptsDir },
    );

    const b = record(
      {
        model: "test",
        prompt: "Rename helper",
        targets: [
          { path: "a.ts", links: [{ type: "file", path: "a.ts" }] },
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
          { path: "x.ts", links: [{ type: "file", path: "x.ts" }] },
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
});

describe("resolvePromptsDirFromEnv", () => {
  it("reads --prompts-dir and DOT_PROMPTS_DIR", async () => {
    const { resolvePromptsDirFromEnv } = await import("../src/mcp/server.js");
    expect(resolvePromptsDirFromEnv(["--prompts-dir", "/tmp/a"], {})).toBe(
      "/tmp/a",
    );
    expect(
      resolvePromptsDirFromEnv(["--prompts-dir=/tmp/b"], {}),
    ).toBe("/tmp/b");
    expect(
      resolvePromptsDirFromEnv([], { DOT_PROMPTS_DIR: "/tmp/c" }),
    ).toBe("/tmp/c");
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { record } from "dot-prompts";
import { handlePromptsTrace } from "../src/handlers.js";

describe("prompts_trace handler", () => {
  let promptsDir: string;

  beforeEach(() => {
    promptsDir = mkdtempSync(join(tmpdir(), "dot-prompts-pi-handlers-"));
  });

  afterEach(() => {
    rmSync(promptsDir, { recursive: true, force: true });
  });

  it("falls back to stored prompt when session is missing", () => {
    const stored = record(
      {
        model: "test",
        prompt: "execute plan",
        targets: [{ path: "x.ts", links: [{ type: "file" }] }],
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

  it("reports missing record", () => {
    const result = handlePromptsTrace(
      { recordId: "00000000-0000-4000-8000-000000000000" },
      { promptsDir },
    );
    expect(result.text).toContain("No dot-prompts record found");
    expect(result.details.found).toBe(false);
  });
});

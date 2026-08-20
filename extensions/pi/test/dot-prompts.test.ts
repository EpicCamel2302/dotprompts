import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { list } from "dot-prompts";
import { HISTORY_COMMAND_MARKER } from "../commands.js";
import { createFakePi } from "./fake-pi.js";

const originalCwd = process.cwd();

async function loadExtension() {
  vi.resetModules();
  const mod = await import("../dot-prompts.ts");
  return mod.registerDotPromptsExtension;
}

describe("pi extension", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "dot-prompts-pi-ext-"));
    process.chdir(cwd);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(cwd, { recursive: true, force: true });
  });

  async function startExtension(prompt = "keep retries at 3") {
    const register = await loadExtension();
    const fake = createFakePi({ cwd, prompt });
    register(fake.api);
    await fake.emit("before_agent_start", { prompt });
    await fake.emit("agent_start");
    return fake;
  }

  it("records a successful edit with pi session metadata", async () => {
    const fake = await startExtension();
    mkdirSync(join(cwd, "src"));
    writeFileSync(join(cwd, "src/retry.ts"), "const n = 1;\n", "utf8");

    await fake.emit("tool_call", {
      toolCallId: "edit-1",
      toolName: "edit",
      input: {
        path: "src/retry.ts",
        edits: [{ oldText: "const n = 1;", newText: "const n = 3;" }],
      },
    });
    writeFileSync(join(cwd, "src/retry.ts"), "const n = 3;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-1",
      toolName: "edit",
      isError: false,
      input: { path: "src/retry.ts" },
      content: [],
      details: {
        patch: "@@ -1,1 +1,1 @@\n-const n = 1;\n+const n = 3;",
        firstChangedLine: 1,
      },
    });

    const records = list();
    expect(records).toHaveLength(1);
    expect(records[0]?.prompt).toBe("keep retries at 3");
    expect(records[0]?.model).toBe("test/model");
    expect(records[0]?.metadata).toMatchObject({
      harness: "pi",
      tool: "edit",
      pi: {
        sessionId: "session-1",
        sessionFile: "/tmp/fake-session.jsonl",
        userMessageId: "um-1",
        toolCallId: "edit-1",
        leafId: "leaf-1",
      },
    });
    expect(records[0]?.targets[0]?.path).toBe("src/retry.ts");
  });

  it("records a successful write", async () => {
    const fake = await startExtension("create retry.ts");
    await fake.emit("tool_result", {
      toolCallId: "write-1",
      toolName: "write",
      isError: false,
      input: { path: "src/retry.ts", content: "export const n = 3;\n" },
      content: [],
    });

    const records = list();
    expect(records).toHaveLength(1);
    expect(records[0]?.metadata).toMatchObject({
      harness: "pi",
      tool: "write",
      pi: { toolCallId: "write-1" },
    });
  });

  it("skips auto-record for /prompts history turns", async () => {
    const prompt = `${HISTORY_COMMAND_MARKER}\nSummarize src/retry.ts`;
    const fake = await startExtension(prompt);
    writeFileSync(join(cwd, "retry.ts"), "const n = 1;\n", "utf8");

    await fake.emit("tool_call", {
      toolCallId: "edit-h",
      toolName: "edit",
      input: { path: "retry.ts" },
    });
    writeFileSync(join(cwd, "retry.ts"), "const n = 3;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-h",
      toolName: "edit",
      isError: false,
      input: { path: "retry.ts" },
      content: [],
    });

    expect(list()).toHaveLength(0);
  });

  it("appends a [dot-prompts] notice on read when history matches", async () => {
    const fake = await startExtension();
    writeFileSync(join(cwd, "retry.ts"), "const n = 1;\n", "utf8");
    await fake.emit("tool_call", {
      toolCallId: "edit-1",
      toolName: "edit",
      input: { path: "retry.ts" },
    });
    writeFileSync(join(cwd, "retry.ts"), "const n = 3;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-1",
      toolName: "edit",
      isError: false,
      input: { path: "retry.ts" },
      content: [],
    });

    const result = await fake.emit("tool_result", {
      toolCallId: "read-1",
      toolName: "read",
      isError: false,
      input: { path: "retry.ts", offset: 1, limit: 10 },
      content: [{ type: "text", text: "1| const n = 3;" }],
    });

    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining("[dot-prompts]"),
        },
      ],
    });
    expect((result as { content: Array<{ text: string }> }).content[0]?.text).toContain(
      "1| const n = 3;",
    );
  });

  it("stores referencedRecords from prompts_read on the next edit", async () => {
    const fake = await startExtension();
    writeFileSync(join(cwd, "retry.ts"), "const n = 1;\n", "utf8");
    await fake.emit("tool_call", {
      toolCallId: "edit-1",
      toolName: "edit",
      input: { path: "retry.ts" },
    });
    writeFileSync(join(cwd, "retry.ts"), "const n = 3;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-1",
      toolName: "edit",
      isError: false,
      input: { path: "retry.ts" },
      content: [],
    });

    const first = list()[0];
    expect(first).toBeDefined();

    const readTool = fake.tools.get("prompts_read");
    const readResult = await readTool?.execute(
      "tool-read",
      { path: "retry.ts" },
      undefined,
      undefined,
      fake.ctx,
    );
    expect(readResult?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("keep retries at 3") }),
      ]),
    );

    await fake.emit("tool_call", {
      toolCallId: "edit-2",
      toolName: "edit",
      input: { path: "retry.ts" },
    });
    writeFileSync(join(cwd, "retry.ts"), "const n = 5;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-2",
      toolName: "edit",
      isError: false,
      input: { path: "retry.ts" },
      content: [],
    });

    const second = list().find((record) => record.id !== first?.id);
    expect(second?.metadata?.referencedRecords).toEqual([first?.id]);
  });

  it("registers read, chain, and trace tools", async () => {
    const fake = await startExtension();
    expect([...fake.tools.keys()].sort()).toEqual([
      "prompts_chain",
      "prompts_read",
      "prompts_trace",
    ]);
  });
});

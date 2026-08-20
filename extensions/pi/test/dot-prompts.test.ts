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

  async function endGeneration(fake: Awaited<ReturnType<typeof startExtension>>) {
    await fake.emit("agent_end");
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

    await endGeneration(fake);

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

    await endGeneration(fake);

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

    await endGeneration(fake);
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
    await endGeneration(fake);

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
    await endGeneration(fake);

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
    await endGeneration(fake);

    const second = list().find((record) => record.id !== first?.id);
    expect(second?.metadata?.referencedRecords).toEqual([first?.id]);
  });


  it("coalesces multiple edits of the same file into one record (last-edit wins)", async () => {
    const fake = await startExtension("tweak retry.ts");
    writeFileSync(join(cwd, "retry.ts"), "const n = 1;\n", "utf8");

    await fake.emit("tool_call", {
      toolCallId: "edit-1",
      toolName: "edit",
      input: { path: "retry.ts" },
    });
    writeFileSync(join(cwd, "retry.ts"), "const n = 2;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-1",
      toolName: "edit",
      isError: false,
      input: { path: "retry.ts" },
      content: [],
      details: {
        patch: "@@ -1,1 +1,1 @@\n-const n = 1;\n+const n = 2;",
        firstChangedLine: 1,
      },
    });

    await fake.emit("tool_call", {
      toolCallId: "edit-2",
      toolName: "edit",
      input: { path: "retry.ts" },
    });
    writeFileSync(join(cwd, "retry.ts"), "const n = 3;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-2",
      toolName: "edit",
      isError: false,
      input: { path: "retry.ts" },
      content: [],
      details: {
        patch: "@@ -1,1 +1,1 @@\n-const n = 2;\n+const n = 3;",
        firstChangedLine: 1,
      },
    });

    await endGeneration(fake);
    const records = list();
    expect(records).toHaveLength(1);
    expect(records[0]?.targets).toHaveLength(1);
    expect(records[0]?.targets[0]?.path).toBe("retry.ts");
    expect(records[0]?.metadata).toMatchObject({
      tool: "edit",
      pi: { toolCallId: "edit-2", toolCallIds: ["edit-1", "edit-2"] },
    });
  });

  it("coalesces multi-file edits into one record with multiple targets", async () => {
    const fake = await startExtension("update a and b");
    writeFileSync(join(cwd, "a.ts"), "export const a = 1;\n", "utf8");
    writeFileSync(join(cwd, "b.ts"), "export const b = 1;\n", "utf8");

    await fake.emit("tool_call", {
      toolCallId: "edit-a",
      toolName: "edit",
      input: { path: "a.ts" },
    });
    writeFileSync(join(cwd, "a.ts"), "export const a = 2;\n", "utf8");
    await fake.emit("tool_result", {
      toolCallId: "edit-a",
      toolName: "edit",
      isError: false,
      input: { path: "a.ts" },
      content: [],
      details: { patch: "@@ -1,1 +1,1 @@\n-export const a = 1;\n+export const a = 2;", firstChangedLine: 1 },
    });

    await fake.emit("tool_result", {
      toolCallId: "write-b",
      toolName: "write",
      isError: false,
      input: { path: "b.ts", content: "export const b = 2;\n" },
      content: [],
    });

    await endGeneration(fake);
    const records = list();
    expect(records).toHaveLength(1);
    expect(records[0]?.targets.map((t) => t.path).sort()).toEqual(["a.ts", "b.ts"]);
    expect(records[0]?.metadata).toMatchObject({
      tool: "write",
      tools: ["edit", "write"],
      pi: { toolCallId: "write-b", toolCallIds: ["edit-a", "write-b"] },
    });
  });

  it("registers read, chain, and trace tools", async () => {
    const fake = await startExtension();
    expect([...fake.tools.keys()].sort()).toEqual([
      "prompts_chain",
      "prompts_read",
      "prompts_trace",
    ]);
  });

  it("skips failed tool results and does not record them", async () => {
    const fake = await startExtension("edit that fails");
    mkdirSync(join(cwd, "src"));
    writeFileSync(join(cwd, "src/retry.ts"), "const n = 1;\n", "utf8");

    await fake.emit("tool_call", {
      toolCallId: "edit-fail",
      toolName: "edit",
      input: { path: "src/retry.ts", edits: [] },
    });
    await fake.emit("tool_result", {
      toolCallId: "edit-fail",
      toolName: "edit",
      isError: true,
      input: { path: "src/retry.ts" },
      content: [],
      details: { patch: "@@ -1,1 +1,1 @@\n-a\n+b" },
    });

    await endGeneration(fake);
    expect(list()).toHaveLength(0);
  });

  it("flushes buffered edits on session_shutdown", async () => {
    const fake = await startExtension("flush on shutdown");
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

    await fake.emit("session_shutdown");
    const records = list();
    expect(records).toHaveLength(1);
    expect(records[0]?.prompt).toBe("flush on shutdown");
  });

  it("does not append a notice when read has no matches", async () => {
    const fake = await startExtension();
    writeFileSync(join(cwd, "empty.ts"), "export {};\n", "utf8");
    const result = await fake.emit("tool_result", {
      toolCallId: "read-1",
      toolName: "read",
      isError: false,
      input: { path: "empty.ts" },
      content: [{ type: "text", text: "export {};" }],
    });
    expect(result).toBeUndefined();
  });
});

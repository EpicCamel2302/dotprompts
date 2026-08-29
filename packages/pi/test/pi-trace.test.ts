import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  formatRecordOnlyFallback,
  getPiMetadata,
  loadPiSessionEntries,
  parsePiSessionFile,
  tracePiSession,
} from "../src/pi/trace.js";

const sampleSession = [
  '{"type":"session","id":"sess1","timestamp":"2026-08-20T10:00:00.000Z","cwd":"/proj"}',
  '{"type":"message","id":"msg1","parentId":null,"timestamp":"2026-08-20T10:00:01.000Z","message":{"role":"user","content":[{"type":"text","text":"Create a retry plan for 429 responses"}]}}',
  '{"type":"message","id":"msg2","parentId":"msg1","timestamp":"2026-08-20T10:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"I will add fetchWithRetry with 3 attempts."},{"type":"toolCall","name":"edit","arguments":{"path":"fetch.ts"}}]}}',
  '{"type":"compaction","id":"cmp1","parentId":"msg2","summary":"Compacted earlier turns"}',
  '{"type":"branch_summary","id":"br1","parentId":"cmp1","summary":"Branch note"}',
  '{"type":"message","id":"msg3","parentId":"br1","timestamp":"2026-08-20T10:00:03.000Z","message":{"role":"user","content":[{"type":"text","text":"execute plan"}]}}',
].join("\n");

describe("pi session trace", () => {
  it("parses pi session JSONL entries", () => {
    const entries = parsePiSessionFile(sampleSession);
    expect(entries).toHaveLength(5);
    expect(entries[0]?.id).toBe("msg1");
  });

  it("falls back when session file is missing on disk", () => {
    const trace = tracePiSession({
      sessionFile: "/tmp/nonexistent-fake.session",
      userMessageId: "msg3",
      prompt: "execute plan",
    });

    expect(trace.source).toBe("record-only");
    expect(trace.sessionAvailable).toBe(false);
    expect(trace.text).toContain("execute plan");
  });

  it("falls back when no session file was recorded", () => {
    const trace = tracePiSession({ prompt: "execute plan" });
    expect(trace.source).toBe("record-only");
    expect(trace.text).toContain("No pi session file was recorded");
  });

  it("formats record-only fallback with reason", () => {
    const text = formatRecordOnlyFallback({
      reason: "Session file not found",
      prompt: "execute plan",
      recordId: "abc",
      sessionId: "sess1",
    });
    expect(text).toContain("Session trace unavailable locally");
    expect(text).toContain("execute plan");
    expect(text).toContain("abc");
  });

  it("reads pi metadata pointers", () => {
    expect(
      getPiMetadata({
        pi: {
          sessionFile: "/tmp/s.jsonl",
          sessionId: "s1",
          userMessageId: "u1",
        },
      }),
    ).toMatchObject({
      sessionFile: "/tmp/s.jsonl",
      sessionId: "s1",
      userMessageId: "u1",
    });
    expect(getPiMetadata({})).toBeNull();
  });

  it("returns null for corrupt session files", () => {
    const dir = mkdtempSync(join(tmpdir(), "dot-prompts-pi-bad-"));
    const sessionFile = join(dir, "bad.session");
    writeFileSync(sessionFile, "{not-json\n", "utf8");
    try {
      expect(loadPiSessionEntries(sessionFile)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("trace with temp session file", () => {
  it("loads session file and traces branch to user message", () => {
    const dir = mkdtempSync(join(tmpdir(), "dot-prompts-pi-"));
    const sessionFile = join(dir, "test.session");
    writeFileSync(sessionFile, sampleSession, "utf8");

    try {
      const trace = tracePiSession({
        sessionFile,
        userMessageId: "msg3",
        prompt: "execute plan",
      });

      expect(trace.source).toBe("session");
      expect(trace.sessionAvailable).toBe(true);
      expect(trace.text).toContain("execute plan");
      expect(trace.text).toContain("Create a retry plan");
      expect(trace.text).toContain("[tool] edit");
      expect(trace.text).toContain("## compaction");
      expect(trace.text).toContain("## branch_summary");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("trims long branches with maxEntries and falls back without user anchors", () => {
    const dir = mkdtempSync(join(tmpdir(), "dot-prompts-pi-trim-"));
    const sessionFile = join(dir, "test.session");
    writeFileSync(sessionFile, sampleSession, "utf8");
    const emptySession = join(dir, "empty.session");
    writeFileSync(
      emptySession,
      '{"type":"session","id":"s","cwd":"/proj"}\n',
      "utf8",
    );

    try {
      const trimmed = tracePiSession({
        sessionFile,
        userMessageId: "msg3",
        maxEntries: 2,
      });
      expect(trimmed.source).toBe("session");
      expect(trimmed.text).toContain("execute plan");
      expect(trimmed.text).not.toContain("Create a retry plan");

      const noAnchor = tracePiSession({ sessionFile: emptySession });
      expect(noAnchor.source).toBe("record-only");
      expect(noAnchor.text).toContain("no user message anchor");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  capturePiMetadata,
  findLatestUserMessageId,
} from "../session-capture.js";
import { createFakePi } from "./fake-pi.js";

describe("findLatestUserMessageId", () => {
  it("prefers the branch entry whose text matches the prompt", () => {
    const fake = createFakePi({
      cwd: "/tmp",
      branch: [
        {
          type: "message",
          id: "older",
          message: {
            role: "user",
            content: [{ type: "text", text: "first prompt" }],
          },
        },
        {
          type: "message",
          id: "newer",
          message: {
            role: "user",
            content: [{ type: "text", text: "keep retries at 3" }],
          },
        },
      ],
    });

    expect(
      findLatestUserMessageId(fake.sessionManager as never, "keep retries at 3"),
    ).toBe("newer");
  });

  it("falls back to the latest user message when no text matches", () => {
    const fake = createFakePi({
      cwd: "/tmp",
      branch: [
        {
          type: "message",
          id: "only",
          message: {
            role: "user",
            content: [{ type: "text", text: "something else" }],
          },
        },
      ],
    });

    expect(
      findLatestUserMessageId(fake.sessionManager as never, "keep retries at 3"),
    ).toBe("only");
  });
});

describe("capturePiMetadata", () => {
  it("copies session pointers from the session manager", () => {
    const fake = createFakePi({
      cwd: "/tmp",
      sessionId: "sess-9",
      sessionFile: "/tmp/sess.jsonl",
      leafId: "leaf-9",
    });

    expect(
      capturePiMetadata(fake.sessionManager as never, "tc-1", "um-1"),
    ).toEqual({
      sessionId: "sess-9",
      sessionFile: "/tmp/sess.jsonl",
      userMessageId: "um-1",
      toolCallId: "tc-1",
      leafId: "leaf-9",
    });
  });
});

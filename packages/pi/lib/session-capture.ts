import type { ReadonlySessionManager } from "@earendil-works/pi-coding-agent";
import type { PiSessionMetadata } from "dot-prompts/pi";

type SessionEntry = {
  type: string;
  id: string;
  message?: {
    role?: string;
    content?: unknown;
  };
};

function extractUserText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter(
      (part): part is { type: string; text: string } =>
        !!part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: string }).text === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function findLatestUserMessageId(
  sessionManager: ReadonlySessionManager,
  prompt?: string | null,
): string | undefined {
  const branch = sessionManager.getBranch() as SessionEntry[];

  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type !== "message" || entry.message?.role !== "user") {
      continue;
    }
    const text = extractUserText(entry.message.content);
    if (prompt && text === prompt.trim()) {
      return entry.id;
    }
  }

  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type === "message" && entry.message?.role === "user") {
      return entry.id;
    }
  }

  return undefined;
}

export function capturePiMetadata(
  sessionManager: ReadonlySessionManager,
  toolCallId: string,
  userMessageId?: string,
): PiSessionMetadata {
  return {
    sessionId: sessionManager.getSessionId(),
    sessionFile: sessionManager.getSessionFile(),
    userMessageId,
    toolCallId,
    leafId: sessionManager.getLeafId() ?? undefined,
  };
}

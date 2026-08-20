import { existsSync, readFileSync } from "node:fs";
import type { PiSessionEntry, PiTraceResult } from "./types.js";

type ContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  thinking?: string;
};

export function parsePiSessionFile(content: string): PiSessionEntry[] {
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PiSessionEntry)
    .filter((entry) => entry.type !== "session");
}

export function loadPiSessionEntries(sessionFile: string): PiSessionEntry[] | null {
  if (!existsSync(sessionFile)) {
    return null;
  }
  try {
    return parsePiSessionFile(readFileSync(sessionFile, "utf8"));
  } catch {
    return null;
  }
}

function extractTextParts(content: unknown): string[] {
  if (typeof content === "string") {
    return [content];
  }
  if (!Array.isArray(content)) {
    return [];
  }

  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }
    const block = part as ContentBlock;
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
    if (block.type === "thinking" && typeof block.thinking === "string") {
      parts.push(`[thinking] ${block.thinking}`);
    }
  }
  return parts;
}

function extractToolCallLines(content: unknown): string[] {
  if (!Array.isArray(content)) {
    return [];
  }

  const lines: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }
    const block = part as ContentBlock;
    if (block.type === "toolCall" && typeof block.name === "string") {
      lines.push(
        `[tool] ${block.name}(${JSON.stringify(block.arguments ?? {})})`,
      );
    }
  }
  return lines;
}

function formatMessageEntry(entry: PiSessionEntry): string | null {
  if (entry.type !== "message" || !entry.message?.role) {
    return null;
  }

  const role = entry.message.role;
  const lines: string[] = [`## ${role} (${entry.id})`];

  if (role === "user" || role === "assistant") {
    const text = extractTextParts(entry.message.content).join("\n").trim();
    if (text.length > 0) {
      lines.push(text);
    }
    if (role === "assistant") {
      lines.push(...extractToolCallLines(entry.message.content));
    }
  }

  if (role === "toolResult") {
    const text = extractTextParts(entry.message.content).join("\n").trim();
    if (text.length > 0) {
      lines.push(text.slice(0, 2000));
    }
  }

  return lines.length > 1 ? lines.join("\n") : null;
}

function buildBranchToEntry(
  entries: PiSessionEntry[],
  targetId: string,
): PiSessionEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const branch: PiSessionEntry[] = [];
  let current = byId.get(targetId);

  while (current) {
    branch.unshift(current);
    current =
      current.parentId !== null ? byId.get(current.parentId) : undefined;
  }

  return branch;
}

function formatBranchContext(branch: PiSessionEntry[], anchorId: string): string {
  const sections: string[] = [];
  let anchorFound = false;

  for (const entry of branch) {
    if (entry.type === "compaction" && typeof entry.summary === "string") {
      sections.push(`## compaction (${entry.id})\n${entry.summary}`);
      continue;
    }

    if (entry.type === "branch_summary" && typeof entry.summary === "string") {
      sections.push(`## branch_summary (${entry.id})\n${entry.summary}`);
      continue;
    }

    const formatted = formatMessageEntry(entry);
    if (formatted) {
      sections.push(formatted);
    }

    if (entry.id === anchorId) {
      anchorFound = true;
    }
  }

  if (!anchorFound) {
    sections.push(`(anchor entry ${anchorId} not found on branch)`);
  }

  return sections.join("\n\n");
}

export type TracePiSessionOptions = {
  sessionFile?: string;
  userMessageId?: string;
  prompt?: string;
  timestamp?: string;
  model?: string;
  recordId?: string;
  maxEntries?: number;
};

export function formatRecordOnlyFallback(opts: {
  prompt?: string;
  timestamp?: string;
  model?: string;
  recordId?: string;
  sessionId?: string;
  sessionFile?: string;
  reason: string;
}): string {
  const lines = [
    "Session trace unavailable locally.",
    `Reason: ${opts.reason}`,
    "",
    "Record fallback:",
  ];

  if (opts.recordId) {
    lines.push(`- record id: ${opts.recordId}`);
  }
  if (opts.timestamp) {
    lines.push(`- timestamp: ${opts.timestamp}`);
  }
  if (opts.model) {
    lines.push(`- model: ${opts.model}`);
  }
  if (opts.sessionId) {
    lines.push(`- pi session id: ${opts.sessionId}`);
  }
  if (opts.sessionFile) {
    lines.push(`- pi session file (missing): ${opts.sessionFile}`);
  }
  if (opts.prompt) {
    lines.push("", "Prompt text:", opts.prompt);
  }

  lines.push(
    "",
    "The stored prompt is the portable provenance. Full pi session history is only available on the machine where the session file exists.",
  );

  return lines.join("\n");
}

export function tracePiSession(opts: TracePiSessionOptions): PiTraceResult {
  const fallbackBase = {
    prompt: opts.prompt,
    timestamp: opts.timestamp,
    model: opts.model,
    recordId: opts.recordId,
    sessionFile: opts.sessionFile,
  };

  if (!opts.sessionFile) {
    return {
      source: "record-only",
      sessionAvailable: false,
      text: formatRecordOnlyFallback({
        ...fallbackBase,
        reason: "No pi session file was recorded (ephemeral or unavailable session).",
      }),
    };
  }

  const entries = loadPiSessionEntries(opts.sessionFile);
  if (!entries) {
    return {
      source: "record-only",
      sessionAvailable: false,
      sessionFile: opts.sessionFile,
      text: formatRecordOnlyFallback({
        ...fallbackBase,
        reason: `Session file not found at ${opts.sessionFile}.`,
      }),
    };
  }

  const anchorId =
    opts.userMessageId ??
    [...entries]
      .reverse()
      .find(
        (entry) =>
          entry.type === "message" && entry.message?.role === "user",
      )?.id;

  if (!anchorId) {
    return {
      source: "record-only",
      sessionAvailable: false,
      sessionFile: opts.sessionFile,
      text: formatRecordOnlyFallback({
        ...fallbackBase,
        reason: "Session file exists but no user message anchor was found.",
      }),
    };
  }

  let branch = buildBranchToEntry(entries, anchorId);
  const maxEntries = opts.maxEntries ?? 20;
  if (branch.length > maxEntries) {
    branch = branch.slice(-maxEntries);
  }

  const context = formatBranchContext(branch, anchorId);

  return {
    source: "session",
    sessionAvailable: true,
    sessionFile: opts.sessionFile,
    userMessageId: anchorId,
    text: [
      `Pi session trace from ${opts.sessionFile}`,
      `Anchor user message: ${anchorId}`,
      "",
      context,
    ].join("\n"),
  };
}

export function getPiMetadata(
  metadata: Record<string, unknown> | undefined,
): {
  sessionId?: string;
  sessionFile?: string;
  userMessageId?: string;
  toolCallId?: string;
  leafId?: string;
} | null {
  if (!metadata || typeof metadata.pi !== "object" || metadata.pi === null) {
    return null;
  }
  const pi = metadata.pi as Record<string, unknown>;
  return {
    sessionId: typeof pi.sessionId === "string" ? pi.sessionId : undefined,
    sessionFile:
      typeof pi.sessionFile === "string" ? pi.sessionFile : undefined,
    userMessageId:
      typeof pi.userMessageId === "string" ? pi.userMessageId : undefined,
    toolCallId: typeof pi.toolCallId === "string" ? pi.toolCallId : undefined,
    leafId: typeof pi.leafId === "string" ? pi.leafId : undefined,
  };
}

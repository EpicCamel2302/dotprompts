/** Pi session pointers stored in record metadata (metadata.pi). */
export type PiSessionMetadata = {
  sessionId: string;
  sessionFile?: string;
  userMessageId?: string;
  toolCallId?: string;
  leafId?: string;
};

export type PiSessionEntry = {
  type: string;
  id: string;
  parentId: string | null;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
  summary?: string;
  customType?: string;
  content?: unknown;
};

export type PiTraceResult = {
  source: "session" | "record-only";
  sessionAvailable: boolean;
  sessionFile?: string;
  userMessageId?: string;
  text: string;
};

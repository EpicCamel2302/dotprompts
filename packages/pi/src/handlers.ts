import {
  get,
  type ToolHandlerOptions,
  type ToolHandlerResult,
} from "dot-prompts";
import { formatRecordOnlyFallback, getPiMetadata, tracePiSession } from "./trace.js";

export type PromptsTraceParams = {
  recordId?: string;
  sessionFile?: string;
  userMessageId?: string;
  maxEntries?: number;
};

export function handlePromptsTrace(
  params: PromptsTraceParams,
  opts: ToolHandlerOptions = {},
): ToolHandlerResult {
  let sessionFile = params.sessionFile;
  let userMessageId = params.userMessageId;
  let prompt: string | undefined;
  let timestamp: string | undefined;
  let model: string | undefined;
  let recordId = params.recordId;

  try {
    if (params.recordId) {
      const stored = get(params.recordId, opts);
      if (!stored) {
        return {
          text: `No dot-prompts record found for id ${params.recordId}.`,
          details: { found: false },
        };
      }

      prompt = stored.prompt;
      timestamp = stored.timestamp;
      model = stored.model;
      const piMeta = getPiMetadata(stored.metadata);
      sessionFile = sessionFile ?? piMeta?.sessionFile;
      userMessageId = userMessageId ?? piMeta?.userMessageId;
      recordId = stored.id;
      if (recordId) {
        opts.onReadRecords?.([recordId]);
      }
    }

    const trace = tracePiSession({
      sessionFile,
      userMessageId,
      prompt,
      timestamp,
      model,
      recordId,
      maxEntries: params.maxEntries,
    });

    return {
      text: trace.text,
      details: {
        ...trace,
        ...(recordId ? { recordIds: [recordId] } : {}),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: formatRecordOnlyFallback({
        prompt,
        timestamp,
        model,
        recordId,
        sessionFile,
        reason: `prompts_trace could not load the pi session (${message}). Portable prompt text from .prompts/ is shown instead.`,
      }),
      details: {
        error: true,
        tool: "prompts_trace",
        message,
        ...(recordId ? { recordIds: [recordId] } : {}),
      },
    };
  }
}

import {
  collectProvenanceChain,
  formatProvenanceChainForAgent,
} from "../provenance/chain.js";
import { formatLookupForAgent } from "../links/extract.js";
import {
  formatRecordOnlyFallback,
  getPiMetadata,
  tracePiSession,
} from "../pi/trace.js";
import { get, lookup } from "../query.js";

export type ToolHandlerResult = {
  text: string;
  details: Record<string, unknown>;
};

export type ToolHandlerOptions = {
  promptsDir?: string;
};

export type PromptsReadParams = {
  path: string;
  startLine?: number;
  endLine?: number;
  symbol?: string;
  limit?: number;
};

export type PromptsChainParams = {
  recordId: string;
  maxDepth?: number;
  maxRecords?: number;
};

export type PromptsTraceParams = {
  recordId?: string;
  sessionFile?: string;
  userMessageId?: string;
  maxEntries?: number;
};

function errorText(toolName: string, error: unknown, extra?: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return [
    `${toolName} failed internally (${message}).`,
    extra ??
      "Use prompts_read for portable prompt text, or read `.prompts/records/` if you already have a record id.",
  ].join("\n");
}

export function handlePromptsRead(
  params: PromptsReadParams,
  opts: ToolHandlerOptions = {},
): ToolHandlerResult {
  try {
    const result = lookup(
      {
        path: params.path,
        startLine: params.startLine,
        endLine: params.endLine,
        symbol: params.symbol,
      },
      {
        promptsDir: opts.promptsDir,
        limit: params.limit ?? 5,
        minConfidence: 0.4,
      },
    );

    return {
      text: formatLookupForAgent(result.matches),
      details: {
        matches: result.matches,
        recordIds: result.matches.map((match) => match.record.id),
      },
    };
  } catch (error) {
    return {
      text: errorText("prompts_read", error),
      details: {
        error: true,
        tool: "prompts_read",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function handlePromptsChain(
  params: PromptsChainParams,
  opts: ToolHandlerOptions = {},
): ToolHandlerResult {
  try {
    const result = collectProvenanceChain([params.recordId], {
      promptsDir: opts.promptsDir,
      maxDepth: params.maxDepth,
      maxRecords: params.maxRecords,
    });

    if (result.entries.length === 0) {
      return {
        text: `No dot-prompts record found for id ${params.recordId}.`,
        details: { found: false, recordId: params.recordId },
      };
    }

    return {
      text: formatProvenanceChainForAgent(result),
      details: {
        ...result,
        recordIds: result.entries.map((entry) => entry.record.id),
      },
    };
  } catch (error) {
    const stored = get(params.recordId, { promptsDir: opts.promptsDir });
    if (stored) {
      return {
        text: formatRecordOnlyFallback({
          prompt: stored.prompt,
          timestamp: stored.timestamp,
          model: stored.model,
          recordId: stored.id,
          reason:
            "prompts_chain failed while walking referencedRecords. Showing this record only — older intent may still exist via metadata.referencedRecords on the JSON in .prompts/records/.",
        }),
        details: {
          error: true,
          tool: "prompts_chain",
          message: error instanceof Error ? error.message : String(error),
          recordIds: [stored.id],
        },
      };
    }

    return {
      text: errorText("prompts_chain", error),
      details: {
        error: true,
        tool: "prompts_chain",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

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
      const stored = get(params.recordId, { promptsDir: opts.promptsDir });
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

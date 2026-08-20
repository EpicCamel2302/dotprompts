import { get } from "../core/query.js";
import type { StoreOptions } from "../core/storage.js";
import { formatLookupForAgent } from "../links/extract.js";
import {
  collectProvenanceChain,
  formatProvenanceChainForAgent,
} from "../provenance/chain.js";
import { lookup } from "../core/query.js";
import { formatRecordFallback, toolErrorText } from "./format.js";

export type ToolHandlerResult = {
  text: string;
  details: Record<string, unknown>;
};

export type ToolHandlerOptions = StoreOptions & {
  onReadRecords?: (ids: string[]) => void;
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

function noteRecords(
  opts: ToolHandlerOptions,
  ids: Array<string | undefined>,
): void {
  const clean = ids.filter((id): id is string => Boolean(id));
  if (clean.length > 0) {
    opts.onReadRecords?.(clean);
  }
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
        storage: opts.storage,
        cwd: opts.cwd,
        limit: params.limit ?? 5,
        minConfidence: 0.4,
      },
    );

    const recordIds = result.matches.map((match) => match.record.id);
    noteRecords(opts, recordIds);

    return {
      text: formatLookupForAgent(result.matches),
      details: {
        matches: result.matches,
        recordIds,
      },
    };
  } catch (error) {
    return {
      text: toolErrorText("prompts_read", error),
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
      storage: opts.storage,
      cwd: opts.cwd,
      maxDepth: params.maxDepth,
      maxRecords: params.maxRecords,
    });

    if (result.entries.length === 0) {
      return {
        text: `No dot-prompts record found for id ${params.recordId}.`,
        details: { found: false, recordId: params.recordId },
      };
    }

    const recordIds = result.entries.map((entry) => entry.record.id);
    noteRecords(opts, recordIds);

    return {
      text: formatProvenanceChainForAgent(result),
      details: {
        ...result,
        recordIds,
      },
    };
  } catch (error) {
    const stored = get(params.recordId, opts);
    if (stored) {
      noteRecords(opts, [stored.id]);
      return {
        text: formatRecordFallback({
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
      text: toolErrorText("prompts_chain", error),
      details: {
        error: true,
        tool: "prompts_chain",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

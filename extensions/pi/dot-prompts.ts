/**
 * dot-prompts pi extension
 *
 * - Auto-records provenance after edit/write tool calls (with pi session metadata)
 * - Appends [dot-prompts] notices to read tool results
 * - Registers prompts_read, prompts_chain, and prompts_trace for opt-in context fetch
 * - Slash commands: /prompts history <file>
 *
 * Usage: pi -e ./extensions/pi/dot-prompts.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import {
  collectProvenanceChain,
  extractLinksFromEdit,
  extractLinksFromWrite,
  formatLookupForAgent,
  formatLookupNotice,
  formatProvenanceChainForAgent,
  formatRecordOnlyFallback,
  get,
  getPiMetadata,
  lookup,
  lookupForReadRange,
  record,
  tracePiSession,
} from "dot-prompts";
import {
  capturePiMetadata,
  findLatestUserMessageId,
} from "./session-capture.js";
import {
  isHistorySummarizePrompt,
  registerPromptsCommands,
} from "./commands.js";

let currentPrompt: string | null = null;
let currentUserMessageId: string | undefined;
let currentModel = "unknown";
const contentBeforeEdit = new Map<string, string>();
/** Record ids fetched via prompts_read / prompts_trace this user turn. */
const referencedRecordIds = new Set<string>();

function noteReferencedRecords(...ids: Array<string | undefined>): void {
  for (const id of ids) {
    if (id) {
      referencedRecordIds.add(id);
    }
  }
}

function toolFailure(toolName: string, error: unknown, extra?: string): {
  content: Array<{ type: "text"; text: string }>;
  details: { error: true; tool: string; message: string };
} {
  const message = error instanceof Error ? error.message : String(error);
  const lines = [
    `${toolName} failed internally (${message}).`,
    extra ??
      "Use prompts_read for portable prompt text, or read `.prompts/records/` if you already have a record id.",
  ];
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: { error: true, tool: toolName, message },
  };
}

function modelSlug(ctx: { model?: { provider?: string; id?: string } }): string {
  if (ctx.model?.provider && ctx.model?.id) {
    return `${ctx.model.provider}/${ctx.model.id}`;
  }
  return currentModel;
}

function buildRecordMetadata(
  ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1],
  tool: "edit" | "write",
  toolCallId: string,
) {
  const pi = capturePiMetadata(
    ctx.sessionManager,
    toolCallId,
    currentUserMessageId,
  );
  const refs = [...referencedRecordIds];
  return {
    harness: "pi",
    tool,
    pi,
    ...(refs.length > 0 ? { referencedRecords: refs } : {}),
  };
}

export default function (pi: ExtensionAPI) {
  registerPromptsCommands(pi);

  pi.on("before_agent_start", async (event) => {
    currentPrompt = event.prompt;
  });

  pi.on("agent_start", async (_event, ctx) => {
    referencedRecordIds.clear();
    currentModel = modelSlug(ctx);
    currentUserMessageId = findLatestUserMessageId(
      ctx.sessionManager,
      currentPrompt,
    );
  });

  pi.on("turn_start", async (_event, ctx) => {
    currentModel = modelSlug(ctx);
  });

  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("edit", event)) {
      try {
        const absolutePath = resolve(ctx.cwd, event.input.path);
        contentBeforeEdit.set(
          event.toolCallId,
          readFileSync(absolutePath, "utf8"),
        );
      } catch {
        contentBeforeEdit.delete(event.toolCallId);
      }
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.isError || !currentPrompt) {
      return;
    }

    if (isToolCallEventType("edit", event)) {
      const details = event.details as
        | { patch?: string; firstChangedLine?: number }
        | undefined;
      const before = contentBeforeEdit.get(event.toolCallId);
      contentBeforeEdit.delete(event.toolCallId);

      if (isHistorySummarizePrompt(currentPrompt)) {
        return;
      }

      const target = extractLinksFromEdit({
        cwd: ctx.cwd,
        path: event.input.path,
        patch: details?.patch,
        firstChangedLine: details?.firstChangedLine,
        contentBefore: before,
      });

      record({
        model: modelSlug(ctx),
        prompt: currentPrompt,
        targets: [target],
        metadata: buildRecordMetadata(ctx, "edit", event.toolCallId),
      });
      return;
    }

    if (isToolCallEventType("write", event)) {
      if (isHistorySummarizePrompt(currentPrompt)) {
        return;
      }
      const lineCount = event.input.content.split("\n").length;
      const target = extractLinksFromWrite({
        cwd: ctx.cwd,
        path: event.input.path,
        lineCount,
      });

      record({
        model: modelSlug(ctx),
        prompt: currentPrompt,
        targets: [target],
        metadata: buildRecordMetadata(ctx, "write", event.toolCallId),
      });
      return;
    }

    if (isToolCallEventType("read", event)) {
      const { path, offset, limit } = event.input;
      const result = lookupForReadRange(path, offset, limit, {
        minConfidence: 0.4,
        limit: 5,
      });

      if (result.matches.length === 0) {
        return;
      }

      const startLine = offset ?? 1;
      const endLine =
        limit !== undefined ? startLine + limit - 1 : undefined;
      const notice = formatLookupNotice(
        result.matches.length,
        startLine,
        endLine,
      );

      const existingText =
        event.content
          ?.filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("\n") ?? "";

      return {
        content: [{ type: "text", text: `${existingText}\n\n${notice}` }],
      };
    }
  });

  pi.registerTool({
    name: "prompts_read",
    label: "dot-prompts read",
    description:
      "Fetch dot-prompts provenance (prior user prompts) for a file or region. Use when [dot-prompts] notices indicate relevant history.",
    parameters: Type.Object({
      path: Type.String({ description: "File path to look up" }),
      startLine: Type.Optional(
        Type.Number({ description: "Start line of region (1-indexed)" }),
      ),
      endLine: Type.Optional(
        Type.Number({ description: "End line of region (1-indexed)" }),
      ),
      symbol: Type.Optional(
        Type.String({ description: "Symbol name to match" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum records to return" }),
      ),
    }),
    promptGuidelines: [
      "Use prompts_read when a read result includes a [dot-prompts] notice and prior intent may affect your edit.",
      "Skip prompts_read when doing a ground-up rewrite or when the notice is clearly irrelevant.",
      "If a prompt is vague (e.g. execute plan), use prompts_trace with the record id to explore the pi session branch.",
      "If a record references prior records or links may be stale after renames, use prompts_chain with the record id.",
    ],
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const result = lookup(
          {
            path: params.path,
            startLine: params.startLine,
            endLine: params.endLine,
            symbol: params.symbol,
          },
          { limit: params.limit ?? 5, minConfidence: 0.4 },
        );

        noteReferencedRecords(...result.matches.map((match) => match.record.id));

        return {
          content: [
            {
              type: "text",
              text: formatLookupForAgent(result.matches),
            },
          ],
          details: { matches: result.matches, cwd: ctx.cwd },
        };
      } catch (error) {
        return toolFailure("prompts_read", error);
      }
    },
  });

  pi.registerTool({
    name: "prompts_trace",
    label: "dot-prompts trace",
    description:
      "Explore the pi session branch that produced a dot-prompts record. Use when the stored prompt is vague and you need surrounding conversation context. Falls back to record-only data if the session file is not available locally.",
    parameters: Type.Object({
      recordId: Type.Optional(
        Type.String({
          description:
            "dot-prompts record UUID (loads pi session pointers from metadata)",
        }),
      ),
      sessionFile: Type.Optional(
        Type.String({ description: "Pi session JSONL file path" }),
      ),
      userMessageId: Type.Optional(
        Type.String({ description: "Pi session user message entry id" }),
      ),
      maxEntries: Type.Optional(
        Type.Number({ description: "Maximum branch entries to include" }),
      ),
    }),
    promptGuidelines: [
      "Use prompts_trace when prompts_read returns a vague prompt like execute plan or continue and a record id is available.",
      "prompts_trace may fall back to prompt text only if the pi session file is missing on this machine.",
    ],
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      let sessionFile = params.sessionFile;
      let userMessageId = params.userMessageId;
      let prompt: string | undefined;
      let timestamp: string | undefined;
      let model: string | undefined;
      let recordId = params.recordId;

      try {
        if (params.recordId) {
          const stored = get(params.recordId);
          if (!stored) {
            return {
              content: [
                {
                  type: "text",
                  text: `No dot-prompts record found for id ${params.recordId}.`,
                },
              ],
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
          noteReferencedRecords(recordId);
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
          content: [{ type: "text", text: trace.text }],
          details: trace,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: formatRecordOnlyFallback({
                prompt,
                timestamp,
                model,
                recordId,
                sessionFile,
                reason: `prompts_trace could not load the pi session (${message}). Portable prompt text from .prompts/ is shown instead.`,
              }),
            },
          ],
          details: { error: true, tool: "prompts_trace", message },
        };
      }
    },
  });

  pi.registerTool({
    name: "prompts_chain",
    label: "dot-prompts chain",
    description:
      "Walk the provenance chain from a record id through metadata.referencedRecords — recovers intent across renames and broken symbol/file links. Traverses the full chain by default; pass maxDepth or maxRecords only to stop early.",
    parameters: Type.Object({
      recordId: Type.String({
        description: "Starting record UUID (typically the newest match from prompts_read)",
      }),
      maxDepth: Type.Optional(
        Type.Number({
          description:
            "Optional cap on hops from the start record. Omit to walk as deep as the chain goes.",
        }),
      ),
      maxRecords: Type.Optional(
        Type.Number({
          description:
            "Optional cap on total records returned. Omit for no limit.",
        }),
      ),
    }),
    promptGuidelines: [
      "Use prompts_chain when prompts_read shows referencedRecords, symbol/file links may be stale, or you need the full stacked intent behind an edit.",
      "Start from the newest matching record id; ancestors are followed automatically via referencedRecords.",
      "Omit maxDepth and maxRecords unless you want to stop early — the default walks the entire chain.",
      "For vague prompts in the chain, use prompts_trace on that specific record id.",
    ],
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const result = collectProvenanceChain([params.recordId], {
          maxDepth: params.maxDepth,
          maxRecords: params.maxRecords,
        });

        if (result.entries.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No dot-prompts record found for id ${params.recordId}.`,
              },
            ],
            details: { found: false, recordId: params.recordId },
          };
        }

        noteReferencedRecords(...result.entries.map((entry) => entry.record.id));

        return {
          content: [
            {
              type: "text",
              text: formatProvenanceChainForAgent(result),
            },
          ],
          details: { ...result, cwd: ctx.cwd },
        };
      } catch (error) {
        const stored = get(params.recordId);
        if (stored) {
          noteReferencedRecords(stored.id);
          return {
            content: [
              {
                type: "text",
                text: formatRecordOnlyFallback({
                  prompt: stored.prompt,
                  timestamp: stored.timestamp,
                  model: stored.model,
                  recordId: stored.id,
                  reason:
                    "prompts_chain failed while walking referencedRecords. Showing this record only — older intent may still exist via metadata.referencedRecords on the JSON in .prompts/records/.",
                }),
              },
            ],
            details: {
              error: true,
              tool: "prompts_chain",
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
        return toolFailure("prompts_chain", error);
      }
    },
  });
}

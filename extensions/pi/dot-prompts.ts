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
import { Type, type TSchema } from "@sinclair/typebox";
import {
  TOOL_CATALOG,
  extractLinksFromEdit,
  extractLinksFromWrite,
  formatLookupNotice,
  handlePromptsChain,
  handlePromptsRead,
  lookupForReadRange,
  record,
  type ToolParam,
} from "dot-prompts";
import { handlePromptsTrace } from "dot-prompts/pi";
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

function typeboxFromParams(params: readonly ToolParam[]): TSchema {
  const properties: Record<string, TSchema> = {};
  for (const param of params) {
    const schema =
      param.type === "string"
        ? Type.String({ description: param.description })
        : Type.Number({ description: param.description });
    properties[param.name] = param.required
      ? schema
      : Type.Optional(schema);
  }
  return Type.Object(properties);
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

export function registerDotPromptsExtension(pi: ExtensionAPI): void {
  registerPromptsCommands(pi);

  pi.on("before_agent_start", async (event) => {
    currentPrompt = event.prompt;
  });

  pi.on("agent_start", async (_event, ctx) => {
    referencedRecordIds.clear();
    contentBeforeEdit.clear();
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

  const read = TOOL_CATALOG.prompts_read;
  pi.registerTool({
    name: read.name,
    label: read.title,
    description: read.description,
    parameters: typeboxFromParams(read.params),
    promptGuidelines: [...read.guidelines],
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handlePromptsRead(params, {
        onReadRecords: (ids) => noteReferencedRecords(...ids),
      });
      return {
        content: [{ type: "text", text: result.text }],
        details: { ...result.details, cwd: ctx.cwd },
      };
    },
  });

  const trace = TOOL_CATALOG.prompts_trace;
  pi.registerTool({
    name: trace.name,
    label: trace.title,
    description: trace.description,
    parameters: typeboxFromParams(trace.params),
    promptGuidelines: [...trace.guidelines],
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const result = handlePromptsTrace(params, {
        onReadRecords: (ids) => noteReferencedRecords(...ids),
      });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  const chain = TOOL_CATALOG.prompts_chain;
  pi.registerTool({
    name: chain.name,
    label: chain.title,
    description: chain.description,
    parameters: typeboxFromParams(chain.params),
    promptGuidelines: [...chain.guidelines],
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handlePromptsChain(params, {
        onReadRecords: (ids) => noteReferencedRecords(...ids),
      });
      return {
        content: [{ type: "text", text: result.text }],
        details: { ...result.details, cwd: ctx.cwd },
      };
    },
  });
}

export default registerDotPromptsExtension;

/**
 * dot-prompts pi extension
 *
 * - Auto-records provenance once per agent generation (buffers edit/write, flushes on agent_end)
 * - Appends [dot-prompts] notices to read tool results
 * - Registers prompts_read, prompts_chain, and prompts_trace for opt-in context fetch
 * - Slash commands: /prompts history <file>
 *
 * Usage: pi install npm:@dot-prompts/pi  (or pi -e ./packages/pi)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Type, type TSchema } from "@sinclair/typebox";
import {
  TOOL_CATALOG,
  GenerationRecordBuffer,
  extractLinksFromEdit,
  extractLinksFromWrite,
  formatLookupNotice,
  handlePromptsChain,
  handlePromptsRead,
  lookupForReadRange,
  record,
  type ToolParam,
} from "dot-prompts";
import { handlePromptsTrace } from "../dist/index.js";
import {
  capturePiMetadata,
  findLatestUserMessageId,
} from "../lib/session-capture.js";
import {
  isHistorySummarizePrompt,
  registerPromptsCommands,
} from "../lib/commands.js";

let currentPrompt: string | null = null;
let currentUserMessageId: string | undefined;
let currentModel = "unknown";
const contentBeforeEdit = new Map<string, string>();
/** Record ids fetched via prompts_read / prompts_trace this user turn. */
const referencedRecordIds = new Set<string>();
const generationBuffer = new GenerationRecordBuffer();
let lastAgentCtx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1] | null = null;

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
  toolCallIds: string[],
  tools: Array<"edit" | "write">,
) {
  const lastToolCallId = toolCallIds[toolCallIds.length - 1] ?? "";
  const pi = capturePiMetadata(
    ctx.sessionManager,
    lastToolCallId,
    currentUserMessageId,
  );
  if (toolCallIds.length > 1) {
    (pi as { toolCallIds?: string[] }).toolCallIds = [...toolCallIds];
  }
  const refs = [...referencedRecordIds];
  return {
    harness: "pi",
    tool,
    ...(tools.length > 1 ? { tools } : {}),
    pi,
    ...(refs.length > 0 ? { referencedRecords: refs } : {}),
  };
}

function flushGenerationRecord(
  ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1],
): void {
  const snap = generationBuffer.snapshot();
  generationBuffer.clear();
  if (!snap || isHistorySummarizePrompt(snap.prompt)) {
    return;
  }
  const lastTool = snap.tools[snap.tools.length - 1] ?? "edit";
  record(
    {
      model: snap.model,
      prompt: snap.prompt,
      targets: snap.targets,
      metadata: buildRecordMetadata(ctx, lastTool, snap.toolCallIds, snap.tools),
    },
    {
      filePath: snap.firstFilePath,
      cwd: ctx.cwd,
    },
  );
}

export function registerDotPromptsExtension(pi: ExtensionAPI): void {
  registerPromptsCommands(pi);

  pi.on("before_agent_start", async (event) => {
    currentPrompt = event.prompt;
  });

  pi.on("agent_start", async (_event, ctx) => {
    referencedRecordIds.clear();
    contentBeforeEdit.clear();
    generationBuffer.clear();
    lastAgentCtx = ctx;
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

      const absolutePath = resolve(ctx.cwd, event.input.path);
      const target = extractLinksFromEdit({
        cwd: ctx.cwd,
        path: event.input.path,
        patch: details?.patch,
        firstChangedLine: details?.firstChangedLine,
        contentBefore: before,
      });

      lastAgentCtx = ctx;
      generationBuffer.add({
        model: modelSlug(ctx),
        prompt: currentPrompt,
        tool: "edit",
        toolCallId: event.toolCallId,
        target,
        filePath: absolutePath,
      });
      return;
    }

    if (isToolCallEventType("write", event)) {
      if (isHistorySummarizePrompt(currentPrompt)) {
        return;
      }
      const absolutePath = resolve(ctx.cwd, event.input.path);
      const lineCount = event.input.content.split("\n").length;
      const target = extractLinksFromWrite({
        cwd: ctx.cwd,
        path: event.input.path,
        lineCount,
      });

      lastAgentCtx = ctx;
      generationBuffer.add({
        model: modelSlug(ctx),
        prompt: currentPrompt,
        tool: "write",
        toolCallId: event.toolCallId,
        target,
        filePath: absolutePath,
      });
      return;
    }

    if (isToolCallEventType("read", event)) {
      const { path, offset, limit } = event.input;
      const absolutePath = resolve(ctx.cwd, path);
      const result = lookupForReadRange(path, offset, limit, {
        minConfidence: 0.4,
        limit: 5,
        filePath: absolutePath,
        cwd: ctx.cwd,
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


  pi.on("agent_end", async (_event, ctx) => {
    lastAgentCtx = ctx;
    flushGenerationRecord(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const flushCtx = ctx ?? lastAgentCtx;
    if (flushCtx) {
      flushGenerationRecord(flushCtx);
    } else {
      generationBuffer.clear();
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
      const filePath =
        typeof params.path === "string"
          ? resolve(ctx.cwd, params.path)
          : undefined;
      const result = handlePromptsRead(params, {
        cwd: ctx.cwd,
        filePath,
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
        cwd: ctx.cwd,
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

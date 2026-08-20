import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGitLink, toRepoRelativePath } from "./git.js";
import { extractNearestSymbol } from "./symbols.js";
import { getHarnessSessionPointers } from "../core/metadata.js";
import type { Link, Target } from "../core/types.js";
import { getReferencedRecordIds } from "../provenance/chain.js";

export type ExtractEditOptions = {
  cwd: string;
  path: string;
  patch?: string;
  firstChangedLine?: number;
  contentBefore?: string;
};

export type ExtractWriteOptions = {
  cwd: string;
  path: string;
  lineCount?: number;
};

export function parseRegionFromPatch(
  patch: string,
  path: string,
): { startLine: number; endLine: number } | null {
  const lines = patch.split("\n");
  let minStart = Infinity;
  let maxEnd = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!hunkMatch) {
      continue;
    }
    const start = Number.parseInt(hunkMatch[1]!, 10);
    const count = hunkMatch[2] ? Number.parseInt(hunkMatch[2], 10) : 1;
    const end = count > 0 ? start + count - 1 : start;
    minStart = Math.min(minStart, start);
    maxEnd = Math.max(maxEnd, end);
  }

  if (minStart === Infinity) {
    return null;
  }

  return { startLine: minStart, endLine: maxEnd };
}

export function estimateRegionFromEdits(
  firstChangedLine?: number,
  editCount = 1,
): { startLine: number; endLine: number } {
  const start = firstChangedLine ?? 1;
  const span = Math.max(editCount * 3, 1);
  return { startLine: start, endLine: start + span - 1 };
}

export function extractLinksFromEdit(opts: ExtractEditOptions): Target {
  const repoPath = toRepoRelativePath(opts.cwd, opts.path);
  const links: Link[] = [{ type: "file" }];

  let region =
    opts.patch !== undefined
      ? parseRegionFromPatch(opts.patch, repoPath)
      : null;
  if (!region) {
    region = estimateRegionFromEdits(opts.firstChangedLine);
  }

  links.push({
    type: "region",
    startLine: region.startLine,
    endLine: region.endLine,
  });

  const gitLink = createGitLink(opts.cwd);
  if (gitLink) {
    links.push(gitLink);
  }

  let content = opts.contentBefore;
  if (!content) {
    try {
      content = readFileSync(resolve(opts.cwd, opts.path), "utf8");
    } catch {
      content = undefined;
    }
  }

  if (content) {
    const symbol = extractNearestSymbol(
      content,
      region.startLine,
      region.endLine,
    );
    if (symbol) {
      links.push({
        type: "symbol",
        name: symbol.name,
        kind: symbol.kind,
      });
    }
  }

  return { path: repoPath, links };
}

export function extractLinksFromWrite(opts: ExtractWriteOptions): Target {
  const repoPath = toRepoRelativePath(opts.cwd, opts.path);
  const links: Link[] = [{ type: "file" }];

  const endLine = opts.lineCount ?? 1;
  links.push({
    type: "region",
    startLine: 1,
    endLine,
  });

  const gitLink = createGitLink(opts.cwd);
  if (gitLink) {
    links.push(gitLink);
  }

  return { path: repoPath, links };
}

export function formatLookupNotice(
  matchCount: number,
  startLine?: number,
  endLine?: number,
): string {
  const range =
    startLine !== undefined && endLine !== undefined
      ? ` lines ${startLine}–${endLine} of this file`
      : " this file";
  const noun = matchCount === 1 ? "record" : "records";
  return [
    "---",
    `[dot-prompts] ${matchCount} prior intent ${noun} may apply to${range}.`,
    "Use the prompts_read tool to fetch details if relevant to your task.",
    "---",
  ].join("\n");
}

export function formatLookupForAgent(
  matches: Array<{
    record: {
      id: string;
      timestamp: string;
      model: string;
      prompt: string;
      metadata?: Record<string, unknown>;
    };
    confidence: number;
    stale?: boolean;
  }>,
): string {
  if (matches.length === 0) {
    return "No dot-prompts provenance records matched this query.";
  }

  return matches
    .map((match, index) => {
      const stale = match.stale ? " (stale anchor)" : "";
      const session = getHarnessSessionPointers(match.record.metadata);
      const traceHint =
        session?.sessionFile || session?.sessionId
          ? "   trace: use prompts_trace with this record id for full session context"
          : "";
      const refs = getReferencedRecordIds(match.record.metadata);
      const chainHint =
        refs.length > 0
          ? `   chain: use prompts_chain with this record id to walk ${refs.length} prior record(s) — survives broken symbol/file links`
          : "";
      return [
        `${index + 1}. [${match.record.timestamp}] confidence ${match.confidence.toFixed(2)}${stale}`,
        `   model: ${match.record.model}`,
        `   prompt: ${match.record.prompt}`,
        `   id: ${match.record.id}`,
        traceHint,
        chainHint,
      ]
        .filter((line) => line.length > 0)
        .join("\n");
    })
    .join("\n\n");
}

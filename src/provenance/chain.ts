import { getRecordById, readAllRecords } from "../storage.js";
import type { Link, PromptRecord, Target } from "../types.js";

export function getReferencedRecordIds(
  metadata: Record<string, unknown> | undefined,
): string[] {
  if (!metadata) {
    return [];
  }
  const refs = metadata.referencedRecords;
  if (!Array.isArray(refs)) {
    return [];
  }
  return refs.filter((id): id is string => typeof id === "string");
}

export type ProvenanceChainOptions = {
  promptsDir?: string;
  /** Stop after this many hops from the root. Omit for no limit. */
  maxDepth?: number;
  /** Stop after this many records total. Omit for no limit. */
  maxRecords?: number;
};

export type ProvenanceChainEntry = {
  record: PromptRecord;
  depth: number;
  via?: string;
};

export type ProvenanceChainResult = {
  entries: ProvenanceChainEntry[];
  truncated: boolean;
  truncatedReason?: "maxDepth" | "maxRecords";
  missingIds: string[];
};

function summarizeTarget(target: Target): string {
  const symbols = target.links
    .filter((link): link is Extract<Link, { type: "symbol" }> => link.type === "symbol")
    .map((link) => link.name);
  const symbolPart =
    symbols.length > 0 ? `, symbol: ${symbols.join(", ")}` : "";
  return `${target.path}${symbolPart}`;
}

function summarizeTargets(record: PromptRecord): string {
  if (record.targets.length === 0) {
    return "(no targets)";
  }
  return record.targets.map(summarizeTarget).join("; ");
}

/**
 * Walk metadata.referencedRecords recursively (UUID-stable provenance graph).
 * Depth-first from each root: root first, then ancestors via referencedRecords.
 */
export function collectProvenanceChain(
  rootIds: string[],
  opts: ProvenanceChainOptions = {},
): ProvenanceChainResult {
  const { maxDepth, maxRecords, promptsDir } = opts;
  const seen = new Set<string>();
  const missingIds = new Set<string>();
  const result: ProvenanceChainEntry[] = [];
  let truncated = false;
  let truncatedReason: ProvenanceChainResult["truncatedReason"];

  function visit(id: string, depth: number, via?: string): void {
    if (seen.has(id)) {
      return;
    }
    if (maxDepth !== undefined && depth > maxDepth) {
      truncated = true;
      truncatedReason = "maxDepth";
      return;
    }
    if (maxRecords !== undefined && result.length >= maxRecords) {
      truncated = true;
      truncatedReason = "maxRecords";
      return;
    }
    seen.add(id);

    const record = getRecordById(id, promptsDir);
    if (!record) {
      missingIds.add(id);
      return;
    }

    result.push({ record, depth, ...(via ? { via } : {}) });

    for (const refId of getReferencedRecordIds(record.metadata)) {
      visit(refId, depth + 1, id);
    }
  }

  for (const rootId of rootIds) {
    visit(rootId, 0);
  }

  return {
    entries: result,
    truncated,
    ...(truncatedReason ? { truncatedReason } : {}),
    missingIds: [...missingIds],
  };
}

export function expandReferencedRecords(
  directIds: string[],
  opts: ProvenanceChainOptions = {},
): string[] {
  const { entries } = collectProvenanceChain(directIds, opts);
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!seen.has(entry.record.id)) {
      seen.add(entry.record.id);
      ordered.push(entry.record.id);
    }
  }

  return ordered;
}

export function formatProvenanceChainForAgent(
  result: ProvenanceChainResult | ProvenanceChainEntry[],
): string {
  const chain: ProvenanceChainResult = Array.isArray(result)
    ? { entries: result, truncated: false, missingIds: [] }
    : result;

  if (chain.entries.length === 0) {
    return "No provenance chain entries found for the given record id(s).";
  }

  const lines = chain.entries.map((entry, index) => {
    const depthLabel =
      entry.depth > 0
        ? `depth ${entry.depth} (via ${entry.via})`
        : "depth 0 (start)";
    const refs = getReferencedRecordIds(entry.record.metadata);
    const refsLine =
      refs.length > 0
        ? `   references: ${refs.join(", ")}`
        : "   references: (none — leaf of chain)";
    const parts = [
      `${index + 1}. [${entry.record.timestamp}] ${depthLabel}`,
      `   prompt: ${entry.record.prompt}`,
      `   id: ${entry.record.id}`,
      `   model: ${entry.record.model}`,
      `   targets: ${summarizeTargets(entry.record)}`,
      refsLine,
    ];
    return parts.filter((line) => line.length > 0).join("\n");
  });

  const footer: string[] = [];
  footer.push(
    `\n---\n${chain.entries.length} record(s) in chain (newest/root first, ancestors follow).`,
  );
  if (chain.truncated) {
    footer.push(
      `Chain truncated (${chain.truncatedReason}). Call prompts_chain again with a higher maxDepth or maxRecords, or start from a deeper record id.`,
    );
  }
  if (chain.missingIds.length > 0) {
    footer.push(
      `Missing record(s) (referenced but not found locally): ${chain.missingIds.join(", ")}`,
    );
  }
  footer.push(
    "For vague prompts, use prompts_trace on a specific record id. Symbol/file links may be stale; UUID references remain valid.",
  );

  return `${lines.join("\n\n")}${footer.join("\n")}`;
}

export function findRecordsReferencing(
  targetId: string,
  opts?: { promptsDir?: string },
): PromptRecord[] {
  return readAllRecords(opts?.promptsDir).filter((record) =>
    getReferencedRecordIds(record.metadata).includes(targetId),
  );
}

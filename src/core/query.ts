import { resolveStorage, type StoreOptions } from "./storage.js";
import {
  collectProvenanceChain,
  type ProvenanceChainResult,
} from "../provenance/chain.js";
import type {
  ContextOptions,
  ContextSummary,
  Link,
  ListOptions,
  LookupMatch,
  LookupOptions,
  LookupQuery,
  LookupResult,
  PromptRecord,
} from "./types.js";

export type QueryOptions = ListOptions & StoreOptions;
export type LookupStoreOptions = LookupOptions & StoreOptions;

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function recordMatchesFilters(
  record: PromptRecord,
  opts: ListOptions,
): boolean {
  if (opts.since && record.timestamp < opts.since) {
    return false;
  }

  if (opts.model && record.model !== opts.model) {
    return false;
  }

  if (opts.path) {
    const target = normalizePath(opts.path);
    const hasPath = record.targets.some(
      (entry) => normalizePath(entry.path) === target,
    );
    if (!hasPath) {
      return false;
    }
  }

  return true;
}

function sortByTimestampDesc(records: PromptRecord[]): PromptRecord[] {
  return [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function list(opts: QueryOptions = {}): PromptRecord[] {
  const storage = resolveStorage(opts);
  const filtered = storage.list().filter((record) =>
    recordMatchesFilters(record, opts),
  );
  const sorted = sortByTimestampDesc(filtered);
  if (opts.limit !== undefined) {
    return sorted.slice(0, opts.limit);
  }
  return sorted;
}

export function get(
  id: string,
  opts?: StoreOptions,
): PromptRecord | null {
  return resolveStorage(opts).getById(id);
}

function regionsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function scoreLink(
  link: Link,
  query: LookupQuery,
): { confidence: number; stale?: boolean } | null {
  const queryPath = normalizePath(query.path);

  if (link.type === "file" && normalizePath(link.path) === queryPath) {
    return { confidence: 0.4 };
  }

  if (
    link.type === "symbol" &&
    normalizePath(link.path) === queryPath &&
    query.symbol &&
    link.name === query.symbol
  ) {
    return { confidence: 0.9 };
  }

  if (
    link.type === "region" &&
    normalizePath(link.path) === queryPath &&
    query.startLine !== undefined &&
    query.endLine !== undefined
  ) {
    if (
      regionsOverlap(
        link.startLine,
        link.endLine,
        query.startLine,
        query.endLine,
      )
    ) {
      return { confidence: 0.7 };
    }
  }

  if (
    link.type === "hashline" &&
    normalizePath(link.path) === queryPath &&
    query.hashline
  ) {
    if (
      link.line === query.hashline.line &&
      link.hash === query.hashline.hash
    ) {
      return { confidence: 0.95 };
    }
    if (link.line === query.hashline.line) {
      return { confidence: 0.5, stale: true };
    }
  }

  return null;
}

export function lookup(
  query: LookupQuery,
  opts: LookupStoreOptions = {},
): LookupResult {
  const minConfidence = opts.minConfidence ?? 0.4;
  const limit = opts.limit ?? 5;
  const records = sortByTimestampDesc(resolveStorage(opts).list());
  const matches: LookupMatch[] = [];

  for (const record of records) {
    let bestConfidence = 0;
    let stale = false;
    const matchedLinks: Link[] = [];

    for (const target of record.targets) {
      if (normalizePath(target.path) !== normalizePath(query.path)) {
        continue;
      }

      for (const link of target.links) {
        const score = scoreLink(link, query);
        if (!score) {
          continue;
        }
        matchedLinks.push(link);
        if (score.confidence > bestConfidence) {
          bestConfidence = score.confidence;
        }
        if (score.stale) {
          stale = true;
        }
      }
    }

    if (bestConfidence >= minConfidence) {
      matches.push({
        record,
        confidence: bestConfidence,
        matchedLinks,
        ...(stale ? { stale: true } : {}),
      });
    }
  }

  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.record.timestamp.localeCompare(a.record.timestamp);
  });

  return { matches: matches.slice(0, limit) };
}

export function context(opts: ContextOptions & StoreOptions = {}): ContextSummary {
  const records = list(opts);
  return {
    records: records.map((record) => ({
      id: record.id,
      timestamp: record.timestamp,
      model: record.model,
      prompt: record.prompt,
      paths: record.targets.map((target) => target.path),
      linkCount: record.targets.reduce(
        (count, target) => count + target.links.length,
        0,
      ),
    })),
  };
}

export function lookupForReadRange(
  path: string,
  offset?: number,
  limit?: number,
  opts?: LookupStoreOptions,
): LookupResult {
  const startLine = offset ?? 1;
  const endLine = limit !== undefined ? startLine + limit - 1 : startLine + 9999;
  return lookup({ path, startLine, endLine }, opts);
}

export type ChainOptions = StoreOptions & {
  maxDepth?: number;
  maxRecords?: number;
};

export function chain(
  recordIds: string | string[],
  opts: ChainOptions = {},
): ProvenanceChainResult {
  const ids = Array.isArray(recordIds) ? recordIds : [recordIds];
  return collectProvenanceChain(ids, opts);
}

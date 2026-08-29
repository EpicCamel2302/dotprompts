import type { Link, RegionLink, Target } from "./types.js";

export type GenerationTool = "edit" | "write";

export type GenerationBufferEntry = {
  tool: GenerationTool;
  toolCallId: string;
  target: Target;
  /** Absolute path used for store walk-up (first buffered file wins on flush). */
  filePath: string;
};

export type GenerationBufferSnapshot = {
  model: string;
  prompt: string;
  targets: Target[];
  tools: GenerationTool[];
  toolCallIds: string[];
  firstFilePath: string | undefined;
};

/** Normalize path keys so the same file is not buffered twice under different separators. */
export function normalizeTargetPath(path: string): string {
  return path.replace(/\\/g, "/");
}

/** Stable key for deduplicating non-region links when merging edits to the same path. */
function linkIdentity(link: Exclude<Link, RegionLink>): string {
  switch (link.type) {
    case "file":
      return "file";
    case "git":
      return `git:${link.commit}`;
    case "symbol":
      return `symbol:${link.name}:${link.kind ?? ""}`;
    case "hashline":
      return `hashline:${link.line}:${link.hash}`;
  }
}

function regionContains(outer: RegionLink, inner: RegionLink): boolean {
  return (
    outer.startLine <= inner.startLine && outer.endLine >= inner.endLine
  );
}

/**
 * Drop nested regions; keep a wider region that subsumes narrower ones.
 * Partial overlaps and disjoint ranges stay as separate links.
 */
function mergeRegionLink(merged: Link[], next: RegionLink): Link[] {
  const regions = merged.filter(
    (link): link is RegionLink => link.type === "region",
  );
  if (regions.some((region) => regionContains(region, next))) {
    return merged;
  }
  const withoutContained = merged.filter(
    (link) => !(link.type === "region" && regionContains(next, link)),
  );
  return [...withoutContained, next];
}

/**
 * Union links from successive edits to the same file (first-seen order).
 * Regions collapse on containment; other link types are identity-deduped.
 */
export function mergeTargetLinks(existing: Link[], next: Link[]): Link[] {
  let merged = existing.slice();
  const seen = new Set(
    existing
      .filter((link): link is Exclude<Link, RegionLink> => link.type !== "region")
      .map(linkIdentity),
  );
  for (const link of next) {
    if (link.type === "region") {
      merged = mergeRegionLink(merged, link);
      continue;
    }
    const key = linkIdentity(link);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(link);
  }
  return merged;
}

/**
 * Upsert by target path, merging links from prior entries for that path.
 * Reuses the first-seen path string; otherwise appends.
 */
export function upsertTargetByPath(
  targets: Target[],
  next: Target,
): Target[] {
  const key = normalizeTargetPath(next.path);
  const index = targets.findIndex(
    (target) => normalizeTargetPath(target.path) === key,
  );
  if (index === -1) {
    return [...targets, next];
  }
  const prior = targets[index]!;
  const updated = targets.slice();
  updated[index] = {
    path: prior.path,
    links: mergeTargetLinks(prior.links, next.links),
  };
  return updated;
}

/**
 * In-generation buffer for harness writers: accumulate successful edit/write
 * targets and flush a single multi-target record at generation end.
 */
export class GenerationRecordBuffer {
  private model = "";
  private prompt = "";
  private entries = new Map<
    string,
    { target: Target; filePath: string; order: number }
  >();
  private tools: GenerationTool[] = [];
  private toolCallIds: string[] = [];
  private nextOrder = 0;

  clear(): void {
    this.model = "";
    this.prompt = "";
    this.entries.clear();
    this.tools = [];
    this.toolCallIds = [];
    this.nextOrder = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  add(entry: GenerationBufferEntry & { model: string; prompt: string }): void {
    this.model = entry.model;
    this.prompt = entry.prompt;
    const key = normalizeTargetPath(entry.target.path);
    const existing = this.entries.get(key);
    this.entries.set(key, {
      target: existing
        ? {
            path: existing.target.path,
            links: mergeTargetLinks(existing.target.links, entry.target.links),
          }
        : entry.target,
      filePath: existing?.filePath ?? entry.filePath,
      order: existing?.order ?? this.nextOrder++,
    });
    this.tools.push(entry.tool);
    this.toolCallIds.push(entry.toolCallId);
  }

  /** Ordered unique tools (first-seen order). */
  uniqueTools(): GenerationTool[] {
    const seen = new Set<GenerationTool>();
    const unique: GenerationTool[] = [];
    for (const tool of this.tools) {
      if (!seen.has(tool)) {
        seen.add(tool);
        unique.push(tool);
      }
    }
    return unique;
  }

  snapshot(): GenerationBufferSnapshot | null {
    if (this.entries.size === 0 || !this.prompt) {
      return null;
    }
    const ordered = [...this.entries.values()].sort(
      (a, b) => a.order - b.order,
    );
    return {
      model: this.model,
      prompt: this.prompt,
      targets: ordered.map((entry) => entry.target),
      tools: this.uniqueTools(),
      toolCallIds: [...this.toolCallIds],
      firstFilePath: ordered[0]?.filePath,
    };
  }
}

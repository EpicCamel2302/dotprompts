import type { Target } from "./types.js";

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

/**
 * Last-edit-wins merge by target path.
 * Replaces an existing entry for the same path; otherwise appends.
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
  const updated = targets.slice();
  updated[index] = next;
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
      target: entry.target,
      filePath: entry.filePath,
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

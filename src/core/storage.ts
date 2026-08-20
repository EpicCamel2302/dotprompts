import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { resolvePromptsDir } from "./prompts-dir.js";
import type { PromptRecord } from "./types.js";

export const HISTORY_FILE = "history.jsonl";
export const RECORDS_DIR = "records";

export type Storage = {
  readonly promptsDir: string;
  append(record: PromptRecord): void;
  list(): PromptRecord[];
  getById(id: string): PromptRecord | null;
};

export type StoreOptions = {
  promptsDir?: string;
  storage?: Storage;
  cwd?: string;
};

export function resolveStorage(opts?: StoreOptions): Storage {
  if (opts?.storage) {
    return opts.storage;
  }
  return createJsonlStorage(opts?.promptsDir, opts?.cwd);
}

export function createJsonlStorage(
  promptsDir?: string,
  cwd?: string,
): Storage {
  return new JsonlStorage(resolvePromptsDir(promptsDir, cwd));
}

export class JsonlStorage implements Storage {
  constructor(readonly promptsDir: string) {}

  append(record: PromptRecord): void {
    mkdirSync(this.promptsDir, { recursive: true });
    mkdirSync(this.recordsPath(), { recursive: true });

    const line = `${JSON.stringify(record)}\n`;
    appendFileSync(this.historyPath(), line, "utf8");

    const mirrorPath = join(this.recordsPath(), mirrorFilename(record));
    const tempPath = `${mirrorPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(record, null, 2), "utf8");
    renameSync(tempPath, mirrorPath);
  }

  list(): PromptRecord[] {
    const path = this.historyPath();
    if (!existsSync(path)) {
      return [];
    }

    const content = readFileSync(path, "utf8");
    if (content.trim().length === 0) {
      return [];
    }

    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as PromptRecord);
  }

  getById(id: string): PromptRecord | null {
    return this.list().find((record) => record.id === id) ?? null;
  }

  historyPath(): string {
    return join(this.promptsDir, HISTORY_FILE);
  }

  recordsPath(): string {
    return join(this.promptsDir, RECORDS_DIR);
  }
}

export function mirrorFilename(record: PromptRecord): string {
  const safeTimestamp = record.timestamp.replace(/[:.]/g, "-");
  return `${safeTimestamp}_${record.id}.json`;
}

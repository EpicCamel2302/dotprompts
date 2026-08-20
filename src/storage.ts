import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import type { PromptRecord } from "./types.js";

export const DEFAULT_PROMPTS_DIR = ".prompts";
export const HISTORY_FILE = "history.jsonl";
export const RECORDS_DIR = "records";

export function resolvePromptsDir(promptsDir?: string): string {
  return promptsDir ?? DEFAULT_PROMPTS_DIR;
}

export function historyPath(promptsDir?: string): string {
  return join(resolvePromptsDir(promptsDir), HISTORY_FILE);
}

export function recordsPath(promptsDir?: string): string {
  return join(resolvePromptsDir(promptsDir), RECORDS_DIR);
}

export function ensurePromptsDir(promptsDir?: string): void {
  const dir = resolvePromptsDir(promptsDir);
  mkdirSync(dir, { recursive: true });
  mkdirSync(recordsPath(promptsDir), { recursive: true });
}

export function mirrorFilename(record: PromptRecord): string {
  const safeTimestamp = record.timestamp.replace(/[:.]/g, "-");
  return `${safeTimestamp}_${record.id}.json`;
}

export function appendRecord(record: PromptRecord, promptsDir?: string): void {
  ensurePromptsDir(promptsDir);
  const line = `${JSON.stringify(record)}\n`;
  appendFileSync(historyPath(promptsDir), line, "utf8");

  const mirrorPath = join(recordsPath(promptsDir), mirrorFilename(record));
  const tempPath = `${mirrorPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(record, null, 2), "utf8");
  renameSync(tempPath, mirrorPath);
}

export function readAllRecords(promptsDir?: string): PromptRecord[] {
  const path = historyPath(promptsDir);
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

export function getRecordById(
  id: string,
  promptsDir?: string,
): PromptRecord | null {
  const records = readAllRecords(promptsDir);
  return records.find((record) => record.id === id) ?? null;
}

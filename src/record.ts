import { v4 as uuidv4 } from "uuid";
import { appendRecord } from "./storage.js";
import type { PromptRecord, RecordInput } from "./types.js";
import { validateRecord } from "./validate.js";

export function buildRecord(input: RecordInput): PromptRecord {
  const record: PromptRecord = {
    version: 1,
    id: input.id ?? uuidv4(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    model: input.model,
    prompt: input.prompt,
    targets: input.targets,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };

  validateRecord(record);
  return record;
}

export function record(
  input: RecordInput,
  opts?: { promptsDir?: string },
): PromptRecord {
  const built = buildRecord(input);
  appendRecord(built, opts?.promptsDir);
  return built;
}

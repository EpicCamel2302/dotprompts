import { v4 as uuidv4 } from "uuid";
import {
  assertStoreWritable,
  findStore,
} from "./config.js";
import { resolveStorage, type StoreOptions } from "./storage.js";
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
  opts?: StoreOptions,
): PromptRecord {
  const built = buildRecord(input);

  // Explicit storage / promptsDir always writable; discovery may refuse
  // auto-create outside git without init.
  if (!opts?.storage && opts?.promptsDir === undefined) {
    assertStoreWritable(
      findStore({
        filePath: opts?.filePath,
        cwd: opts?.cwd,
      }),
    );
  }

  resolveStorage(opts).append(built);
  return built;
}

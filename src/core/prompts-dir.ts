import { isAbsolute, join, resolve } from "node:path";

export const PROMPTS_DIR_NAME = ".prompts";

/**
 * Resolve the `.prompts` directory to an absolute path.
 * Relative `promptsDir` values are resolved against `cwd` (default process.cwd()).
 */
export function resolvePromptsDir(
  promptsDir?: string,
  cwd: string = process.cwd(),
): string {
  const raw = promptsDir ?? join(cwd, PROMPTS_DIR_NAME);
  return isAbsolute(raw) ? raw : resolve(cwd, raw);
}

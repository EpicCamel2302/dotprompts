import { isAbsolute, join, resolve } from "node:path";

export const PROMPTS_DIR_NAME = ".prompts";
export const PROMPTS_DIR_ENV = "DOT_PROMPTS_DIR";

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

/**
 * Resolve `.prompts` from CLI flags, then `DOT_PROMPTS_DIR`, then `<cwd>/.prompts`.
 */
export function resolvePromptsDirFromEnv(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const flagIndex = argv.findIndex(
    (arg) => arg === "--prompts-dir" || arg === "--promptsDir",
  );
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    return resolvePromptsDir(argv[flagIndex + 1], cwd);
  }

  const eqFlag = argv.find((arg) => arg.startsWith("--prompts-dir="));
  if (eqFlag) {
    return resolvePromptsDir(eqFlag.slice("--prompts-dir=".length), cwd);
  }

  if (env[PROMPTS_DIR_ENV]) {
    return resolvePromptsDir(env[PROMPTS_DIR_ENV], cwd);
  }

  return resolvePromptsDir(undefined, cwd);
}

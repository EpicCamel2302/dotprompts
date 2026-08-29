import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import Ajv2020Module from "ajv/dist/2020.js";
import { packageRoot } from "./package-root.js";
import { PROMPTS_DIR_NAME, resolvePromptsDir } from "./prompts-dir.js";
import { ValidationError } from "./validate.js";

const Ajv2020 = Ajv2020Module.default;

export const CONFIG_FILE_PRIMARY = "dotprompts.json";
export const CONFIG_FILE_NESTED = "config.json";

export type DotPromptsConfig = {
  version: 1;
  storage: {
    driver: "jsonl";
    path?: string;
  };
};

export type ResolvedStore = {
  promptsDir: string;
  config: DotPromptsConfig | null;
  configPath: string | null;
  rootDir: string;
};

export type FindStoreOptions = {
  /** Prefer walking up from this file (edit/read path). */
  filePath?: string;
  /** Fallback start directory when filePath is omitted. */
  cwd?: string;
  /** Explicit store override — skips discovery. */
  promptsDir?: string;
};

const configSchema = JSON.parse(
  readFileSync(join(packageRoot(), "schemas", "config.v1.json"), "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateConfigSchema = ajv.compile(configSchema);

export function validateConfig(config: unknown): asserts config is DotPromptsConfig {
  const valid = validateConfigSchema(config);
  if (!valid) {
    throw new ValidationError("Invalid config", validateConfigSchema.errors);
  }
}

export function loadConfigFile(path: string): DotPromptsConfig {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  validateConfig(raw);
  return raw;
}

function defaultConfig(): DotPromptsConfig {
  return {
    version: 1,
    storage: { driver: "jsonl" },
  };
}

function startDir(opts: FindStoreOptions): string {
  const cwd = opts.cwd ?? process.cwd();
  if (!opts.filePath) {
    return resolve(cwd);
  }
  const absolute = isAbsolute(opts.filePath)
    ? opts.filePath
    : resolve(cwd, opts.filePath);
  try {
    if (existsSync(absolute) && statSync(absolute).isDirectory()) {
      return absolute;
    }
  } catch {
    // fall through to dirname
  }
  return dirname(absolute);
}

function isFsRoot(dir: string): boolean {
  const { root } = parse(dir);
  return resolve(dir) === resolve(root);
}

function hasGitDir(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

function promptsDirFromPrimary(
  configDir: string,
  config: DotPromptsConfig,
): string {
  if (config.storage.path) {
    return resolvePromptsDir(config.storage.path, configDir);
  }
  return join(configDir, PROMPTS_DIR_NAME);
}

function promptsDirFromNested(
  promptsDir: string,
  parentDir: string,
  config: DotPromptsConfig,
): string {
  if (config.storage.path) {
    return resolvePromptsDir(config.storage.path, parentDir);
  }
  return promptsDir;
}

/**
 * Resolve the provenance store by walking up from a file path (or cwd).
 *
 * At each directory: prefer `dotprompts.json`, then `.prompts/config.json`.
 * Stop at `.git` (use that directory's `.prompts`) or the filesystem root
 * (fall back to `<cwd>/.prompts`). Explicit `promptsDir` skips discovery.
 */
export function findStore(opts: FindStoreOptions = {}): ResolvedStore {
  const cwd = opts.cwd ?? process.cwd();

  if (opts.promptsDir !== undefined) {
    const promptsDir = resolvePromptsDir(opts.promptsDir, cwd);
    return {
      promptsDir,
      config: null,
      configPath: null,
      rootDir: dirname(promptsDir),
    };
  }

  let dir = startDir(opts);
  const fallbackRoot = resolve(opts.cwd ?? process.cwd());

  while (true) {
    const primaryPath = join(dir, CONFIG_FILE_PRIMARY);
    if (existsSync(primaryPath)) {
      const config = loadConfigFile(primaryPath);
      const promptsDir = promptsDirFromPrimary(dir, config);
      return {
        promptsDir,
        config,
        configPath: primaryPath,
        rootDir: dir,
      };
    }

    const nestedPromptsDir = join(dir, PROMPTS_DIR_NAME);
    const nestedPath = join(nestedPromptsDir, CONFIG_FILE_NESTED);
    if (existsSync(nestedPath)) {
      const config = loadConfigFile(nestedPath);
      const promptsDir = promptsDirFromNested(nestedPromptsDir, dir, config);
      return {
        promptsDir,
        config,
        configPath: nestedPath,
        rootDir: dir,
      };
    }

    if (hasGitDir(dir)) {
      const config = defaultConfig();
      const promptsDir = join(dir, PROMPTS_DIR_NAME);
      return {
        promptsDir,
        config,
        configPath: null,
        rootDir: dir,
      };
    }

    if (isFsRoot(dir)) {
      const config = defaultConfig();
      const promptsDir = join(fallbackRoot, PROMPTS_DIR_NAME);
      return {
        promptsDir,
        config,
        configPath: null,
        rootDir: fallbackRoot,
      };
    }

    dir = dirname(dir);
  }
}

/**
 * Resolve `.prompts` from CLI `--prompts-dir` / `--prompts-dir=`, else walk-up from cwd.
 */
export function resolvePromptsDirFromCli(
  argv: string[] = process.argv.slice(2),
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

  return findStore({ cwd }).promptsDir;
}

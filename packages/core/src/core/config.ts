import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import Ajv2020Module from "ajv/dist/2020.js";
import { packageRoot } from "./package-root.js";
import { PROMPTS_DIR_NAME, resolvePromptsDir } from "./prompts-dir.js";
import { ValidationError } from "./validate.js";

/** Same basename as storage HISTORY_FILE — kept local to avoid a config↔storage cycle. */
const HISTORY_BASENAME = "history.jsonl";

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

/** How findStore chose this location. */
export type StoreSource = "explicit" | "config" | "git" | "fallback";

export type ResolvedStore = {
  promptsDir: string;
  config: DotPromptsConfig | null;
  configPath: string | null;
  rootDir: string;
  source: StoreSource;
};

export type FindStoreOptions = {
  /** Prefer walking up from this file (edit/read path). */
  filePath?: string;
  /** Fallback start directory when filePath is omitted. */
  cwd?: string;
  /** Explicit store override — skips discovery. */
  promptsDir?: string;
};

export type InitStoreOptions = {
  /** Directory that receives `dotprompts.json` (defaults to cwd). */
  cwd?: string;
};

/**
 * Thrown when recording would create a store outside a git repo / config.
 * Non-git trees must call {@link initStore} (or `/prompts init` in pi) first.
 */
export class StoreNotInitializedError extends Error {
  readonly promptsDir: string;
  readonly rootDir: string;

  constructor(resolved: Pick<ResolvedStore, "promptsDir" | "rootDir">) {
    super(
      `No dot-prompts store initialized under ${resolved.rootDir}. ` +
        `In a git repo the store is created automatically; otherwise run \`/prompts init\` (pi) or \`dot-prompts init\`.`,
    );
    this.name = "StoreNotInitializedError";
    this.promptsDir = resolved.promptsDir;
    this.rootDir = resolved.rootDir;
  }
}

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
 *
 * A `fallback` store is not auto-created on record — call {@link initStore}
 * (or use a git repo / existing config) first. See {@link isStoreWritable}.
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
      source: "explicit",
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
        source: "config",
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
        source: "config",
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
        source: "git",
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
        source: "fallback",
      };
    }

    dir = dirname(dir);
  }
}

/**
 * Whether {@link record} may create/append at this store.
 * Git roots and config-backed stores auto-create; bare cwd fallback does not
 * until {@link initStore} (or an existing history file) is present.
 */
export function isStoreWritable(resolved: ResolvedStore): boolean {
  if (resolved.source !== "fallback") {
    return true;
  }
  return (
    existsSync(join(resolved.promptsDir, HISTORY_BASENAME)) ||
    existsSync(join(resolved.promptsDir, CONFIG_FILE_NESTED))
  );
}

export function assertStoreWritable(resolved: ResolvedStore): void {
  if (!isStoreWritable(resolved)) {
    throw new StoreNotInitializedError(resolved);
  }
}

/**
 * Write `dotprompts.json` at `cwd` (and ensure `.prompts/` exists) so discovery
 * treats the tree as initialized without requiring git.
 */
export function initStore(opts: InitStoreOptions = {}): ResolvedStore {
  const rootDir = resolve(opts.cwd ?? process.cwd());
  const primaryPath = join(rootDir, CONFIG_FILE_PRIMARY);
  const nestedPath = join(rootDir, PROMPTS_DIR_NAME, CONFIG_FILE_NESTED);

  if (existsSync(primaryPath) || existsSync(nestedPath)) {
    return findStore({ cwd: rootDir });
  }

  const config = defaultConfig();
  writeFileSync(primaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  mkdirSync(join(rootDir, PROMPTS_DIR_NAME), { recursive: true });
  return findStore({ cwd: rootDir });
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

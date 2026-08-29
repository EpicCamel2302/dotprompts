export { record, buildRecord } from "./core/record.js";
export {
  GenerationRecordBuffer,
  mergeTargetLinks,
  normalizeTargetPath,
  upsertTargetByPath,
} from "./core/generation-buffer.js";
export type {
  GenerationBufferEntry,
  GenerationBufferSnapshot,
  GenerationTool,
} from "./core/generation-buffer.js";
export {
  chain,
  context,
  get,
  list,
  lookup,
  lookupForReadRange,
} from "./core/query.js";
export type { ChainOptions, QueryOptions, LookupStoreOptions } from "./core/query.js";
export {
  annotateContent,
  annotateFile,
  computeLineHash,
  resolveAnchor,
  sha256Content,
  sha256File,
} from "./core/hashline.js";
export {
  createJsonlStorage,
  JsonlStorage,
  resolveStorage,
  HISTORY_FILE,
  RECORDS_DIR,
} from "./core/storage.js";
export type { Storage, StoreOptions } from "./core/storage.js";
export {
  PROMPTS_DIR_NAME,
  resolvePromptsDir,
} from "./core/prompts-dir.js";
export {
  CONFIG_FILE_NESTED,
  CONFIG_FILE_PRIMARY,
  findStore,
  loadConfigFile,
  resolvePromptsDirFromCli,
  validateConfig,
} from "./core/config.js";
export type {
  DotPromptsConfig,
  FindStoreOptions,
  ResolvedStore,
} from "./core/config.js";
export { getHarnessSessionPointers } from "./core/metadata.js";
export type { HarnessSessionPointers } from "./core/metadata.js";
export {
  extractLinksFromEdit,
  extractLinksFromWrite,
  formatLookupForAgent,
  formatLookupNotice,
  parseRegionFromPatch,
} from "./links/extract.js";
export { createGitLink, getGitHead, toRepoRelativePath } from "./links/git.js";
export {
  extractNearestSymbol,
  extractSymbolsInRange,
} from "./links/symbols.js";
export {
  collectProvenanceChain,
  expandReferencedRecords,
  findRecordsReferencing,
  formatProvenanceChainForAgent,
  getReferencedRecordIds,
} from "./provenance/chain.js";
export type {
  ProvenanceChainEntry,
  ProvenanceChainOptions,
  ProvenanceChainResult,
} from "./provenance/chain.js";
export { TOOL_CATALOG } from "./tools/catalog.js";
export type { ToolName, ToolParam, ToolSpec } from "./tools/catalog.js";
export { handlePromptsChain, handlePromptsRead } from "./tools/handlers.js";
export type {
  PromptsChainParams,
  PromptsReadParams,
  ToolHandlerOptions,
  ToolHandlerResult,
} from "./tools/handlers.js";
export { formatRecordFallback, toolErrorText } from "./tools/format.js";
export { ValidationError } from "./core/validate.js";
export type {
  ContextOptions,
  ContextSummary,
  FileLink,
  GitLink,
  HashlineLink,
  Link,
  ListOptions,
  LookupMatch,
  LookupOptions,
  LookupQuery,
  LookupResult,
  PromptRecord,
  RecordInput,
  RegionLink,
  ResolvedAnchor,
  SymbolLink,
  Target,
} from "./core/types.js";

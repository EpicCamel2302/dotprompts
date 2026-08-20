export type HashlineAnchor = {
  line: number;
  hash: string;
};

export type FileLink = {
  type: "file";
  path: string;
  [key: string]: unknown;
};

export type RegionLink = {
  type: "region";
  path: string;
  startLine: number;
  endLine: number;
  [key: string]: unknown;
};

export type GitLink = {
  type: "git";
  path: string;
  commit: string;
  [key: string]: unknown;
};

export type SymbolLink = {
  type: "symbol";
  path: string;
  name: string;
  kind?: string;
  [key: string]: unknown;
};

export type HashlineLink = {
  type: "hashline";
  path: string;
  line: number;
  hash: string;
  [key: string]: unknown;
};

export type Link =
  | FileLink
  | RegionLink
  | GitLink
  | SymbolLink
  | HashlineLink;

export type Target = {
  path: string;
  links: Link[];
};

export type PromptRecord = {
  $schema?: string;
  version: 1;
  id: string;
  timestamp: string;
  model: string;
  prompt: string;
  targets: Target[];
  metadata?: Record<string, unknown>;
};

export type RecordInput = {
  version?: 1;
  id?: string;
  timestamp?: string;
  model: string;
  prompt: string;
  targets: Target[];
  metadata?: Record<string, unknown>;
};

export type AnnotatedLine = {
  line: number;
  hash: string;
  content: string;
};

export type ResolvedAnchor = {
  content: string;
  valid: boolean;
  currentHash: string;
};

export type ListOptions = {
  promptsDir?: string;
  limit?: number;
  since?: string;
  path?: string;
  model?: string;
};

export type LookupQuery = {
  path: string;
  startLine?: number;
  endLine?: number;
  symbol?: string;
  hashline?: { line: number; hash: string };
};

export type LookupOptions = {
  promptsDir?: string;
  limit?: number;
  minConfidence?: number;
};

export type LookupMatch = {
  record: PromptRecord;
  confidence: number;
  matchedLinks: Link[];
  stale?: boolean;
};

export type LookupResult = {
  matches: LookupMatch[];
};

export type ContextOptions = ListOptions;

export type ContextSummary = {
  records: Array<{
    id: string;
    timestamp: string;
    model: string;
    prompt: string;
    paths: string[];
    linkCount: number;
  }>;
};

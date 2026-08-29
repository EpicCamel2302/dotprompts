import {
  TOOL_CATALOG,
  formatLookupNotice,
  getHarnessSessionPointers,
  type PromptRecord,
  type ToolName,
} from "dot-prompts";

export type ConformanceIssue = {
  code: string;
  message: string;
};

export type ConformanceResult = {
  ok: boolean;
  issues: ConformanceIssue[];
};

function fail(code: string, message: string): ConformanceResult {
  return { ok: false, issues: [{ code, message }] };
}

function ok(): ConformanceResult {
  return { ok: true, issues: [] };
}

function merge(...results: ConformanceResult[]): ConformanceResult {
  const issues = results.flatMap((r) => r.issues);
  return { ok: issues.length === 0, issues };
}

/** Assert a flushed generation produced one record with harness metadata. */
export function assertGenerationRecord(
  record: PromptRecord | undefined | null,
  opts: { harness: string; minTargets?: number } = { harness: "unknown" },
): ConformanceResult {
  if (!record) {
    return fail("missing_record", "Expected a provenance record after generation flush");
  }
  const issues: ConformanceIssue[] = [];
  if (typeof record.prompt !== "string" || record.prompt.trim().length === 0) {
    issues.push({ code: "empty_prompt", message: "Record prompt must be non-empty" });
  }
  if (!Array.isArray(record.targets) || record.targets.length < (opts.minTargets ?? 1)) {
    issues.push({
      code: "missing_targets",
      message: `Expected at least ${opts.minTargets ?? 1} target(s)`,
    });
  }
  const harness = record.metadata?.harness;
  if (harness !== opts.harness) {
    issues.push({
      code: "harness_mismatch",
      message: `Expected metadata.harness === ${JSON.stringify(opts.harness)}, got ${JSON.stringify(harness)}`,
    });
  }
  return { ok: issues.length === 0, issues };
}

/** Assert session pointers live at metadata[harness] when present. */
export function assertSessionPointers(record: PromptRecord): ConformanceResult {
  const harness = record.metadata?.harness;
  if (typeof harness !== "string" || harness.length === 0) {
    return fail("missing_harness", "metadata.harness is required");
  }
  const block = record.metadata?.[harness];
  if (block === undefined) {
    return ok();
  }
  if (block === null || typeof block !== "object") {
    return fail(
      "bad_session_block",
      `metadata.${harness} must be an object when present`,
    );
  }
  // Prefer reading via the portable helper when session fields exist.
  getHarnessSessionPointers(record.metadata);
  return ok();
}

/** Assert read notice text matches the shared formatter. */
export function assertNoticeText(
  text: string,
  matchCount: number,
  startLine: number,
  endLine?: number,
): ConformanceResult {
  const expected = formatLookupNotice(matchCount, startLine, endLine);
  if (!text.includes(expected)) {
    return fail(
      "notice_mismatch",
      `Expected notice containing ${JSON.stringify(expected)}`,
    );
  }
  return ok();
}

const REQUIRED_TOOLS: ToolName[] = ["prompts_read", "prompts_chain"];

/** Assert an adapter registered the required catalog tools (trace optional). */
export function assertRegisteredTools(
  registeredNames: Iterable<string>,
  opts: { requireTrace?: boolean } = {},
): ConformanceResult {
  const set = new Set(registeredNames);
  const issues: ConformanceIssue[] = [];
  for (const name of REQUIRED_TOOLS) {
    if (!set.has(name)) {
      issues.push({
        code: "missing_tool",
        message: `Missing required tool ${name} (from TOOL_CATALOG)`,
      });
    }
    const catalogName = TOOL_CATALOG[name].name;
    if (set.has(name) && name !== catalogName) {
      issues.push({
        code: "tool_name_mismatch",
        message: `Tool key ${name} should register as ${catalogName}`,
      });
    }
  }
  if (opts.requireTrace && !set.has("prompts_trace")) {
    issues.push({
      code: "missing_trace",
      message: "prompts_trace required for this harness but not registered",
    });
  }
  if (set.has("prompts_trace")) {
    const expected = TOOL_CATALOG.prompts_trace.name;
    if (expected !== "prompts_trace") {
      issues.push({
        code: "trace_catalog",
        message: "TOOL_CATALOG.prompts_trace.name must be prompts_trace",
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Assert referencedRecords were attached after read/trace during the generation. */
export function assertReferencedRecords(
  record: PromptRecord,
  expectedIds: string[],
): ConformanceResult {
  const refs = record.metadata?.referencedRecords;
  if (!Array.isArray(refs)) {
    return expectedIds.length === 0
      ? ok()
      : fail("missing_refs", "Expected metadata.referencedRecords array");
  }
  const missing = expectedIds.filter((id) => !refs.includes(id));
  if (missing.length > 0) {
    return fail(
      "incomplete_refs",
      `referencedRecords missing ids: ${missing.join(", ")}`,
    );
  }
  return ok();
}

/** Run the common post-flush checks for a generation record. */
export function assertHarnessRecord(
  record: PromptRecord | undefined | null,
  opts: {
    harness: string;
    minTargets?: number;
    referencedIds?: string[];
  },
): ConformanceResult {
  const base = assertGenerationRecord(record, {
    harness: opts.harness,
    minTargets: opts.minTargets,
  });
  if (!record || !base.ok) {
    return base;
  }
  return merge(
    base,
    assertSessionPointers(record),
    opts.referencedIds
      ? assertReferencedRecords(record, opts.referencedIds)
      : ok(),
  );
}

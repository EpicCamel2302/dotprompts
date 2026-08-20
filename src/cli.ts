#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { annotateFile } from "./core/hashline.js";
import { record } from "./core/record.js";
import { context, get, list, lookup, chain } from "./core/query.js";
import { resolvePromptsDir } from "./core/prompts-dir.js";
import { formatProvenanceChainForAgent } from "./provenance/chain.js";
import type { LookupQuery, RecordInput } from "./core/types.js";
import { ValidationError } from "./core/validate.js";

const program = new Command();

program
  .name("dot-prompts")
  .description("Provenance and observability for LLM-generated code edits")
  .option("--prompts-dir <path>", "Path to .prompts directory");

function getPromptsDir(cmd: Command): string {
  return resolvePromptsDir(cmd.optsWithGlobals().promptsDir as string | undefined);
}

function outputJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function outputError(error: unknown): never {
  if (error instanceof ValidationError) {
    process.stderr.write(
      `${JSON.stringify({ error: "validation", message: error.message, details: error.details }, null, 2)}\n`,
    );
    process.exit(1);
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({ error: "failure", message }, null, 2)}\n`,
  );
  process.exit(1);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

program
  .command("record")
  .description("Record a provenance entry from JSON on stdin")
  .option("--file <path>", "Read record JSON from a file instead of stdin")
  .action(async (_, cmd) => {
    try {
      const opts = cmd.optsWithGlobals();
      const raw = opts.file
        ? readFileSync(opts.file, "utf8")
        : await readStdin();
      const input = JSON.parse(raw) as RecordInput;
      const result = record(input, { promptsDir: getPromptsDir(cmd) });
      outputJson(result);
    } catch (error) {
      outputError(error);
    }
  });

program
  .command("lookup")
  .description("Find prior prompts by file, region, or symbol")
  .requiredOption("--path <path>", "File path to match")
  .option("--start-line <n>", "Start of query region (1-indexed)", parseInt)
  .option("--end-line <n>", "End of query region (1-indexed)", parseInt)
  .option("--symbol <name>", "Symbol name to match")
  .option(
    "--hashline <json>",
    'Optional hashline anchor JSON, e.g. \'{"line":42,"hash":"f1"}\'',
  )
  .option("--limit <n>", "Maximum matches to return", parseInt)
  .option("--min-confidence <n>", "Minimum confidence threshold", parseFloat)
  .action((_, cmd) => {
    try {
      const opts = cmd.optsWithGlobals();
      const query: LookupQuery = { path: opts.path };

      if (opts.startLine !== undefined) {
        query.startLine = opts.startLine;
      }
      if (opts.endLine !== undefined) {
        query.endLine = opts.endLine;
      }
      if (opts.symbol) {
        query.symbol = opts.symbol;
      }
      if (opts.hashline) {
        query.hashline = JSON.parse(opts.hashline);
      }

      const result = lookup(query, {
        promptsDir: getPromptsDir(cmd),
        limit: opts.limit,
        minConfidence: opts.minConfidence,
      });
      outputJson(result);
    } catch (error) {
      outputError(error);
    }
  });

program
  .command("read")
  .description("Annotate a file with optional hashline anchors (LINE#HASH)")
  .argument("<path>", "File path to read")
  .option("--format <format>", "Output format: json or human", "json")
  .action((filePath, _, cmd) => {
    try {
      const opts = cmd.optsWithGlobals();
      const lines = annotateFile(filePath);

      if (opts.format === "human") {
        for (const line of lines) {
          process.stdout.write(`${line.line}#${line.hash} ${line.content}\n`);
        }
        return;
      }

      outputJson({ path: filePath, lines });
    } catch (error) {
      outputError(error);
    }
  });

program
  .command("list")
  .description("List provenance records")
  .option("--limit <n>", "Maximum number of records", parseInt)
  .option("--since <iso>", "Only records after this ISO timestamp")
  .option("--path <path>", "Filter by file path")
  .option("--model <model>", "Filter by model slug")
  .action((_, cmd) => {
    try {
      const opts = cmd.optsWithGlobals();
      const records = list({
        promptsDir: getPromptsDir(cmd),
        limit: opts.limit,
        since: opts.since,
        path: opts.path,
        model: opts.model,
      });
      outputJson({ records });
    } catch (error) {
      outputError(error);
    }
  });

program
  .command("get")
  .description("Get a single record by id")
  .argument("<id>", "Record UUID")
  .action((id, _, cmd) => {
    try {
      const result = get(id, { promptsDir: getPromptsDir(cmd) });
      if (!result) {
        process.stderr.write(
          `${JSON.stringify({ error: "not_found", id }, null, 2)}\n`,
        );
        process.exit(1);
      }
      outputJson(result);
    } catch (error) {
      outputError(error);
    }
  });

program
  .command("chain")
  .description(
    "Walk metadata.referencedRecords from record id(s) — full provenance ancestry",
  )
  .argument("<ids...>", "One or more record UUIDs (roots of the chain)")
  .option("--max-depth <n>", "Maximum hops from root (default: unlimited)", parseInt)
  .option("--max-records <n>", "Maximum records to return (default: unlimited)", parseInt)
  .option("--format <format>", "Output format: json or text", "json")
  .action((ids, _, cmd) => {
    try {
      const opts = cmd.optsWithGlobals();
      const result = chain(ids, {
        promptsDir: getPromptsDir(cmd),
        maxDepth: opts.maxDepth,
        maxRecords: opts.maxRecords,
      });

      if (opts.format === "text") {
        process.stdout.write(`${formatProvenanceChainForAgent(result)}\n`);
        return;
      }

      outputJson(result);
    } catch (error) {
      outputError(error);
    }
  });

program
  .command("context")
  .description("Compact summary of recent records for agent context injection")
  .option("--limit <n>", "Maximum number of records", parseInt)
  .option("--since <iso>", "Only records after this ISO timestamp")
  .option("--path <path>", "Filter by file path")
  .option("--model <model>", "Filter by model slug")
  .action((_, cmd) => {
    try {
      const opts = cmd.optsWithGlobals();
      const result = context({
        promptsDir: getPromptsDir(cmd),
        limit: opts.limit ?? 10,
        since: opts.since,
        path: opts.path,
        model: opts.model,
      });
      outputJson(result);
    } catch (error) {
      outputError(error);
    }
  });

program.parseAsync(process.argv).catch(outputError);

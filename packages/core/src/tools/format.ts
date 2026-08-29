export function formatRecordFallback(opts: {
  prompt?: string;
  timestamp?: string;
  model?: string;
  recordId?: string;
  reason: string;
  extraLines?: string[];
}): string {
  const lines = [
    "Session trace unavailable locally.",
    `Reason: ${opts.reason}`,
    "",
    "Record fallback:",
  ];

  if (opts.recordId) {
    lines.push(`- record id: ${opts.recordId}`);
  }
  if (opts.timestamp) {
    lines.push(`- timestamp: ${opts.timestamp}`);
  }
  if (opts.model) {
    lines.push(`- model: ${opts.model}`);
  }
  if (opts.extraLines) {
    lines.push(...opts.extraLines);
  }
  if (opts.prompt) {
    lines.push("", "Prompt text:", opts.prompt);
  }

  lines.push(
    "",
    "The stored prompt is the portable provenance. Full session history is only available on the machine where the session file exists.",
  );

  return lines.join("\n");
}

export function toolErrorText(
  toolName: string,
  error: unknown,
  extra?: string,
): string {
  const message = error instanceof Error ? error.message : String(error);
  return [
    `${toolName} failed internally (${message}).`,
    extra ??
      "Use prompts_read for portable prompt text, or read `.prompts/records/` if you already have a record id.",
  ].join("\n");
}

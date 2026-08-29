/**
 * Portable session pointers on a record. Harnesses store them as
 * `metadata[metadata.harness]` (e.g. metadata.harness = "pi", metadata.pi.sessionFile).
 */
export type HarnessSessionPointers = {
  harness?: string;
  sessionId?: string;
  sessionFile?: string;
};

export function getHarnessSessionPointers(
  metadata: Record<string, unknown> | undefined,
): HarnessSessionPointers | null {
  if (!metadata) {
    return null;
  }

  const harness =
    typeof metadata.harness === "string" ? metadata.harness : undefined;
  const nested =
    harness !== undefined &&
    metadata[harness] !== null &&
    typeof metadata[harness] === "object"
      ? (metadata[harness] as Record<string, unknown>)
      : undefined;

  const sessionId =
    stringField(nested, "sessionId") ?? stringField(metadata, "sessionId");
  const sessionFile =
    stringField(nested, "sessionFile") ?? stringField(metadata, "sessionFile");

  if (!sessionId && !sessionFile) {
    return null;
  }

  return { harness, sessionId, sessionFile };
}

function stringField(
  obj: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = obj?.[key];
  return typeof value === "string" ? value : undefined;
}

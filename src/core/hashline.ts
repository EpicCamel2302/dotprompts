import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { HashlineAnchor, AnnotatedLine, ResolvedAnchor } from "./types.js";

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(input: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    crc = CRC32_TABLE[(crc ^ input.charCodeAt(i)) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** CRC32 top 8 bits as 2-char lowercase hex (hashline v1 default). */
export function computeLineHash(lineContent: string): string {
  const value = (crc32(lineContent) >>> 24) & 0xff;
  return value.toString(16).padStart(2, "0");
}

export function splitLines(content: string): {
  lines: string[];
  trailingNewline: boolean;
} {
  if (content.length === 0) {
    return { lines: [], trailingNewline: false };
  }

  const trailingNewline = content.endsWith("\n");
  const body = trailingNewline ? content.slice(0, -1) : content;
  if (body.length === 0) {
    return { lines: [], trailingNewline };
  }

  return { lines: body.split("\n"), trailingNewline };
}

export function readFileLines(content: string): string[] {
  const { lines } = splitLines(content);
  return lines;
}

export function annotateContent(content: string): AnnotatedLine[] {
  const lines = readFileLines(content);
  return lines.map((lineContent, index) => ({
    line: index + 1,
    hash: computeLineHash(lineContent),
    content: lineContent,
  }));
}

export function anchorsEqual(a: HashlineAnchor, b: HashlineAnchor): boolean {
  return a.line === b.line && a.hash === b.hash;
}

export function annotateFile(filePath: string): AnnotatedLine[] {
  const content = readFileSync(filePath, "utf8");
  return annotateContent(content);
}

export function resolveAnchor(
  filePath: string,
  anchor: HashlineAnchor,
): ResolvedAnchor {
  const lines = annotateFile(filePath);
  const match = lines.find((line) => line.line === anchor.line);

  if (!match) {
    return { content: "", valid: false, currentHash: "" };
  }

  return {
    content: match.content,
    valid: match.hash === anchor.hash,
    currentHash: match.hash,
  };
}

export function sha256Content(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sha256File(filePath: string): string {
  const content = readFileSync(filePath, "utf8");
  return sha256Content(content);
}

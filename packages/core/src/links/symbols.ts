export type ExtractedSymbol = {
  name: string;
  kind: string;
  line: number;
};

const SYMBOL_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  {
    kind: "function",
    pattern:
      /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
  },
  {
    kind: "method",
    pattern: /(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
  },
  {
    kind: "class",
    pattern: /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
  },
  {
    kind: "const",
    pattern:
      /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/,
  },
  {
    kind: "const",
    pattern: /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/,
  },
  {
    kind: "interface",
    pattern: /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
  },
  {
    kind: "type",
    pattern: /(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/,
  },
];

export function extractSymbolsInRange(
  content: string,
  startLine: number,
  endLine: number,
): ExtractedSymbol[] {
  const lines = content.split("\n");
  const symbols: ExtractedSymbol[] = [];
  const seen = new Set<string>();

  for (let lineNum = startLine; lineNum <= endLine && lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1] ?? "";
    for (const { kind, pattern } of SYMBOL_PATTERNS) {
      const match = line.match(pattern);
      if (match?.[1] && !seen.has(match[1])) {
        seen.add(match[1]);
        symbols.push({ name: match[1], kind, line: lineNum });
      }
    }
  }

  return symbols;
}

export function extractNearestSymbol(
  content: string,
  startLine: number,
  endLine: number,
): ExtractedSymbol | null {
  const inRange = extractSymbolsInRange(content, startLine, endLine);
  if (inRange.length > 0) {
    return inRange[0] ?? null;
  }

  const lines = content.split("\n");
  for (let lineNum = startLine; lineNum >= 1; lineNum--) {
    const line = lines[lineNum - 1] ?? "";
    for (const { kind, pattern } of SYMBOL_PATTERNS) {
      const match = line.match(pattern);
      if (match?.[1]) {
        return { name: match[1], kind, line: lineNum };
      }
    }
  }

  return null;
}

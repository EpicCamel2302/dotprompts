import { execFileSync } from "node:child_process";

export function getGitHead(cwd: string): string | null {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
    }).trim();
    return commit.length > 0 ? commit : null;
  } catch {
    return null;
  }
}

export function toRepoRelativePath(cwd: string, absoluteOrRelative: string): string {
  try {
    const relative = execFileSync(
      "git",
      ["rev-parse", "--show-prefix"],
      { cwd, encoding: "utf8" },
    ).trim();
    const normalized = absoluteOrRelative.replace(/\\/g, "/");
    if (normalized.startsWith("/")) {
      const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd,
        encoding: "utf8",
      }).trim();
      const rel = normalized.slice(root.length).replace(/^\//, "");
      return rel;
    }
    return normalized.replace(/^\.\//, "");
  } catch {
    return absoluteOrRelative.replace(/\\/g, "/").replace(/^\.\//, "");
  }
}

export function createGitLink(
  cwd: string,
  path: string,
): { type: "git"; path: string; commit: string } | null {
  const commit = getGitHead(cwd);
  if (!commit) {
    return null;
  }
  return {
    type: "git",
    path: toRepoRelativePath(cwd, path),
    commit,
  };
}

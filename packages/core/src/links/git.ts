import { execFileSync } from "node:child_process";

const GIT_STDIO = ["ignore", "pipe", "ignore"] as const;

export function getGitHead(cwd: string): string | null {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: [...GIT_STDIO],
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
      { cwd, encoding: "utf8", stdio: [...GIT_STDIO] },
    ).trim();
    const normalized = absoluteOrRelative.replace(/\\/g, "/");
    if (normalized.startsWith("/")) {
      const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd,
        encoding: "utf8",
        stdio: [...GIT_STDIO],
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
): { type: "git"; commit: string } | null {
  const commit = getGitHead(cwd);
  if (!commit) {
    return null;
  }
  return {
    type: "git",
    commit,
  };
}

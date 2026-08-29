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
  const normalized = absoluteOrRelative.replace(/\\/g, "/");
  try {
    if (normalized.startsWith("/")) {
      const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd,
        encoding: "utf8",
        stdio: [...GIT_STDIO],
      })
        .trim()
        .replace(/\\/g, "/");
      if (normalized === root || normalized.startsWith(`${root}/`)) {
        return normalized.slice(root.length).replace(/^\//, "");
      }
    }
    return normalized.replace(/^\.\//, "");
  } catch {
    if (normalized.startsWith("/")) {
      const cwdNorm = cwd.replace(/\\/g, "/").replace(/\/$/, "");
      if (normalized === cwdNorm || normalized.startsWith(`${cwdNorm}/`)) {
        return normalized.slice(cwdNorm.length).replace(/^\//, "");
      }
    }
    return normalized.replace(/^\.\//, "");
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

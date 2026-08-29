const MCP_PEER_PACKAGES = ["@modelcontextprotocol/sdk", "zod"] as const;

export const MCP_PEER_HINT =
  "dot-prompts MCP requires optional packages. Install them with: npm install @modelcontextprotocol/sdk zod";

export function isMissingMcpPeer(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as NodeJS.ErrnoException;
  if (err.code !== "ERR_MODULE_NOT_FOUND" && err.code !== "MODULE_NOT_FOUND") {
    return false;
  }
  const message = err.message ?? "";
  return MCP_PEER_PACKAGES.some((name) => message.includes(name));
}

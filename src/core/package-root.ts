import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** npm package root (repo root in this tree; parent of `dist/` when published). */
export function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");

const nestedEsbuildPath = path.join(root, "node_modules", "vite", "node_modules", "esbuild");

if (existsSync(nestedEsbuildPath)) {
  await rm(nestedEsbuildPath, { recursive: true, force: true });
  process.stdout.write(`Removed nested esbuild at: ${nestedEsbuildPath}\n`);
}

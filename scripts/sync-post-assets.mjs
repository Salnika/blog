import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");

const sourceDir = path.join(root, "post", "assets");
const destinationDir = path.join(root, "public", "post-assets");

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".DS_Store") {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

if (!existsSync(sourceDir)) {
  process.stdout.write(`No post assets found at: ${sourceDir}\n`);
  process.exit(0);
}

await rm(destinationDir, { recursive: true, force: true });
await copyDir(sourceDir, destinationDir);
process.stdout.write(`Synced post assets to: ${destinationDir}\n`);

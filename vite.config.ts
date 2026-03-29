import { defineConfig } from "vite-plus";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function syncPostAssets() {
  const sourceDir = path.resolve(rootDir, "post", "assets");
  const destinationDir = path.resolve(rootDir, "public", "post-assets");

  const copyDir = (src: string, dest: string) => {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".DS_Store") {
        continue;
      }

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
        continue;
      }

      if (entry.isFile()) {
        copyFileSync(srcPath, destPath);
      }
    }
  };

  if (!existsSync(sourceDir)) {
    return;
  }

  rmSync(destinationDir, { recursive: true, force: true });
  copyDir(sourceDir, destinationDir);
}

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [],
  },
  lint: {
    plugins: ["react", "oxc", "eslint", "typescript", "node", "react-perf", "import", "promise"],
    rules: {
      "no-console": "warn",
      "no-unexpected-multiline": "error",
      curly: ["error", "all", "consistent"],
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    passWithNoTests: true,
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    {
      name: "sync-post-assets",
      buildStart() {
        syncPostAssets();
      },
      configureServer() {
        syncPostAssets();
      },
    },
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(rootDir, "./src"),
    },
  },
});

import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";

function syncPostAssets() {
  const sourceDir = path.resolve(__dirname, "post", "assets");
  const destinationDir = path.resolve(__dirname, "public", "post-assets");

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
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

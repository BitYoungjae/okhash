import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

// The demo runs against the built package entry points (the same files the
// `exports` map ships), so its examples track real published behavior. Run
// `npm run build` first, or use `npm run demo:build`, which builds the package.
export default defineConfig({
  root: here,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "okhash/palette": resolve(repoRoot, "dist/palette/index.mjs"),
      okhash: resolve(repoRoot, "dist/index.mjs"),
    },
  },
  server: {
    fs: {
      // Allow importing the built package from the repo root during dev.
      allow: [repoRoot],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

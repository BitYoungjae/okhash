import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "palette/index": "palette/src/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
});

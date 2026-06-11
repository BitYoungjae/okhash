import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const budgets = [
  {
    name: "core entry graph",
    entry: "dist/index.mjs",
    limit: 7_500,
  },
  {
    name: "palette entry file",
    entry: "dist/palette/index.mjs",
    limit: 1_500,
  },
];

let failed = false;

for (const budget of budgets) {
  const bytes = await gzippedEntryGraphSize(budget.entry);
  const kib = (bytes / 1024).toFixed(2);
  const limitKib = (budget.limit / 1024).toFixed(2);

  console.log(`${budget.name}: ${kib} KiB gzip (limit ${limitKib} KiB)`);

  if (bytes > budget.limit) {
    failed = true;
  }
}

if (failed) {
  throw new Error("size gate failed");
}

async function gzippedEntryGraphSize(entry) {
  const seen = new Set();
  let combined = "";

  async function visit(filePath) {
    const absolute = resolve(filePath);

    if (seen.has(absolute)) {
      return;
    }

    seen.add(absolute);
    const source = await readFile(absolute, "utf8");
    combined += source;

    for (const specifier of source.matchAll(
      /\b(?:import|export)\s*(?:[^"']*from\s*)?["'](\.\/[^"']+)["']/g,
    )) {
      await visit(resolve(absolute, "..", specifier[1]));
    }
  }

  await visit(entry);
  return gzipSync(combined).byteLength;
}

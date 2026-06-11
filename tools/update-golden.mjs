import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createColorHash } from "../dist/index.mjs";
import { GOLDEN_CASES, buildGoldenInputs } from "./golden-corpus.mjs";

const outputPath = resolve("test/fixtures/golden-corpus.json");
const inputs = buildGoldenInputs();
const cases = GOLDEN_CASES.map((entry) => {
  const colorize = createColorHash(entry.options);

  return {
    name: entry.name,
    options: entry.options,
    hex: inputs.map((input) => colorize.hex(input)),
  };
});

const fixture = {
  version: 1,
  generatedBy: "tools/update-golden.mjs",
  description:
    "Frozen OKH1 hex contract. Regenerate only for deliberate semver-major output changes.",
  inputs,
  cases,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`wrote ${outputPath} (${inputs.length} inputs x ${cases.length} cases)`);

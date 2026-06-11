import { createRequire } from "node:module";

import { distinctAssign, paletteFrom } from "okhash/palette";
import * as okhash from "okhash";
import { createColorHash, hashColor } from "okhash";

const require = createRequire(import.meta.url);
const requiredOkhash = require("okhash");
const requiredPalette = require("okhash/palette");

const checks = [
  { name: "okhash:createColorHash", value: createColorHash },
  { name: "okhash:hashColor", value: hashColor },
  { name: "okhash/palette:paletteFrom", value: paletteFrom },
  { name: "okhash/palette:distinctAssign", value: distinctAssign },
  { name: "require(okhash):createColorHash", value: requiredOkhash.createColorHash },
  { name: "require(okhash):hashColor", value: requiredOkhash.hashColor },
  { name: "require(okhash/palette):paletteFrom", value: requiredPalette.paletteFrom },
  { name: "require(okhash/palette):distinctAssign", value: requiredPalette.distinctAssign },
];

for (const { name, value } of checks) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} is not a function`);
  }
}

// Exercise the README quick-start examples against the resolved package so the
// published build cannot drift from the documented output.
const readmeExamples = [
  { name: "hashColor.hex(Alice)", actual: hashColor.hex("Alice"), expected: "#a293cb" },
  {
    name: "hashColor.css(Alice)",
    actual: hashColor.css("Alice"),
    expected: "oklch(0.696651 0.082351 296.496)",
  },
  {
    name: 'createColorHash({mood:"vibrant",seed:0xc0ffee}).hex(user@acme.io)',
    actual: createColorHash({ mood: "vibrant", seed: 0xc0ffee }).hex("user@acme.io"),
    expected: "#6a60db",
  },
  {
    name: "paletteFrom(acme-corp, 5)[0]",
    actual: paletteFrom("acme-corp", 5)[0].hex(),
    expected: "#ca767f",
  },
  {
    name: "distinctAssign([...]).get(frontend)",
    actual: distinctAssign(["frontend", "infra", "design", "data"]).get("frontend").hex(),
    expected: "#c8a447",
  },
];

for (const { name, actual, expected } of readmeExamples) {
  if (actual !== expected) {
    throw new Error(`README example mismatch: ${name} produced ${actual}, expected ${expected}`);
  }
}

if ("default" in okhash) {
  throw new TypeError("okhash must not expose a default export");
}

if ("default" in requiredOkhash) {
  throw new TypeError("require(okhash) must not expose a default export");
}

try {
  await import("okhash/compat");
  throw new TypeError("okhash must not expose a compat subpath");
} catch (error) {
  if (!isPackagePathNotExported(error)) {
    throw error;
  }
}

console.log("package export smoke test passed");

function isPackagePathNotExported(error) {
  return (
    error instanceof Error && "code" in error && error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED"
  );
}

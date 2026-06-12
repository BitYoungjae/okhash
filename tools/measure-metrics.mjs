// Generate evidence-backed metrics for the README and demo.
//
// Every number the demo or README presents as a fact must trace back to a
// repository command or generated fixture. This script is that command: it
// drives the built package through the public API, measures distribution and
// output-stability properties, reads the gzipped entry-graph sizes, and writes
// a single JSON file the demo imports and the README quotes.
//
//   node tools/measure-metrics.mjs [outFile]
//
// Performance numbers (ns/op) intentionally live in `bench/gate.mjs`, which is
// the authoritative latency gate; this file records distribution, stability,
// size, and example-output facts only.

import { gzipSync } from "node:zlib";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createColorHash, hashColor } from "../dist/index.mjs";
import { paletteFrom, distinctAssign } from "../dist/palette/index.mjs";
import { buildGoldenInputs } from "./golden-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DIST = resolve(ROOT, "dist");

const HUE_BINS = 359;
const DISTRIBUTION_SAMPLES = 50_000;
const SIMILAR_INPUT_PAIRS = 1_000;
const GAMUT_SAMPLES = 1_000_000;

function chiSquareOfHue() {
  const counts = Array.from({ length: HUE_BINS }, () => 0);
  for (let i = 0; i < DISTRIBUTION_SAMPLES; i += 1) {
    const t = hashColor.oklch(`distribution-${i}`).h / 360;
    counts[Math.min(Math.floor(t * HUE_BINS), HUE_BINS - 1)] += 1;
  }
  const expected = DISTRIBUTION_SAMPLES / HUE_BINS;
  const chiSquare = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
  return { chiSquare, df: HUE_BINS - 1, samples: DISTRIBUTION_SAMPLES };
}

function similarInputProximity() {
  let close = 0;
  for (let i = 0; i < SIMILAR_INPUT_PAIRS; i += 1) {
    const a = hashColor.oklch(`user-${i}`).h;
    const b = hashColor.oklch(`user-${i + 1}`).h;
    const delta = Math.abs(a - b);
    if (Math.min(delta, 360 - delta) < 10) close += 1;
  }
  return { close, pairs: SIMILAR_INPUT_PAIRS };
}

// I2: every public format is a pure function of the canonical 8-bit triplet,
// and css() is exactly format(oklch()). Verified over the whole golden corpus
// across the full option matrix using only the public API.
function outputStability() {
  const inputs = buildGoldenInputs();
  const cases = [
    {},
    { mood: "pastel" },
    { mood: "vibrant" },
    { mood: "jewel" },
    { mood: "earth" },
    { mood: "neon" },
    { cvdSafe: true },
    { surface: "dark" },
    { seed: 1 },
    { seed: 0xc0ffee },
    { hk: false },
  ];

  let checks = 0;
  let determinismMismatches = 0;
  let cssIdentityMismatches = 0;
  let rgbDomainViolations = 0;

  for (const options of cases) {
    const colorize = createColorHash(options);
    for (const input of inputs) {
      const a = colorize(input);
      const b = colorize(input);
      checks += 1;

      if (a.hex() !== b.hex() || colorize.hex(input) !== a.hex()) determinismMismatches += 1;

      const o = a.oklch();
      const expectedCss = `oklch(${o.l.toFixed(6)} ${o.c.toFixed(6)} ${o.h.toFixed(3)})`;
      if (a.css() !== expectedCss) cssIdentityMismatches += 1;

      const rgb = a.rgb();
      if (!rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) rgbDomainViolations += 1;
    }
  }

  return {
    checks,
    corpusSize: inputs.length,
    optionCases: cases.length,
    determinismMismatches,
    cssIdentityMismatches,
    rgbDomainViolations,
  };
}

// Every generated color is sRGB by construction (output is a quantized 8-bit
// triplet). Confirm that holds across a large default-mood sample.
function gamutCoverage() {
  let outOfGamut = 0;
  for (let i = 0; i < GAMUT_SAMPLES; i += 1) {
    const [r, g, b] = hashColor.rgb(`gamut-${i}`);
    if (
      !Number.isInteger(r) ||
      r < 0 ||
      r > 255 ||
      !Number.isInteger(g) ||
      g < 0 ||
      g > 255 ||
      !Number.isInteger(b) ||
      b < 0 ||
      b > 255
    ) {
      outOfGamut += 1;
    }
  }
  return { samples: GAMUT_SAMPLES, outOfGamut };
}

async function gzipSize(files) {
  let combined = "";
  for (const file of files) combined += await readFile(file, "utf8");
  return gzipSync(combined).byteLength;
}

async function entryGraphSize(entry) {
  // Mirror tools/size-gate.mjs: walk the relative import graph and gzip it.
  const seen = new Set();
  let combined = "";
  async function visit(filePath) {
    const absolute = resolve(filePath);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const source = await readFile(absolute, "utf8");
    combined += source;
    for (const m of source.matchAll(
      /\b(?:import|export)\s*(?:[^"']*from\s*)?["'](\.\/[^"']+)["']/g,
    )) {
      await visit(resolve(absolute, "..", m[1]));
    }
  }
  await visit(entry);
  return gzipSync(combined).byteLength;
}

async function sizes() {
  const distFiles = await readdir(DIST);
  const specFile = distFiles.find((f) => /^spec-.*\.mjs$/.test(f));
  const coreFiles = [resolve(DIST, "index.mjs")];
  if (specFile) coreFiles.push(resolve(DIST, specFile));
  const coreBytes = await gzipSize(coreFiles);
  const paletteBytes = await entryGraphSize(resolve(DIST, "palette/index.mjs"));
  return {
    coreGzipBytes: coreBytes,
    coreGzipKib: +(coreBytes / 1024).toFixed(2),
    paletteGzipBytes: paletteBytes,
    paletteGzipKib: +(paletteBytes / 1024).toFixed(2),
  };
}

function snapshot(input, options) {
  const colorize = createColorHash(options);
  const c = colorize(input);
  return {
    input,
    options,
    hex: c.hex(),
    rgb: c.rgb(),
    oklch: c.oklch(),
    css: c.css(),
    foreground: c.foreground(),
  };
}

function examples() {
  const distinct = distinctAssign(["frontend", "infra", "design", "data"]);
  return {
    default: snapshot("Alice Park", {}),
    vibrantSeeded: snapshot("user@acme.io", { mood: "vibrant", seed: 0xc0ffee }),
    pastel: snapshot("design", { mood: "pastel" }),
    palette: paletteFrom("acme-corp", 8).map((c) => c.hex()),
    distinct: Object.fromEntries([...distinct.entries()].map(([k, c]) => [k, c.hex()])),
  };
}

// Provisional constants that freeze at the v1 release candidate. The literal
// values are the shipped defaults; the booleans verify, against the real
// package, that the H-K correction and dark variant are active and move in the
// documented direction, so the demo never presents them as final or unbacked.
function calibration() {
  const hkOn = createColorHash({ hk: true });
  const hkOff = createColorHash({ hk: false });
  const inputs = buildGoldenInputs();
  const hkChanged = inputs.some((input) => hkOn.hex(input) !== hkOff.hex(input));

  const light = createColorHash({ surface: "light", hk: false });
  const dark = createColorHash({ surface: "dark", hk: false });
  let darkLifts = 0;
  let darkMutes = 0;
  const probe = inputs.slice(0, 200);
  for (const input of probe) {
    const l = light.oklch(input);
    const d = dark.oklch(input);
    if (d.l > l.l) darkLifts += 1;
    if (d.c <= l.c) darkMutes += 1;
  }

  return {
    status: "provisional",
    note: "Provisional constants. Frozen at the v1 release candidate.",
    kHk: 0.32,
    hkZeroHue: 110,
    hkMaxHue: 290,
    darkLightnessShift: 0.1,
    darkLightnessCap: 0.86,
    darkChromaScale: 0.72,
    distinctThreshold: 0.09,
    hkActive: hkChanged,
    darkVariantLiftsLightness: darkLifts === probe.length,
    darkVariantMutesChroma: darkMutes === probe.length,
  };
}

async function main() {
  const distribution = chiSquareOfHue();
  const proximity = similarInputProximity();
  const stability = outputStability();
  const gamut = gamutCoverage();
  const size = await sizes();
  const sampleOutputs = examples();
  const calibrationData = calibration();

  const metrics = {
    generatedBy: "node tools/measure-metrics.mjs",
    note: "Distribution/stability/size facts generated from the built package. Latency lives in bench/gate.mjs.",
    distribution,
    proximity,
    stability,
    gamut,
    size,
    calibration: calibrationData,
    examples: sampleOutputs,
  };

  const outFile = process.argv[2];
  if (outFile) {
    const target = resolve(ROOT, outFile);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(metrics, null, 2) + "\n");
    process.stderr.write(`wrote ${outFile}\n`);
  }

  process.stderr.write(
    [
      `hue chi-square (df ${distribution.df}, ${distribution.samples} samples): ${distribution.chiSquare.toFixed(1)}`,
      `similar-input proximity: ${proximity.close}/${proximity.pairs} within 10deg`,
      `output stability: ${stability.checks} checks, det=${stability.determinismMismatches}, cssId=${stability.cssIdentityMismatches}, rgb=${stability.rgbDomainViolations}`,
      `gamut: ${gamut.outOfGamut}/${gamut.samples} out-of-gamut`,
      `size: core ${size.coreGzipKib} KiB gzip, palette ${size.paletteGzipKib} KiB gzip`,
      `example hashColor("Alice Park").hex(): ${sampleOutputs.default.hex} css: ${sampleOutputs.default.css}`,
    ].join("\n") + "\n",
  );

  if (!outFile) process.stdout.write(JSON.stringify(metrics, null, 2) + "\n");
}

await main();

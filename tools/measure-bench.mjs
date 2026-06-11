// Measure the default hot-path latency and write it as an evidence-backed
// fixture the demo reads. The authoritative latency gate is bench/gate.mjs;
// this records the same measurement in JSON so the demo never shows a
// hand-written ns/op number.
//
//   node tools/measure-bench.mjs [outFile]

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Bench } from "tinybench";

import { createColorHash, hashColor } from "../dist/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// A small spread of inputs so the measured path is not a single cached string.
const INPUTS = Array.from({ length: 64 }, (_, index) => `bench-input-${index}`);

function measureUncachedHex() {
  const colorize = createColorHash({ cache: 0 });
  const bench = new Bench({ iterations: 200_000, warmupIterations: 20_000 });
  let cursor = 0;

  bench.add("hashColor.hex default", () => {
    cursor = (cursor + 1) & 63;
    colorize.hex(INPUTS[cursor]);
  });

  return bench;
}

async function main() {
  // Touch the singleton so its module-load work is warm before timing.
  hashColor.hex("warmup");

  const bench = measureUncachedHex();
  await bench.run();

  const task = bench.tasks[0];
  const nsPerOp = task.result.latency.mean * 1_000_000;
  const opsPerSec = task.result.throughput.mean;

  const result = {
    generatedBy: "node tools/measure-bench.mjs",
    note: "Default uncached hex() latency. Authoritative gate: bench/gate.mjs.",
    node: process.version,
    hexNsPerOp: +nsPerOp.toFixed(1),
    hexOpsPerSec: Math.round(opsPerSec),
  };

  const outFile = process.argv[2];
  if (outFile) {
    const target = resolve(ROOT, outFile);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(result, null, 2) + "\n");
    process.stderr.write(`wrote ${outFile}\n`);
  }

  process.stderr.write(
    `hashColor.hex default: ${result.hexNsPerOp} ns/op (${result.hexOpsPerSec.toLocaleString()} ops/s) on ${result.node}\n`,
  );

  if (!outFile) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

await main();

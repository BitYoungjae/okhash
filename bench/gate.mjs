import { Bench } from "tinybench";

import { createColorHash, hashColor } from "../dist/index.mjs";

const DEFAULT_HEX_LIMIT_NS = readLimit("OKHASH_BENCH_DEFAULT_HEX_LIMIT_NS", 150);
const CACHE_HIT_LIMIT_NS = readLimit("OKHASH_BENCH_CACHE_HIT_LIMIT_NS", 20);
const CACHE_HIT_ITERATIONS = 5_000_000;
const colorize = createColorHash();
let sink;

colorize("Alice");

const bench = new Bench({ iterations: 250_000, warmupIterations: 20_000 });

bench.add("hashColor.hex default", () => {
  hashColor.hex("Alice");
});

await bench.run();

for (const task of bench.tasks) {
  const ns = task.result.latency.mean * 1_000_000;

  console.log(`${task.name}: ${ns.toFixed(1)} ns/op (limit ${DEFAULT_HEX_LIMIT_NS} ns/op)`);

  if (ns > DEFAULT_HEX_LIMIT_NS) {
    throw new Error(`${task.name} exceeded performance gate`);
  }
}

const loopOverhead = measureCacheLoop(() => sink);
const cacheHit = measureCacheLoop(() => colorize("Alice"));
const calibratedCacheHit = Math.max(0, cacheHit - loopOverhead);

console.log(
  `createColorHash cache hit: ${calibratedCacheHit.toFixed(1)} ns/op (limit ${CACHE_HIT_LIMIT_NS} ns/op)`,
);

if (calibratedCacheHit > CACHE_HIT_LIMIT_NS) {
  throw new Error("createColorHash cache hit exceeded performance gate");
}

if (sink.hex() !== "#a293cb") {
  throw new Error("cache hit benchmark sink did not preserve the expected color");
}

function measureCacheLoop(fn) {
  for (let index = 0; index < 100_000; index += 1) {
    sink = fn();
  }

  const started = process.hrtime.bigint();

  for (let index = 0; index < CACHE_HIT_ITERATIONS; index += 1) {
    sink = fn();
  }

  return Number(process.hrtime.bigint() - started) / CACHE_HIT_ITERATIONS;
}

function readLimit(name, fallback) {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  const limit = Number(value);

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new TypeError(`${name} must be a positive finite number`);
  }

  return limit;
}

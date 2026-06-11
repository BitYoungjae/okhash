import { deltaEOk, rgbToOklab, type OklabPoint } from "../../src/oklab.js";
import {
  assertStringInput,
  colorFromGeneratedOklch,
  generatedOklchFromSamples,
  hashSamples,
  normalizeInput,
  type HashSamples,
} from "../../src/pipeline.js";
import { resolveOkhashConfig, type ResolvedOkhashConfig } from "../../src/spec.js";
import type { Color, OkhashOptions } from "../../src/index.js";

export interface DistinctOptions extends OkhashOptions {
  threshold?: number;
}

const GOLDEN_ANGLE = 137.50776405003785;
const GOLDEN_FRACTION = GOLDEN_ANGLE / 360;
const LIGHTNESS_OFFSETS = [0, 0.05, -0.05] as const;
const DEFAULT_THRESHOLD = 0.09;
const MAX_DISTINCT_ATTEMPTS = 360;

export function paletteFrom(seed: string, n: number, options?: OkhashOptions): Color[] {
  assertStringInput(seed);
  assertCount(n);

  if (n === 0) {
    return [];
  }

  const config = resolveOkhashConfig(options);
  const samples = hashSamples(normalizeInput(seed, config), config);
  const colors: Color[] = [];

  for (let index = 0; index < n; index += 1) {
    colors.push(
      colorFromGeneratedOklch(
        generatedOklchFromSamples(samples, config, {
          hueT: advanceHueT(samples.hue, index),
          lightnessOffset: LIGHTNESS_OFFSETS[index % LIGHTNESS_OFFSETS.length],
        }),
        config,
      ),
    );
  }

  return colors;
}

export function distinctAssign(
  keys: readonly string[],
  options?: DistinctOptions,
): Map<string, Color> {
  assertKeys(keys);
  const { threshold: thresholdOption, okhashOptions } = splitDistinctOptions(options);
  const threshold = normalizeThreshold(thresholdOption);
  const config = resolveOkhashConfig(okhashOptions);
  const assigned = new Map<string, Color>();
  const accepted: Array<{ lab: OklabPoint; color: Color }> = [];

  for (const key of uniqueSorted(keys)) {
    const samples = hashSamples(normalizeInput(key, config), config);
    const candidate = chooseDistinctColor(samples, config, accepted, threshold);

    assigned.set(key, candidate.color);
    accepted.push(candidate);
  }

  return assigned;
}

function chooseDistinctColor(
  samples: HashSamples,
  config: ResolvedOkhashConfig,
  accepted: ReadonlyArray<{ lab: OklabPoint }>,
  threshold: number,
): { lab: OklabPoint; color: Color } {
  let best = colorCandidate(samples, config, 0);
  let bestDistance = minimumDistance(best.lab, accepted);

  if (bestDistance >= threshold) {
    return best;
  }

  for (let attempt = 1; attempt <= MAX_DISTINCT_ATTEMPTS; attempt += 1) {
    const candidate = colorCandidate(samples, config, attempt);
    const distance = minimumDistance(candidate.lab, accepted);

    if (distance >= threshold) {
      return candidate;
    }

    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function colorCandidate(
  samples: HashSamples,
  config: ResolvedOkhashConfig,
  attempt: number,
): { lab: OklabPoint; color: Color } {
  const base = generatedOklchFromSamples(samples, config, {
    hueT: advanceHueT(samples.hue, attempt),
  });
  const color = colorFromGeneratedOklch(base, config);

  return { color, lab: rgbToOklab(color.rgb()) };
}

function minimumDistance(lab: OklabPoint, accepted: ReadonlyArray<{ lab: OklabPoint }>): number {
  let minimum = Number.POSITIVE_INFINITY;

  for (const entry of accepted) {
    minimum = Math.min(minimum, deltaEOk(lab, entry.lab));
  }

  return minimum;
}

function advanceHueT(base: number, step: number): number {
  const advanced = base + step * GOLDEN_FRACTION;
  return advanced - Math.floor(advanced);
}

function uniqueSorted(keys: readonly string[]): string[] {
  return [...new Set(keys)].sort(compareCodeUnits);
}

function compareCodeUnits(first: string, second: string): number {
  if (first < second) {
    return -1;
  }

  if (first > second) {
    return 1;
  }

  return 0;
}

function assertCount(n: number): void {
  if (!Number.isInteger(n)) {
    throw new TypeError("okhash palette size must be an integer");
  }

  if (n < 0) {
    throw new RangeError("okhash palette size must be >= 0");
  }
}

function assertKeys(keys: readonly string[]): void {
  if (!Array.isArray(keys)) {
    throw new TypeError("okhash distinctAssign keys must be an array");
  }

  for (const key of keys) {
    if (typeof key !== "string") {
      throw new TypeError("okhash distinctAssign keys must contain only strings");
    }
  }
}

function splitDistinctOptions(options: DistinctOptions | undefined): {
  threshold: number | undefined;
  okhashOptions: OkhashOptions | undefined;
} {
  if (options === undefined) {
    return { threshold: undefined, okhashOptions: undefined };
  }

  const { threshold, ...okhashOptions } = options;
  return { threshold, okhashOptions };
}

function normalizeThreshold(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_THRESHOLD;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("okhash distinctAssign threshold must be finite");
  }

  if (value < 0) {
    throw new RangeError("okhash distinctAssign threshold must be >= 0");
  }

  return value;
}

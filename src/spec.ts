import { normalizeSeed } from "./hash.js";
import { CVD_SAFE_PRESET, MOODS, type HueWeight } from "./moods.js";
import {
  maxChromaForLightnessHue,
  maxSafeChromaInLightnessRange,
  normalizeHue,
  safeChromaForLightness,
} from "./oklab.js";
import type { ChannelSpec, ChromaRange, ChromaSpec, Mood, OkhashOptions } from "./types.js";

type Sampler = (t: number) => number;
type ChromaSampler = (t: number, lightness: number, hue: number) => number;

interface Bounds {
  min: number;
  max: number;
}

export interface ResolvedOkhashConfig {
  hue: Sampler;
  lightness: Sampler;
  chroma: ChromaSampler;
  seed: number;
  normalize: "NFC" | false;
  cacheSize: number;
  hk: boolean;
  surface: "light" | "dark";
}

interface PreparedRange {
  min: number;
  max: number;
  width: number;
}

interface PreparedHueRange {
  min: number;
  width: number;
}

type PreparedChromaSpec =
  | { kind: "constant"; value: number }
  | { kind: "discrete"; values: readonly number[] }
  | { kind: "range"; min: number; max: number | "safe" }
  | { kind: "ranges"; ranges: readonly ChromaRange[] };

interface ChromaInput {
  mode: "uniform" | "relative";
  range: ChromaSpec;
}

const HUE_WEIGHT_LUT_SIZE = 1024;

export function resolveOkhashConfig(options: OkhashOptions = {}): ResolvedOkhashConfig {
  assertOptionsObject(options);

  const mood = MOODS[normalizeMood(options.mood)];
  const cvdSafe = normalizeBooleanOption("cvdSafe", options.cvdSafe, false);
  const preset = cvdSafe ? CVD_SAFE_PRESET : mood;
  const hue =
    options.hue === undefined && preset.hueWeights !== undefined
      ? buildWeightedHueSampler(preset.hueWeights)
      : buildHueSampler(options.hue ?? preset.hue);
  const lightnessSpec = options.lightness ?? preset.lightness;
  const lightness = buildUnitSampler("lightness", lightnessSpec);
  const lightnessBounds = boundsForNumberSpec("lightness", lightnessSpec);
  const chromaInput = normalizeChromaInput(options.chroma, preset.chroma, preset.chromaMode);
  const chroma = buildChromaSampler(chromaInput, lightnessBounds);
  const hkFallback = cvdSafe ? CVD_SAFE_PRESET.hk : mood.hk;

  return {
    hue,
    lightness,
    chroma,
    seed: normalizeSeed(options.seed),
    normalize: normalizeNormalizeOption(options.normalize),
    cacheSize: normalizeCacheSize(options.cache),
    hk: normalizeBooleanOption("hk", options.hk, hkFallback),
    surface: normalizeSurfaceOption(options.surface),
  };
}

function assertOptionsObject(options: OkhashOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("okhash options must be an object");
  }
}

function buildHueSampler(spec: ChannelSpec): Sampler {
  if (typeof spec === "number") {
    assertFinite("hue", spec);
    assertHueValue(spec);
    return () => normalizeHue(spec);
  }

  if (Array.isArray(spec)) {
    const entries = spec as readonly unknown[];
    if (entries.length === 0) {
      throw new RangeError("okhash hue array must not be empty");
    }

    if (entries.every(isObject)) {
      const ranges = entries.map(prepareHueRange);
      const totalWidth = ranges.reduce((sum, range) => sum + range.width, 0);
      if (totalWidth <= 0) {
        throw new RangeError("okhash hue ranges must have positive width");
      }
      return (t) => sampleHueRanges(ranges, totalWidth, t);
    }

    const values = entries.map((value) => {
      if (typeof value !== "number") {
        throw new TypeError("okhash hue array must contain only numbers or ranges");
      }
      assertFinite("hue", value);
      assertHueValue(value);
      return normalizeHue(value);
    });

    return (t) => values[Math.min(Math.floor(t * values.length), values.length - 1)];
  }

  const range = prepareHueRange(spec);
  return (t) => normalizeHue(range.min + t * range.width);
}

function buildWeightedHueSampler(weights: readonly HueWeight[]): Sampler {
  if (weights.length === 0) {
    throw new RangeError("okhash hue weight table must not be empty");
  }

  const ranges = weights.map((weight) => {
    assertFinite("hue weight", weight.weight);
    if (weight.weight < 0) {
      throw new RangeError("okhash hue weight must be >= 0");
    }

    const range = prepareHueRange(weight);
    return { ...range, weight: weight.weight, weightedWidth: range.width * weight.weight };
  });
  const totalWidth = ranges.reduce((sum, range) => sum + range.weightedWidth, 0);

  if (totalWidth <= 0) {
    throw new RangeError("okhash hue weight table must have positive width");
  }

  const lut = new Float64Array(HUE_WEIGHT_LUT_SIZE);
  for (let index = 0; index < HUE_WEIGHT_LUT_SIZE; index += 1) {
    lut[index] = sampleWeightedHueRanges(ranges, totalWidth, index / (HUE_WEIGHT_LUT_SIZE - 1));
  }

  return (t) => {
    const scaled = t * (HUE_WEIGHT_LUT_SIZE - 1);
    const lowerIndex = Math.floor(scaled);
    const upperIndex = Math.min(lowerIndex + 1, HUE_WEIGHT_LUT_SIZE - 1);
    const amount = scaled - lowerIndex;

    return normalizeHue(lut[lowerIndex] + (lut[upperIndex] - lut[lowerIndex]) * amount);
  };
}

function buildUnitSampler(name: "lightness", spec: ChannelSpec): Sampler {
  if (typeof spec === "number") {
    assertUnitValue(name, spec);
    return () => spec;
  }

  if (Array.isArray(spec)) {
    const entries = spec as readonly unknown[];
    if (entries.length === 0) {
      throw new RangeError(`okhash ${name} array must not be empty`);
    }

    if (entries.every(isObject)) {
      const ranges = entries.map((range) => prepareUnitRange(name, range));
      const totalWidth = ranges.reduce((sum, range) => sum + range.width, 0);
      if (totalWidth <= 0) {
        throw new RangeError(`okhash ${name} ranges must have positive width`);
      }
      return (t) => sampleRanges(ranges, totalWidth, t);
    }

    const values = entries.map((value) => {
      if (typeof value !== "number") {
        throw new TypeError(`okhash ${name} array must contain only numbers or ranges`);
      }
      assertUnitValue(name, value);
      return value;
    });

    return (t) => values[Math.min(Math.floor(t * values.length), values.length - 1)];
  }

  const range = prepareUnitRange(name, spec);
  return (t) => range.min + t * range.width;
}

function buildChromaSampler(input: ChromaInput, lightnessBounds: Bounds): ChromaSampler {
  const prepared = prepareChromaSpec(input.range, input.mode);
  const lowerBound = chromaLowerBound(prepared);

  if (input.mode === "relative") {
    return (t, lightness, hue) =>
      sampleRelativeChroma(prepared, t) * maxChromaForLightnessHue(lightness, hue);
  }

  const maxSafe = maxSafeChromaInLightnessRange(lightnessBounds.min, lightnessBounds.max);

  if (lowerBound > maxSafe) {
    throw new RangeError(
      "okhash chroma minimum cannot fit within the configured lightness range; use relative chroma mode.",
    );
  }

  if (prepared.kind === "constant") {
    return (_t, lightness) => Math.min(prepared.value, safeChromaForLightness(lightness));
  }

  if (prepared.kind === "discrete") {
    return (t, lightness) => {
      const value =
        prepared.values[
          Math.min(Math.floor(t * prepared.values.length), prepared.values.length - 1)
        ];
      return Math.min(value, safeChromaForLightness(lightness));
    };
  }

  if (prepared.kind === "range") {
    return (t, lightness) => sampleChromaRange(prepared, t, safeChromaForLightness(lightness));
  }

  return (t, lightness) =>
    sampleChromaRanges(prepared.ranges, t, safeChromaForLightness(lightness));
}

function normalizeChromaInput(
  chroma: OkhashOptions["chroma"] | undefined,
  fallbackRange: ChromaSpec,
  fallbackMode: "uniform" | "relative",
): ChromaInput {
  if (chroma === undefined) {
    return { mode: fallbackMode, range: fallbackRange };
  }

  if (isObject(chroma) && "mode" in chroma) {
    if (chroma.mode !== "uniform" && chroma.mode !== "relative") {
      throw new RangeError('okhash chroma mode must be "uniform" or "relative"');
    }

    if (!("range" in chroma)) {
      throw new TypeError("okhash chroma mode object must have a range");
    }

    return { mode: chroma.mode, range: chroma.range as ChromaSpec };
  }

  return { mode: fallbackMode, range: chroma };
}

function prepareChromaSpec(spec: ChromaSpec, mode: "uniform" | "relative"): PreparedChromaSpec {
  if (typeof spec === "number") {
    assertChromaValue(spec);
    if (mode === "relative") {
      assertChromaRatioValue(spec);
    }
    return { kind: "constant", value: spec };
  }

  if (Array.isArray(spec)) {
    const entries = spec as readonly unknown[];
    if (entries.length === 0) {
      throw new RangeError("okhash chroma array must not be empty");
    }

    if (entries.every(isObject)) {
      return { kind: "ranges", ranges: entries.map((range) => prepareChromaRange(range, mode)) };
    }

    const values = entries.map((value) => {
      if (typeof value !== "number") {
        throw new TypeError("okhash chroma array must contain only numbers or ranges");
      }
      assertChromaValue(value);
      if (mode === "relative") {
        assertChromaRatioValue(value);
      }
      return value;
    });
    return { kind: "discrete", values };
  }

  return { kind: "range", ...prepareChromaRange(spec, mode) };
}

function sampleRelativeChroma(prepared: PreparedChromaSpec, t: number): number {
  if (prepared.kind === "constant") {
    return prepared.value;
  }

  if (prepared.kind === "discrete") {
    return prepared.values[
      Math.min(Math.floor(t * prepared.values.length), prepared.values.length - 1)
    ];
  }

  if (prepared.kind === "range") {
    return sampleChromaRange(prepared, t, 1);
  }

  return sampleChromaRanges(prepared.ranges, t, 1);
}

function sampleChromaRange(
  range: { min: number; max: number | "safe" },
  t: number,
  safeMax: number,
): number {
  const effectiveHi = range.max === "safe" ? safeMax : Math.min(range.max, safeMax);
  const effectiveLo = Math.min(range.min, effectiveHi);

  return effectiveLo + t * (effectiveHi - effectiveLo);
}

function sampleChromaRanges(ranges: readonly ChromaRange[], t: number, safeMax: number): number {
  let totalWidth = 0;

  for (const range of ranges) {
    totalWidth += chromaRangeWidth(range, safeMax);
  }

  if (totalWidth <= 0) {
    return Math.min(ranges[0].min, safeMax);
  }

  let target = t * totalWidth;
  for (let index = 0; index < ranges.length; index += 1) {
    const width = chromaRangeWidth(ranges[index], safeMax);

    if (width <= 0) {
      continue;
    }

    if (target < width) {
      return sampleChromaRange(ranges[index], target / width, safeMax);
    }

    target -= width;
  }

  return sampleChromaRange(ranges[ranges.length - 1], 1, safeMax);
}

function chromaRangeWidth(range: ChromaRange, safeMax: number): number {
  const effectiveHi = range.max === "safe" ? safeMax : Math.min(range.max, safeMax);
  const effectiveLo = Math.min(range.min, effectiveHi);

  return effectiveHi - effectiveLo;
}

function chromaLowerBound(spec: PreparedChromaSpec): number {
  if (spec.kind === "constant") {
    return spec.value;
  }

  if (spec.kind === "discrete") {
    return Math.min(...spec.values);
  }

  if (spec.kind === "range") {
    return spec.min;
  }

  return Math.min(...spec.ranges.map((range) => range.min));
}

function prepareHueRange(range: unknown): PreparedHueRange {
  assertNumericRangeObject("hue", range);
  assertFinite("hue.min", range.min);
  assertFinite("hue.max", range.max);
  assertHueRangeEndpoint("hue.min", range.min);
  assertHueRangeEndpoint("hue.max", range.max);

  const min = normalizeHue(range.min);
  const max = range.max === 360 ? 360 : normalizeHue(range.max);
  const width = range.min === 0 && range.max === 360 ? 360 : (max - min + 360) % 360;

  if (width <= 0) {
    throw new RangeError("okhash hue range must have positive width");
  }

  return { min, width };
}

function prepareUnitRange(name: "lightness", range: unknown): PreparedRange {
  assertNumericRangeObject(name, range);
  assertUnitValue(`${name}.min`, range.min);
  assertUnitValue(`${name}.max`, range.max);

  if (range.min > range.max) {
    throw new RangeError(`okhash ${name} range requires min <= max`);
  }

  return { min: range.min, max: range.max, width: range.max - range.min };
}

function prepareChromaRange(range: unknown, mode: "uniform" | "relative"): ChromaRange {
  assertRangeObject("chroma", range);
  assertChromaValue(range.min);
  if (mode === "relative") {
    assertChromaRatioValue(range.min);
  }

  if (range.max !== "safe") {
    assertChromaValue(range.max);
    if (mode === "relative") {
      assertChromaRatioValue(range.max);
    }

    if (range.min > range.max) {
      throw new RangeError("okhash chroma range requires min <= max");
    }
  } else if (mode === "relative") {
    throw new RangeError('okhash relative chroma range max must be in [0, 1], not "safe"');
  }

  return { min: range.min, max: range.max };
}

function boundsForNumberSpec(name: "lightness", spec: ChannelSpec): Bounds {
  if (typeof spec === "number") {
    assertUnitValue(name, spec);
    return { min: spec, max: spec };
  }

  if (Array.isArray(spec)) {
    const entries = spec as readonly unknown[];
    if (entries.length === 0) {
      throw new RangeError(`okhash ${name} array must not be empty`);
    }

    if (entries.every(isObject)) {
      const ranges = entries.map((range) => prepareUnitRange(name, range));
      return {
        min: Math.min(...ranges.map((range) => range.min)),
        max: Math.max(...ranges.map((range) => range.max)),
      };
    }

    const values = entries.map((value) => {
      if (typeof value !== "number") {
        throw new TypeError(`okhash ${name} array must contain only numbers or ranges`);
      }
      assertUnitValue(name, value);
      return value;
    });

    return { min: Math.min(...values), max: Math.max(...values) };
  }

  const range = prepareUnitRange(name, spec);
  return { min: range.min, max: range.max };
}

function sampleHueRanges(
  ranges: readonly PreparedHueRange[],
  totalWidth: number,
  t: number,
): number {
  let target = t * totalWidth;

  for (const range of ranges) {
    if (target <= range.width) {
      return normalizeHue(range.min + target);
    }
    target -= range.width;
  }

  const last = ranges[ranges.length - 1];
  return normalizeHue(last.min + last.width);
}

function sampleWeightedHueRanges(
  ranges: readonly (PreparedHueRange & { weight: number; weightedWidth: number })[],
  totalWidth: number,
  t: number,
): number {
  let target = t * totalWidth;

  for (const range of ranges) {
    if (range.weightedWidth <= 0) {
      continue;
    }

    if (target < range.weightedWidth) {
      return range.min + target / range.weight;
    }

    target -= range.weightedWidth;
  }

  const last = ranges[ranges.length - 1];
  return last.min + last.width;
}

function sampleRanges(ranges: readonly PreparedRange[], totalWidth: number, t: number): number {
  let target = t * totalWidth;

  for (const range of ranges) {
    if (range.width <= 0) {
      continue;
    }

    if (target < range.width) {
      return range.min + target;
    }
    target -= range.width;
  }

  return ranges[ranges.length - 1].max;
}

function normalizeMood(value: OkhashOptions["mood"] | undefined): Mood {
  if (value === undefined) {
    return "balanced";
  }

  if (typeof value !== "string") {
    throw new TypeError("okhash mood must be a string");
  }

  if (Object.hasOwn(MOODS, value)) {
    return value as Mood;
  }

  throw new RangeError(`okhash mood is not supported: ${value}`);
}

function normalizeNormalizeOption(value: OkhashOptions["normalize"] | undefined): "NFC" | false {
  if (value === undefined || value === false) {
    return false;
  }

  if (value !== "NFC") {
    throw new RangeError('okhash normalize must be "NFC" or false');
  }

  return value;
}

function normalizeCacheSize(cache: number | undefined): number {
  if (cache === undefined) {
    return 256;
  }

  if (!Number.isInteger(cache)) {
    throw new TypeError("okhash cache size must be an integer");
  }

  if (cache < 0) {
    throw new RangeError("okhash cache size must be >= 0");
  }

  return cache;
}

function normalizeSurfaceOption(value: OkhashOptions["surface"] | undefined): "light" | "dark" {
  if (value === undefined) {
    return "light";
  }

  if (value !== "light" && value !== "dark") {
    throw new RangeError('okhash surface must be "light" or "dark"');
  }

  return value;
}

function normalizeBooleanOption(
  name: string,
  value: boolean | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new TypeError(`okhash ${name} must be a boolean`);
  }

  return value;
}

function assertRangeObject(
  name: string,
  value: unknown,
): asserts value is { min: number; max: number | "safe" } {
  if (!isObject(value) || !("min" in value) || !("max" in value)) {
    throw new TypeError(`okhash ${name} range must have min and max`);
  }

  if (typeof value.min !== "number") {
    throw new TypeError(`okhash ${name} range min must be a number`);
  }

  if (typeof value.max !== "number" && value.max !== "safe") {
    throw new TypeError(`okhash ${name} range max must be a number or "safe"`);
  }
}

function assertNumericRangeObject(
  name: string,
  value: unknown,
): asserts value is { min: number; max: number } {
  assertRangeObject(name, value);

  if (typeof value.max !== "number") {
    throw new TypeError(`okhash ${name} range max must be a number`);
  }
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`okhash ${name} must be finite`);
  }
}

function assertHueValue(value: number): void {
  if (value < 0 || value >= 360) {
    throw new RangeError("okhash hue must be in [0, 360)");
  }
}

function assertHueRangeEndpoint(name: string, value: number): void {
  if (value < 0 || value > 360) {
    throw new RangeError(`okhash ${name} must be in [0, 360]`);
  }
}

function assertUnitValue(name: string, value: number): void {
  assertFinite(name, value);

  if (value < 0 || value > 1) {
    throw new RangeError(`okhash ${name} must be in [0, 1]`);
  }
}

function assertChromaValue(value: number): void {
  assertFinite("chroma", value);

  if (value < 0) {
    throw new RangeError("okhash chroma must be >= 0");
  }
}

function assertChromaRatioValue(value: number): void {
  if (value > 1) {
    throw new RangeError("okhash relative chroma must be in [0, 1]");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

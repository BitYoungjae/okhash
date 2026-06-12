import { hexFromOklch, maxChromaForLightnessHue, rgbToOklch } from "./oklab.js";
import type { ForegroundOptions, Rgb } from "./types.js";

const DEFAULT_CANDIDATES = ["#000000", "#ffffff"] as const;
const NATURAL_LIGHTNESSES = [0.24, 0.32, 0.4, 0.48, 0.58, 0.72, 0.82, 0.92] as const;
const TINTED_FOREGROUND_CHROMA = 0.018;
const DEFAULT_NATURAL_TARGET = 5.5;
const NATURAL_LIGHTNESS_SEARCH_STEPS = 24;

type NaturalTone = NonNullable<ForegroundOptions["tone"]>;
type ContrastDirection = "darker" | "lighter";

export function chooseForeground(background: Rgb, options: ForegroundOptions = {}): string {
  const candidates = resolveCandidates(background, options);

  if (candidates.length === 0) {
    throw new RangeError("okhash foreground candidates must not be empty");
  }

  let bestCandidate = candidates[0];
  let bestRank = rankCandidate(background, parseHexColor(bestCandidate), bestCandidate, options);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const rank = rankCandidate(background, parseHexColor(candidate), candidate, options);

    if (rank > bestRank) {
      bestCandidate = candidate;
      bestRank = rank;
    }
  }

  return bestCandidate;
}

function rankCandidate(
  background: Rgb,
  candidate: Rgb,
  originalCandidate: string,
  options: ForegroundOptions,
): number {
  if (options.rank !== undefined) {
    return options.rank(background, candidate);
  }

  const preset = options.preset ?? "max";
  if (preset === "natural") {
    return rankNaturalCandidate(background, candidate, options);
  }

  if (preset !== "max") {
    throw new RangeError(`okhash foreground preset is not supported: ${String(preset)}`);
  }

  const metric = options.metric ?? "auto";
  if (metric === "auto") {
    return Math.abs(rgbToOklch(background).l - rgbToOklch(candidate).l);
  }

  if (metric === "wcag2") {
    return wcag2Contrast(background, candidate);
  }

  throw new RangeError(`okhash foreground metric is not supported for ${originalCandidate}`);
}

function resolveCandidates(background: Rgb, options: ForegroundOptions): readonly string[] {
  if (options.candidates !== undefined) {
    return options.candidates;
  }

  if (options.preset === "natural") {
    return naturalCandidates(background, options);
  }

  return DEFAULT_CANDIDATES;
}

function naturalCandidates(background: Rgb, options: ForegroundOptions): string[] {
  const tone = options.tone ?? "neutral";

  if (tone !== "neutral" && tone !== "tinted") {
    throw new RangeError(`okhash foreground tone is not supported: ${String(tone)}`);
  }

  const backgroundOklch = rgbToOklch(background);
  const hue = tone === "tinted" ? backgroundOklch.h : 0;
  const minimum = minimumContrast(options);
  const target = targetContrast(options, minimum);
  const candidates: string[] = [...DEFAULT_CANDIDATES];

  for (const lightness of NATURAL_LIGHTNESSES) {
    candidates.push(naturalCandidateHex(lightness, tone, hue));
  }

  for (const desiredContrast of uniqueNumbers([minimum, target])) {
    const darker = naturalCandidateForContrast(
      background,
      backgroundOklch.l,
      tone,
      hue,
      desiredContrast,
      "darker",
    );
    const lighter = naturalCandidateForContrast(
      background,
      backgroundOklch.l,
      tone,
      hue,
      desiredContrast,
      "lighter",
    );

    if (darker !== undefined) {
      candidates.push(darker);
    }

    if (lighter !== undefined) {
      candidates.push(lighter);
    }
  }

  return uniqueStrings(candidates);
}

function naturalCandidateForContrast(
  background: Rgb,
  backgroundLightness: number,
  tone: NaturalTone,
  hue: number,
  desiredContrast: number,
  direction: ContrastDirection,
): string | undefined {
  const farLightness = direction === "darker" ? 0 : 1;
  const nearLightness = backgroundLightness;
  const farCandidate = naturalCandidateHex(farLightness, tone, hue);

  if (wcag2Contrast(background, parseHexColor(farCandidate)) < desiredContrast) {
    return undefined;
  }

  const nearCandidate = naturalCandidateHex(nearLightness, tone, hue);
  if (wcag2Contrast(background, parseHexColor(nearCandidate)) >= desiredContrast) {
    return nearCandidate;
  }

  let low = Math.min(farLightness, nearLightness);
  let high = Math.max(farLightness, nearLightness);

  for (let index = 0; index < NATURAL_LIGHTNESS_SEARCH_STEPS; index += 1) {
    const middle = (low + high) / 2;
    const middleCandidate = naturalCandidateHex(middle, tone, hue);
    const middleContrast = wcag2Contrast(background, parseHexColor(middleCandidate));

    if (direction === "darker") {
      if (middleContrast >= desiredContrast) {
        low = middle;
      } else {
        high = middle;
      }
    } else if (middleContrast >= desiredContrast) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return naturalCandidateHex(direction === "darker" ? low : high, tone, hue);
}

function naturalCandidateHex(lightness: number, tone: NaturalTone, hue: number): string {
  const chroma =
    tone === "neutral"
      ? 0
      : Math.min(TINTED_FOREGROUND_CHROMA, maxChromaForLightnessHue(lightness, hue));
  return hexFromOklch(lightness, chroma, hue);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function rankNaturalCandidate(background: Rgb, candidate: Rgb, options: ForegroundOptions): number {
  const contrast = wcag2Contrast(background, candidate);
  const minimum = minimumContrast(options);
  if (contrast < minimum) {
    return contrast - minimum;
  }

  const target = targetContrast(options, minimum);
  return 100 - Math.abs(contrast - target);
}

function minimumContrast(options: ForegroundOptions): number {
  const level = options.level ?? "AA";
  const intent = options.intent ?? "body";

  if (typeof level === "number") {
    return assertPositiveNumber(level, "level");
  }

  if (intent !== "body" && intent !== "large" && intent !== "icon" && intent !== "muted") {
    throw new RangeError(`okhash foreground intent is not supported: ${String(intent)}`);
  }

  if (level === "AA") {
    return intent === "large" || intent === "icon" ? 3 : 4.5;
  }

  if (level === "AAA") {
    return intent === "large" || intent === "icon" ? 4.5 : 7;
  }

  throw new RangeError(`okhash foreground level is not supported: ${String(level)}`);
}

function targetContrast(options: ForegroundOptions, minimum: number): number {
  if (options.targetContrast !== undefined) {
    return Math.max(minimum, assertPositiveNumber(options.targetContrast, "targetContrast"));
  }

  if (options.intent === "muted") {
    return minimum;
  }

  return Math.max(minimum, DEFAULT_NATURAL_TARGET);
}

function assertPositiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`okhash foreground ${label} must be a positive number`);
  }

  return value;
}

export function wcag2Contrast(first: Rgb, second: Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: Rgb): number {
  const red = wcagChannel(rgb[0]);
  const green = wcagChannel(rgb[1]);
  const blue = wcagChannel(rgb[2]);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function wcagChannel(value: number): number {
  const normalized = value / 255;

  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function parseHexColor(input: string): Rgb {
  const match = /^#?([\da-f]{6})$/i.exec(input);
  if (match === null) {
    throw new TypeError(`okhash foreground candidate must be a 6-digit hex color: ${input}`);
  }

  const hex = match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

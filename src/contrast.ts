import { rgbToOklch } from "./oklab.js";
import type { ForegroundOptions, Rgb } from "./types.js";

const DEFAULT_CANDIDATES = ["#000000", "#ffffff"] as const;

export function chooseForeground(background: Rgb, options: ForegroundOptions = {}): string {
  const candidates = options.candidates ?? DEFAULT_CANDIDATES;

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

  const metric = options.metric ?? "auto";
  if (metric === "auto") {
    return Math.abs(rgbToOklch(background).l - rgbToOklch(candidate).l);
  }

  if (metric === "wcag2") {
    return wcag2Contrast(background, candidate);
  }

  throw new RangeError(`okhash foreground metric is not supported for ${originalCandidate}`);
}

function wcag2Contrast(first: Rgb, second: Rgb): number {
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

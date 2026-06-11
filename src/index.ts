import { FifoCache } from "./cache.js";
import {
  assertStringInput,
  colorFromInput,
  cssFromInput,
  hexFromInput,
  normalizeInput,
  oklchFromInput,
  rgbFromInput,
} from "./pipeline.js";
import { resolveOkhashConfig } from "./spec.js";
import type { Color, ColorHashFn, OkhashOptions, Rgb } from "./types.js";

export type {
  ChannelSpec,
  ChromaRange,
  ChromaSpec,
  Color,
  ColorHashFn,
  ForegroundOptions,
  Mood,
  OkhashOptions,
  Oklch,
  Range,
  Rgb,
} from "./types.js";

export function createColorHash(options: OkhashOptions = {}): ColorHashFn {
  const config = resolveOkhashConfig(options);
  const cache = new FifoCache<Color>(config.cacheSize);
  let lastKey: string | undefined;
  let lastColor: Color | undefined;

  const colorize = ((input: string): Color => {
    assertStringInput(input);
    const normalized = normalizeInput(input, config);

    if (normalized === lastKey && lastColor !== undefined) {
      return lastColor;
    }

    const cached = cache.get(normalized);

    if (cached !== undefined) {
      lastKey = normalized;
      lastColor = cached;
      return cached;
    }

    const color = colorFromInput(normalized, config);
    cache.set(normalized, color);

    if (config.cacheSize > 0) {
      lastKey = normalized;
      lastColor = color;
    }

    return color;
  }) as ColorHashFn;

  colorize.hex = (input: string): string => {
    assertStringInput(input);
    return hexFromInput(normalizeInput(input, config), config);
  };
  colorize.rgb = (input: string): Rgb => {
    assertStringInput(input);
    return rgbFromInput(normalizeInput(input, config), config);
  };
  colorize.oklch = (input: string) => {
    assertStringInput(input);
    return oklchFromInput(normalizeInput(input, config), config);
  };
  colorize.css = (input: string): string => {
    assertStringInput(input);
    return cssFromInput(normalizeInput(input, config), config);
  };

  return colorize;
}

export const hashColor: ColorHashFn = createColorHash();

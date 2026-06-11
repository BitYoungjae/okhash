import { createColorFromOklch, darkSurfaceChroma, darkSurfaceLightness } from "./color.js";
import { cyrb53pair } from "./hash.js";
import { applyHelmholtzKohlrausch } from "./hk.js";
import { formatCssOklch, hexFromOklch, oklchToRgb, rgbToOklch } from "./oklab.js";
import type { ResolvedOkhashConfig } from "./spec.js";
import type { Color, Oklch, Rgb } from "./types.js";

export interface HashSamples {
  hue: number;
  chroma: number;
  lightness: number;
}

export function assertStringInput(input: unknown): asserts input is string {
  if (typeof input !== "string") {
    throw new TypeError("okhash input must be a string");
  }
}

export function normalizeInput(input: string, config: ResolvedOkhashConfig): string {
  return config.normalize === false ? input : input.normalize(config.normalize);
}

export function hashSamples(input: string, config: ResolvedOkhashConfig): HashSamples {
  const [h1, h2] = cyrb53pair(input, config.seed);

  return {
    hue: (h1 & 0xffff) / 0x10000,
    chroma: (h2 & 0xff) / 0x100,
    lightness: ((h2 >>> 8) & 0xff) / 0x100,
  };
}

export function generatedOklchFromSamples(
  samples: HashSamples,
  config: ResolvedOkhashConfig,
  overrides: {
    hueT?: number;
    hue?: number;
    lightnessOffset?: number;
  } = {},
): Oklch {
  return projectGeneratedOklchFromSamples(samples, config, toOklch, overrides);
}

export function projectGeneratedOklchFromSamples<Output>(
  samples: HashSamples,
  config: ResolvedOkhashConfig,
  project: (lightness: number, chroma: number, hue: number) => Output,
  overrides: {
    hueT?: number;
    hue?: number;
    lightnessOffset?: number;
  } = {},
): Output {
  const hue = overrides.hue ?? config.hue(overrides.hueT ?? samples.hue);
  let lightness = clamp01(config.lightness(samples.lightness) + (overrides.lightnessOffset ?? 0));
  let chroma = config.chroma(samples.chroma, lightness, hue);

  if (config.hk) {
    const adjusted = applyHelmholtzKohlrausch(lightness, chroma, hue);
    lightness = adjusted.lightness;
    chroma = adjusted.chroma;
  }

  return project(lightness, chroma, hue);
}

export function colorFromGeneratedOklch(base: Oklch, config: ResolvedOkhashConfig): Color {
  return createColorFromOklch(base.l, base.c, base.h, config.surface);
}

export function colorFromInput(input: string, config: ResolvedOkhashConfig): Color {
  return projectGeneratedOklchFromSamples(
    hashSamples(input, config),
    config,
    (lightness, chroma, hue) => createColorFromOklch(lightness, chroma, hue, config.surface),
  );
}

export function rgbFromInput(input: string, config: ResolvedOkhashConfig): Rgb {
  return projectGeneratedOklchFromSamples(
    hashSamples(input, config),
    config,
    (lightness, chroma, hue) => projectDisplayOklch(lightness, chroma, hue, config, oklchToRgb),
  );
}

export function hexFromInput(input: string, config: ResolvedOkhashConfig): string {
  return projectGeneratedOklchFromSamples(
    hashSamples(input, config),
    config,
    (lightness, chroma, hue) => projectDisplayOklch(lightness, chroma, hue, config, hexFromOklch),
  );
}

export function oklchFromInput(input: string, config: ResolvedOkhashConfig): Oklch {
  return rgbToOklch(rgbFromInput(input, config));
}

export function cssFromInput(input: string, config: ResolvedOkhashConfig): string {
  return formatCssOklch(oklchFromInput(input, config));
}

function projectDisplayOklch<Output>(
  lightness: number,
  chroma: number,
  hue: number,
  config: ResolvedOkhashConfig,
  project: (lightness: number, chroma: number, hue: number) => Output,
): Output {
  if (config.surface === "dark") {
    const variantLightness = darkSurfaceLightness(lightness);
    return project(variantLightness, darkSurfaceChroma(variantLightness, chroma, hue), hue);
  }

  return project(lightness, chroma, hue);
}

function toOklch(lightness: number, chroma: number, hue: number): Oklch {
  return { l: lightness, c: chroma, h: hue };
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

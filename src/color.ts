import { chooseForeground } from "./contrast.js";
import {
  formatCssOklch,
  hexFromRgb,
  maxChromaForLightnessHue,
  oklchToRgb,
  rgbToOklch,
} from "./oklab.js";
import type { Color, ForegroundOptions, Oklch, Rgb } from "./types.js";

type Surface = "light" | "dark";

export function createColorFromRgb(rgb: Rgb): Color {
  return new CanonicalColor(rgb);
}

export function createColorFromOklch(
  lightness: number,
  chroma: number,
  hue: number,
  surface: Surface = "light",
): Color {
  const display = applySurfaceVariant(lightness, chroma, hue, surface);
  return new CanonicalColor(
    oklchToRgb(display.l, display.c, display.h),
    { l: lightness, c: chroma, h: hue },
    surface,
  );
}

export function applySurfaceVariant(
  lightness: number,
  chroma: number,
  hue: number,
  surface: Surface,
): Oklch {
  if (surface === "light") {
    return { l: lightness, c: chroma, h: hue };
  }

  if (surface !== "dark") {
    throw new RangeError('okhash variant surface must be "light" or "dark"');
  }

  const variantLightness = darkSurfaceLightness(lightness);
  const variantChroma = darkSurfaceChroma(variantLightness, chroma, hue);

  return { l: variantLightness, c: variantChroma, h: hue };
}

export function darkSurfaceLightness(lightness: number): number {
  return Math.min(lightness + 0.1, 0.86);
}

export function darkSurfaceChroma(lightness: number, chroma: number, hue: number): number {
  return Math.min(chroma * 0.72, maxChromaForLightnessHue(lightness, hue));
}

class CanonicalColor implements Color {
  readonly #rgb: Rgb;
  readonly #sourceOklch: Readonly<Oklch> | undefined;
  readonly #surface: Surface;
  #hex: string | undefined;
  #oklch: Oklch | undefined;
  #css: string | undefined;

  constructor(rgb: Rgb, sourceOklch?: Oklch, surface: Surface = "light") {
    this.#rgb = Object.freeze([rgb[0], rgb[1], rgb[2]]) as Rgb;
    this.#sourceOklch = sourceOklch === undefined ? undefined : Object.freeze({ ...sourceOklch });
    this.#surface = surface;
  }

  hex(): string {
    this.#hex ??= hexFromRgb(this.#rgb);
    return this.#hex;
  }

  rgb(): Rgb {
    return this.#rgb;
  }

  oklch(): Oklch {
    const oklch = this.#canonicalOklch();
    return { l: oklch.l, c: oklch.c, h: oklch.h };
  }

  css(): string {
    this.#css ??= formatCssOklch(this.#canonicalOklch());
    return this.#css;
  }

  foreground(options?: ForegroundOptions): string {
    return chooseForeground(this.#rgb, options);
  }

  variant(surface: "light" | "dark"): Color {
    if (surface === this.#surface) {
      return this;
    }

    const source = this.#sourceOklch ?? this.#canonicalOklch();
    return createColorFromOklch(source.l, source.c, source.h, surface);
  }

  #canonicalOklch(): Oklch {
    this.#oklch ??= rgbToOklch(this.#rgb);
    return this.#oklch;
  }
}

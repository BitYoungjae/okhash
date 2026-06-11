import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createColorHash, type OkhashOptions, type Oklch } from "../src/index.js";
import { applySurfaceVariant } from "../src/color.js";
import { MOODS } from "../src/moods.js";
import { oklchToRgb, safeChromaForLightness } from "../src/oklab.js";
import { resolveOkhashConfig } from "../src/spec.js";

const PROPERTY_RUNS = 400;
const OPTION_CASES = [
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
] satisfies OkhashOptions[];

describe("OKH1 property gates", () => {
  it("is deterministic and keeps public formats canonical for generated strings and options", () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom(...OPTION_CASES), (input, options) => {
        const colorize = createColorHash(options);
        const first = colorize(input);
        const second = colorize(input);

        expect(colorize.hex(input)).toBe(first.hex());
        expect(first.hex()).toBe(second.hex());
        expect(first.rgb()).toEqual(second.rgb());
        expect(first.css()).toBe(second.css());
        expect(first.css()).toBe(formatExpectedCss(first.oklch()));
        const parsed = parseCssOklch(first.css());
        expect(oklchToRgb(parsed.l, parsed.c, parsed.h)).toEqual(first.rgb());
      }),
      { numRuns: PROPERTY_RUNS, seed: 0x0f00d },
    );
  });

  it("keeps RGB and canonical OKLCH domains valid for generated strings", () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom(...OPTION_CASES), (input, options) => {
        const color = createColorHash(options)(input);
        const rgb = color.rgb();
        const oklch = color.oklch();

        expect(rgb.every((channel) => Number.isInteger(channel))).toBe(true);
        expect(rgb.every((channel) => channel >= 0 && channel <= 255)).toBe(true);
        expect(Number.isFinite(oklch.l)).toBe(true);
        expect(Number.isFinite(oklch.c)).toBe(true);
        expect(Number.isFinite(oklch.h)).toBe(true);
        expect(oklch.l).toBeGreaterThanOrEqual(0);
        expect(oklch.l).toBeLessThanOrEqual(1);
        expect(oklch.c).toBeGreaterThanOrEqual(0);
        expect(oklch.h).toBeGreaterThanOrEqual(0);
        expect(oklch.h).toBeLessThan(360);
      }),
      { numRuns: PROPERTY_RUNS, seed: 0x0f00e },
    );
  });

  it("samples uniform chroma within effective ranges after safe caps", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("balanced", "pastel", "earth"),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (mood, tC, tL, tH) => {
          const config = resolveOkhashConfig({ mood, hk: false });
          const moodConfig = MOODS[mood];
          const lightness = config.lightness(tL);
          const hue = config.hue(tH);
          const cap = safeChromaForLightness(lightness);
          const specHi =
            moodConfig.chroma.max === "safe" ? cap : Math.min(moodConfig.chroma.max, cap);
          const specLo = Math.min(moodConfig.chroma.min, specHi);
          const chroma = config.chroma(tC, lightness, hue);

          expect(chroma).toBeGreaterThanOrEqual(specLo - Number.EPSILON);
          expect(chroma).toBeLessThanOrEqual(specHi + Number.EPSILON);
        },
      ),
      { numRuns: PROPERTY_RUNS, seed: 0x0f00f },
    );
  });

  it("preserves source hue through surface variant projection", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 0.15, noNaN: true }),
        fc.double({ min: 0, max: 360, noNaN: true, maxExcluded: true }),
        (lightness, chroma, hue) => {
          expect(applySurfaceVariant(lightness, chroma, hue, "light").h).toBe(hue);
          expect(applySurfaceVariant(lightness, chroma, hue, "dark").h).toBe(hue);
        },
      ),
      { numRuns: PROPERTY_RUNS, seed: 0x0f010 },
    );
  });
});

function formatExpectedCss(oklch: Oklch): string {
  return `oklch(${oklch.l.toFixed(6)} ${oklch.c.toFixed(6)} ${oklch.h.toFixed(3)})`;
}

function parseCssOklch(css: string): Oklch {
  const match = /^oklch\((\d+\.\d{6}) (\d+\.\d{6}) (\d+\.\d{3})\)$/.exec(css);

  if (match === null) {
    throw new TypeError(`Invalid test CSS OKLCH value: ${css}`);
  }

  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

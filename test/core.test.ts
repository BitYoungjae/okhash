import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { chooseForeground } from "../src/contrast.js";
import { cyrb53pair } from "../src/hash.js";
import { applyHelmholtzKohlrausch } from "../src/hk.js";
import {
  CSAFE_LUT,
  maxChromaForLightnessHue,
  oklchToRgb,
  safeChromaForLightness,
} from "../src/oklab.js";
import { resolveOkhashConfig } from "../src/spec.js";
import {
  createColorHash,
  hashColor,
  type OkhashOptions,
  type Oklch,
  type Rgb,
} from "../src/index.js";

const GOLDEN = [
  { input: "", hex: "#33b6bc", rgb: [51, 182, 188], css: "oklch(0.710792 0.108968 199.592)" },
  {
    input: "Alice",
    hex: "#a293cb",
    rgb: [162, 147, 203],
    css: "oklch(0.696651 0.082351 296.496)",
  },
  {
    input: "bob@example.com",
    hex: "#5e9671",
    rgb: [94, 150, 113],
    css: "oklch(0.623641 0.081741 154.411)",
  },
  {
    input: "홍길동",
    hex: "#b97965",
    rgb: [185, 121, 101],
    css: "oklch(0.637916 0.086090 38.102)",
  },
  {
    input: "東京",
    hex: "#887eb7",
    rgb: [136, 126, 183],
    css: "oklch(0.624053 0.085342 291.776)",
  },
  {
    input: "👩‍💻",
    hex: "#4fa88e",
    rgb: [79, 168, 142],
    css: "oklch(0.669328 0.094798 171.723)",
  },
  {
    input: "e\u0301",
    hex: "#6c7fb8",
    rgb: [108, 127, 184],
    css: "oklch(0.604831 0.089991 269.495)",
  },
  {
    input: "\u00e9",
    hex: "#de996b",
    rgb: [222, 153, 107],
    css: "oklch(0.740714 0.103173 54.139)",
  },
  {
    input: "00000000-0000-4000-8000-000000000000",
    hex: "#6ca9cf",
    rgb: [108, 169, 207],
    css: "oklch(0.707814 0.084235 237.007)",
  },
] as const;

describe("core OKH1 vertical slice", () => {
  it("matches the initial golden corpus", () => {
    for (const expected of GOLDEN) {
      const color = hashColor(expected.input);

      expect(color.hex()).toBe(expected.hex);
      expect(hashColor.hex(expected.input)).toBe(expected.hex);
      expect(color.rgb()).toEqual(expected.rgb);
      expect(hashColor.rgb(expected.input)).toEqual(expected.rgb);
      expect(color.css()).toBe(expected.css);
      expect(hashColor.css(expected.input)).toBe(expected.css);
    }
  });

  it("is deterministic across repeated calls", () => {
    for (const { input } of GOLDEN) {
      expect(hashColor.hex(input)).toBe(hashColor.hex(input));
      expect(hashColor.rgb(input)).toEqual(hashColor.rgb(input));
      expect(hashColor.css(input)).toBe(hashColor.css(input));
    }
  });

  it("backs every Color format with the same canonical RGB triplet", () => {
    const color = hashColor("Alice");
    const oklch = color.oklch();

    expect(color.hex()).toBe("#a293cb");
    expect(color.rgb()).toEqual([162, 147, 203]);
    expect(color.css()).toBe(formatExpectedCss(oklch));
    expect(hashColor.oklch("Alice")).toEqual(oklch);
  });

  it("round-trips formatted CSS OKLCH through the canonical RGB triplet", () => {
    for (let index = 0; index < 1000; index += 1) {
      const input = `css-roundtrip-${index}`;
      const color = hashColor(input);
      const parsed = parseCssOklch(color.css());

      expect(oklchToRgb(parsed.l, parsed.c, parsed.h)).toEqual(color.rgb());
      expect(hashColor.css(input)).toBe(formatExpectedCss(hashColor.oklch(input)));
    }
  });

  it("supports seed and NFC normalization options", () => {
    const seeded = createColorHash({ seed: 0xc0ffee });
    expect(seeded.hex("Alice")).toBe("#5dbb9e");
    expect(seeded.css("Alice")).toBe("oklch(0.726263 0.100077 170.914)");

    const normalized = createColorHash({ normalize: "NFC" });
    expect(normalized.hex("e\u0301")).toBe(normalized.hex("\u00e9"));
    expect(hashColor.hex("e\u0301")).not.toBe(hashColor.hex("\u00e9"));
  });

  it("supports constructor-time ChannelSpec customization for the balanced path", () => {
    const colorize = createColorHash({
      hue: { min: 330, max: 30 },
      lightness: 0.65,
      chroma: { min: 0.08, max: 0.09 },
      hk: false,
    });

    expect(colorize.hex("Alice")).toBe("#bb7b7b");
    expect(colorize.css("Alice")).toBe("oklch(0.649098 0.080326 19.476)");
  });

  it("keeps Color objects cached while preserving direct path output", () => {
    const colorize = createColorHash();
    expect(colorize("Alice")).toBe(colorize("Alice"));
    expect(colorize.hex("Alice")).toBe(colorize("Alice").hex());

    const uncached = createColorHash({ cache: 0 });
    expect(uncached("Alice")).not.toBe(uncached("Alice"));
    expect(uncached.hex("Alice")).toBe("#a293cb");
  });

  it("validates input and construction options", () => {
    expect(() => hashColor.hex(42 as unknown as string)).toThrow(TypeError);
    expect(() => createColorHash(null as unknown as OkhashOptions)).toThrow(TypeError);
    expect(() => createColorHash({ seed: -1 })).toThrow(RangeError);
    expect(() => createColorHash({ cache: -1 })).toThrow(RangeError);
    expect(() => createColorHash({ hue: 360 })).toThrow(RangeError);
    expect(() => createColorHash({ lightness: { min: 0.8, max: 0.4 } })).toThrow(RangeError);
    expect(() => createColorHash({ chroma: { min: 0.2, max: 0.3 } })).toThrow(RangeError);
    expect(() => createColorHash({ mood: "unknown" as OkhashOptions["mood"] })).toThrow(RangeError);
    expect(() => createColorHash({ surface: "print" as OkhashOptions["surface"] })).toThrow(
      RangeError,
    );
    expect(() =>
      createColorHash({ chroma: { mode: "relative", range: { min: 0.8, max: 1.1 } } }),
    ).toThrow(RangeError);
    expect(() =>
      createColorHash({
        chroma: { mode: "relative", range: { min: 0.8, max: "safe" } },
      }),
    ).toThrow(RangeError);
  });

  it("returns in-range RGB and OKLCH values", () => {
    for (const { input } of GOLDEN) {
      const rgb = hashColor.rgb(input);
      const oklch = hashColor.oklch(input);

      expect(
        rgb.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255),
      ).toBe(true);
      expect(Number.isFinite(oklch.l)).toBe(true);
      expect(Number.isFinite(oklch.c)).toBe(true);
      expect(Number.isFinite(oklch.h)).toBe(true);
      expect(oklch.l).toBeGreaterThanOrEqual(0);
      expect(oklch.l).toBeLessThanOrEqual(1);
      expect(oklch.c).toBeGreaterThanOrEqual(0);
      expect(oklch.h).toBeGreaterThanOrEqual(0);
      expect(oklch.h).toBeLessThan(360);
    }
  });

  it("keeps width-proportional multi-range samplers allocation-free and zero-width safe", () => {
    const config = resolveOkhashConfig({
      lightness: [
        { min: 0.2, max: 0.2 },
        { min: 0.7, max: 0.8 },
      ],
      chroma: [
        { min: 0.01, max: 0.01 },
        { min: 0.02, max: 0.04 },
      ],
      hk: false,
    });

    expect(config.lightness(0)).toBe(0.7);
    expect(config.lightness(0.5)).toBe(0.75);
    expect(config.chroma(0, 0.65, 180)).toBe(0.02);
  });

  it("uses hue-dependent gamut caps for post-HK chroma clamping", () => {
    const hue = 290;
    const adjusted = applyHelmholtzKohlrausch(0.65, 0.4, hue);

    expect(adjusted.chroma).toBeLessThanOrEqual(
      maxChromaForLightnessHue(adjusted.lightness, hue) + Number.EPSILON,
    );
    expect(adjusted.clamped).toBe(true);
    expect(adjusted.reduction).toBeGreaterThan(0);
    expect(maxChromaForLightnessHue(0.65, 40)).toBeGreaterThan(maxChromaForLightnessHue(0.65, 200));
  });

  it("supports every mood while preserving canonical direct path identity", () => {
    const expectedByMood = {
      balanced: "#a293cb",
      pastel: "#d4ccea",
      vibrant: "#9370db",
      jewel: "#6e2db3",
      earth: "#64959c",
      neon: "#ab91ea",
    } as const;

    for (const [mood, expectedHex] of Object.entries(expectedByMood)) {
      const colorize = createColorHash({ mood: mood as OkhashOptions["mood"] });
      const color = colorize("Alice");

      expect(color.hex()).toBe(expectedHex);
      expect(colorize.hex("Alice")).toBe(color.hex());
      expect(colorize.rgb("Alice")).toEqual(color.rgb());
      expect(colorize.css("Alice")).toBe(color.css());
      expect(colorize.css("Alice")).toBe(formatExpectedCss(colorize.oklch("Alice")));
    }
  });

  it("handles relative chroma as a ratio of the hue-dependent gamut", () => {
    const colorize = createColorHash({
      lightness: 0.65,
      chroma: { mode: "relative", range: { min: 0.8, max: 0.8 } },
      hk: false,
    });
    const config = resolveOkhashConfig({
      lightness: 0.65,
      chroma: { mode: "relative", range: { min: 0.8, max: 0.8 } },
      hk: false,
    });

    expect(config.chroma(0, 0.65, 40)).toBeCloseTo(maxChromaForLightnessHue(0.65, 40) * 0.8);
    expect(config.chroma(0, 0.65, 200)).toBeCloseTo(maxChromaForLightnessHue(0.65, 200) * 0.8);
    expect(config.chroma(0, 0.65, 40)).toBeGreaterThan(config.chroma(0, 0.65, 200));
    expect(colorize.hex("Alice")).toBe(colorize("Alice").hex());
  });

  it("samples uniform chroma inside the effective range after safe caps are applied", () => {
    const config = resolveOkhashConfig({ mood: "pastel", hk: false });
    const lightness = 0.88;
    const cap = safeChromaForLightness(lightness);
    const effectiveHi = Math.min(0.07, cap);
    const effectiveLo = Math.min(0.04, effectiveHi);
    const chroma = config.chroma(0.5, lightness, 200);

    expect(chroma).toBeGreaterThanOrEqual(effectiveLo);
    expect(chroma).toBeLessThanOrEqual(effectiveHi);
    expect(() =>
      resolveOkhashConfig({
        lightness: 0.99,
        chroma: { min: 0.04, max: 0.07 },
      }),
    ).toThrow(RangeError);
  });

  it("applies dark surface variants through the factory pipeline", () => {
    const light = createColorHash({ hk: false });
    const dark = createColorHash({ hk: false, surface: "dark" });
    const lightColor = light("Alice");
    const darkColor = dark("Alice");
    const lightOklch = light.oklch("Alice");
    const darkOklch = dark.oklch("Alice");

    expect(dark.hex("Alice")).toBe(darkColor.hex());
    expect(dark.rgb("Alice")).toEqual(darkColor.rgb());
    expect(dark.css("Alice")).toBe(formatExpectedCss(dark.oklch("Alice")));
    expect(lightColor.variant("dark").hex()).toBe(darkColor.hex());
    expect(lightColor.variant("dark").rgb()).toEqual(darkColor.rgb());
    expect(lightColor.variant("dark").css()).toBe(darkColor.css());
    expect(darkColor.variant("light").hex()).toBe(lightColor.hex());
    expect(dark.hex("Alice")).not.toBe(light.hex("Alice"));
    expect(darkOklch.l).toBeGreaterThan(lightOklch.l);
    expect(darkOklch.c).toBeLessThan(lightOklch.c);
  });

  it("uses the CVD-safe preset unless channels are explicitly overridden", () => {
    const config = resolveOkhashConfig({ cvdSafe: true, hk: false });
    const hues = [config.hue(0), config.hue(0.25), config.hue(0.5), config.hue(0.75)];

    for (const hue of hues) {
      expect(isCvdHue(hue)).toBe(true);
    }

    const overridden = resolveOkhashConfig({ cvdSafe: true, hue: 180, hk: false });
    expect(overridden.hue(0.5)).toBe(180);

    const colorize = createColorHash({ cvdSafe: true, hk: false });
    expect(colorize.hex("Alice")).toBe(colorize("Alice").hex());
  });

  it("keeps CVD-safe samples separated after severe CVD simulation", () => {
    const colorize = createColorHash({ cvdSafe: true, hk: false });
    const rgbs = Array.from({ length: 16 }, (_, index) => colorize.rgb(`cvd-${index}`));

    for (const matrix of CVD_MATRICES) {
      const deltas = pairwiseDeltas(rgbs.map((rgb) => simulateCvd(rgb, matrix))).sort(
        (first, second) => first - second,
      );
      const tenthPercentile = deltas[Math.floor(deltas.length * 0.1)];

      expect(tenthPercentile).toBeGreaterThan(0.025);
    }
  });

  it("keeps default post-HK reclamping within the design gate", () => {
    const config = resolveOkhashConfig();
    let clamped = 0;
    let maxReduction = 0;
    const total = 5000;

    for (let index = 0; index < total; index += 1) {
      const oklch = sampleGeneratedOklchBeforeHk(`hk-${index}`, config);
      const adjusted = applyHelmholtzKohlrausch(oklch.l, oklch.c, oklch.h);

      if (adjusted.clamped) {
        clamped += 1;
        maxReduction = Math.max(maxReduction, adjusted.reduction);
      }
    }

    expect(clamped / total).toBeLessThanOrEqual(0.01);
    expect(maxReduction).toBeLessThanOrEqual(0.04);
  });

  it("matches the committed Csafe table to the generator output", () => {
    const generated = execFileSync(process.execPath, ["tools/gen-csafe.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();

    expect(generated).toBe(formatCsafeTable(CSAFE_LUT));
  });

  it("keeps the embedded Csafe table conservative at probed lightnesses", () => {
    const lightnesses = [
      ...Array.from({ length: 101 }, (_, index) => index / 100),
      ...Array.from({ length: CSAFE_LUT.length }, (_, index) => index / (CSAFE_LUT.length - 1)),
      0.001,
      0.002,
      0.005,
      0.995,
      0.998,
      0.999,
    ];
    const uniqueLightnesses = [...new Set(lightnesses)].sort((first, second) => first - second);

    for (const lightness of uniqueLightnesses) {
      const chroma = safeChromaForLightness(lightness);

      for (let hue = 0; hue < 360; hue += 0.5) {
        expect(isOklchInSrgbGamut(lightness, chroma, hue)).toBe(true);
      }
    }
  });

  it("selects foreground colors with owned OKLab and WCAG2 metrics", () => {
    const background = [0x75, 0x75, 0x75] as const;

    expect(chooseForeground(background)).toBe("#000000");
    expect(chooseForeground(background, { metric: "wcag2" })).toBe("#ffffff");
    expect(
      chooseForeground(background, {
        candidates: ["#111111", "#eeeeee"],
        rank: (_bg, candidate) => candidate[0],
      }),
    ).toBe("#eeeeee");
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

function isCvdHue(hue: number): boolean {
  return (hue >= 35 && hue <= 90) || (hue >= 225 && hue <= 290);
}

function sampleGeneratedOklchBeforeHk(
  input: string,
  config: ReturnType<typeof resolveOkhashConfig>,
): Oklch {
  const [h1, h2] = cyrb53pair(input, config.seed);
  const tH = (h1 & 0xffff) / 0x10000;
  const tC = (h2 & 0xff) / 0x100;
  const tL = ((h2 >>> 8) & 0xff) / 0x100;
  const hue = config.hue(tH);
  const lightness = config.lightness(tL);
  const chroma = config.chroma(tC, lightness, hue);

  return { l: lightness, c: chroma, h: hue };
}

function formatCsafeTable(table: readonly number[]): string {
  return Array.from(
    { length: Math.ceil(table.length / 8) },
    (_, rowIndex) =>
      `${table
        .slice(rowIndex * 8, rowIndex * 8 + 8)
        .map(formatCsafeNode)
        .join(", ")},`,
  ).join("\n");
}

function formatCsafeNode(value: number): string {
  return Number(value.toFixed(8)).toString();
}

type OklabPoint = readonly [lightness: number, a: number, b: number];
type LinearRgb = readonly [red: number, green: number, blue: number];
type CvdMatrix = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const CVD_MATRICES: readonly CvdMatrix[] = [
  [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
] as const;

function simulateCvd(rgb: Rgb, matrix: CvdMatrix): OklabPoint {
  const red = srgbByteToLinear(rgb[0]);
  const green = srgbByteToLinear(rgb[1]);
  const blue = srgbByteToLinear(rgb[2]);

  return linearRgbToOklab(
    clamp01(matrix[0][0] * red + matrix[0][1] * green + matrix[0][2] * blue),
    clamp01(matrix[1][0] * red + matrix[1][1] * green + matrix[1][2] * blue),
    clamp01(matrix[2][0] * red + matrix[2][1] * green + matrix[2][2] * blue),
  );
}

function pairwiseDeltas(points: readonly OklabPoint[]): number[] {
  const deltas: number[] = [];

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      deltas.push(deltaE(points[first], points[second]));
    }
  }

  return deltas;
}

function deltaE(first: OklabPoint, second: OklabPoint): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

function isOklchInSrgbGamut(lightness: number, chroma: number, hue: number): boolean {
  const angle = (hue * Math.PI) / 180;
  const [red, green, blue] = oklabToLinearSrgb(
    lightness,
    Math.cos(angle) * chroma,
    Math.sin(angle) * chroma,
  );
  const tolerance = 1e-9;

  return (
    red >= -tolerance &&
    red <= 1 + tolerance &&
    green >= -tolerance &&
    green <= 1 + tolerance &&
    blue >= -tolerance &&
    blue <= 1 + tolerance
  );
}

function oklabToLinearSrgb(lightness: number, okA: number, okB: number): LinearRgb {
  const lPrime = lightness + 0.3963377774 * okA + 0.2158037573 * okB;
  const mPrime = lightness - 0.1055613458 * okA - 0.0638541728 * okB;
  const sPrime = lightness - 0.0894841775 * okA - 1.291485548 * okB;
  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearRgbToOklab(red: number, green: number, blue: number): OklabPoint {
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function srgbByteToLinear(value: number): number {
  const normalized = value / 255;

  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
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

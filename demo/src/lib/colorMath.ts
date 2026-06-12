// Visualization-only color math for the demo.
//
// Every generated okhash color in this demo comes from the real `okhash`
// package. The helpers here cover things the package's public API does not
// expose, all of which operate on arbitrary colors rather than okhash output:
//
//   - CVD simulation (Machado 2009 matrices) for the color-vision section,
//   - the foreground contrast metrics applied to a synthetic gray ramp,
//   - an OKLCH-to-sRGB preview for the hue wheel and the H-K calibration sandbox.
//
// The OKLab/OKLCH constants and formulas mirror the package (see
// docs/REFERENCE.md). At the shipped H-K strength (k = 0.32, zero hue 110deg) the
// preview matches real package output; tools/measure-metrics.mjs checks that.

export type Rgb = readonly [number, number, number];

const DEG_TO_RAD = Math.PI / 180;

function linearToByte(value: number): number {
  const clamped = value <= 0 ? 0 : value >= 1 ? 1 : value;
  const encoded =
    clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

function srgbByteToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
  const angle = hue * DEG_TO_RAD;
  const okA = Math.cos(angle) * chroma;
  const okB = Math.sin(angle) * chroma;
  const lPrime = lightness + 0.3963377774 * okA + 0.2158037573 * okB;
  const mPrime = lightness - 0.1055613458 * okA - 0.0638541728 * okB;
  const sPrime = lightness - 0.0894841775 * okA - 1.291485548 * okB;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  return [
    linearToByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  return rgbToHex(oklchToRgb(lightness, chroma, hue));
}

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

// OKLab lightness of an sRGB color, used by the "auto" foreground metric.
export function oklabLightness(rgb: Rgb): number {
  const red = srgbByteToLinear(rgb[0]);
  const green = srgbByteToLinear(rgb[1]);
  const blue = srgbByteToLinear(rgb[2]);
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

function relativeLuminance(rgb: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function wcag2Contrast(first: Rgb, second: Rgb): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type ForegroundMetric = "auto" | "wcag2";

// Mirrors Color.foreground() for an arbitrary background, so the science
// section can show the decision boundary across a gray ramp.
export function foregroundFor(background: Rgb, metric: ForegroundMetric): string {
  const candidates: Rgb[] = [
    [0, 0, 0],
    [255, 255, 255],
  ];
  const score = (candidate: Rgb) =>
    metric === "wcag2"
      ? wcag2Contrast(background, candidate)
      : Math.abs(oklabLightness(background) - oklabLightness(candidate));

  return score(candidates[0]) >= score(candidates[1]) ? "#000000" : "#ffffff";
}

// Helmholtz-Kohlrausch weight and lightness shift, parameterized so the
// calibration sandbox can explore the provisional k and zero-weight hue.
export function hkWeight(hue: number, zeroHue: number): number {
  return 0.5 * (1 - Math.cos((hue - zeroHue) * DEG_TO_RAD));
}

export function hkDisplayLightness(
  lightness: number,
  chroma: number,
  hue: number,
  strength: number,
  zeroHue: number,
): number {
  const shifted = lightness - strength * chroma * hkWeight(hue, zeroHue);
  return shifted <= 0 ? 0 : shifted >= 1 ? 1 : shifted;
}

// Machado 2009 severity-1.0 simulation matrices, applied in linear sRGB.
const CVD_MATRICES = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
} as const;

export type CvdType = keyof typeof CVD_MATRICES;

export function simulateCvd(rgb: Rgb, type: CvdType): Rgb {
  const m = CVD_MATRICES[type];
  const r = srgbByteToLinear(rgb[0]);
  const g = srgbByteToLinear(rgb[1]);
  const b = srgbByteToLinear(rgb[2]);
  return [
    linearToByte(m[0] * r + m[1] * g + m[2] * b),
    linearToByte(m[3] * r + m[4] * g + m[5] * b),
    linearToByte(m[6] * r + m[7] * g + m[8] * b),
  ];
}

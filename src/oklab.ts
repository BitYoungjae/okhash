import type { Oklch, Rgb } from "./types.js";

const DEG_TO_RAD = Math.PI / 180;
const GAMMA_TABLE_SIZE = 4096;
const GAMUT_MARGIN = 0.995;

type LinearRgb = readonly [red: number, green: number, blue: number];
export type OklabPoint = readonly [lightness: number, a: number, b: number];

const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, "0"));
const GAMMA_LUT = new Uint8Array(GAMMA_TABLE_SIZE + 1);

for (let index = 0; index <= GAMMA_TABLE_SIZE; index += 1) {
  // Cell centers preserve rgb -> oklch -> rgb identity with the floor-indexed hot path.
  const linear = index === GAMMA_TABLE_SIZE ? 1 : (index + 0.5) / GAMMA_TABLE_SIZE;
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  GAMMA_LUT[index] = Math.round(encoded * 255);
}

export const CSAFE_LUT = [
  0, 0, 0.00132004, 0.00264009, 0.00396013, 0.00528017, 0.00660022, 0.00792026, 0.0092403,
  0.01056035, 0.01188039, 0.01320044, 0.01452048, 0.01584052, 0.01716057, 0.01848061, 0.01980065,
  0.0211207, 0.02244074, 0.02376078, 0.02508083, 0.02640087, 0.02772091, 0.02904096, 0.030361,
  0.03168104, 0.03300109, 0.03432113, 0.03564118, 0.03696122, 0.03828126, 0.03960131, 0.04092135,
  0.04224139, 0.04356144, 0.04488148, 0.04620152, 0.04752157, 0.04884161, 0.05016165, 0.0514817,
  0.05280174, 0.05412178, 0.05544183, 0.05676187, 0.05808192, 0.05940196, 0.060722, 0.06204205,
  0.06336209, 0.06468213, 0.06600218, 0.06732222, 0.06864226, 0.06996231, 0.07128235, 0.07260239,
  0.07392244, 0.07524248, 0.07656252, 0.07788257, 0.07920261, 0.08052265, 0.0818427, 0.08316274,
  0.08448279, 0.08580283, 0.08712287, 0.08844292, 0.08976296, 0.091083, 0.09240305, 0.09372309,
  0.09504313, 0.09636318, 0.09768322, 0.09900326, 0.10032331, 0.10164335, 0.10296339, 0.10428344,
  0.10560348, 0.10692353, 0.10824357, 0.10956361, 0.11088366, 0.1122037, 0.11352374, 0.11484379,
  0.11616383, 0.11748387, 0.11880392, 0.12012396, 0.121444, 0.12276405, 0.12408409, 0.12038261,
  0.11607367, 0.11179006, 0.10753173, 0.10329862, 0.09909069, 0.09490787, 0.09075008, 0.08661726,
  0.08250932, 0.07842617, 0.07436773, 0.0703339, 0.06632458, 0.06233966, 0.05837904, 0.05444259,
  0.05053021, 0.04664177, 0.04277713, 0.03893618, 0.03511877, 0.03132477, 0.02755403, 0.02380642,
  0.02008178, 0.01637996, 0.0127008, 0.00904416, 0.00540988, 0.00179778, 0,
] as const;

export function safeChromaForLightness(lightness: number): number {
  if (lightness <= 0 || lightness >= 1) {
    return 0;
  }

  const scaled = lightness * (CSAFE_LUT.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(lowerIndex + 1, CSAFE_LUT.length - 1);
  const amount = scaled - lowerIndex;

  return CSAFE_LUT[lowerIndex] + (CSAFE_LUT[upperIndex] - CSAFE_LUT[lowerIndex]) * amount;
}

export function maxSafeChromaInLightnessRange(min: number, max: number): number {
  let highest = Math.max(safeChromaForLightness(min), safeChromaForLightness(max));

  for (let index = 0; index < CSAFE_LUT.length; index += 1) {
    const lightness = index / (CSAFE_LUT.length - 1);
    if (lightness >= min && lightness <= max) {
      highest = Math.max(highest, CSAFE_LUT[index]);
    }
  }

  return highest;
}

export function maxChromaForLightnessHue(lightness: number, hue: number): number {
  if (lightness <= 0 || lightness >= 1) {
    return 0;
  }

  const angle = normalizeHue(hue) * DEG_TO_RAD;
  return (
    findGamutIntersection(Math.cos(angle), Math.sin(angle), lightness, 1, lightness) * GAMUT_MARGIN
  );
}

export function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
  const angle = normalizeHue(hue) * DEG_TO_RAD;
  const okA = Math.cos(angle) * chroma;
  const okB = Math.sin(angle) * chroma;
  const [red, green, blue] = oklabToLinearSrgb(lightness, okA, okB);

  return [linearToByte(red), linearToByte(green), linearToByte(blue)];
}

export function hexFromOklch(lightness: number, chroma: number, hue: number): string {
  const angle = normalizeHue(hue) * DEG_TO_RAD;
  const okA = Math.cos(angle) * chroma;
  const okB = Math.sin(angle) * chroma;
  const lPrime = lightness + 0.3963377774 * okA + 0.2158037573 * okB;
  const mPrime = lightness - 0.1055613458 * okA - 0.0638541728 * okB;
  const sPrime = lightness - 0.0894841775 * okA - 1.291485548 * okB;
  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;
  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return `#${HEX[linearToByte(red)]}${HEX[linearToByte(green)]}${HEX[linearToByte(blue)]}`;
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const [okL, okA, okB] = rgbToOklab(rgb);
  const chroma = Math.hypot(okA, okB);
  const hue = chroma <= Number.EPSILON ? 0 : normalizeHue(Math.atan2(okB, okA) / DEG_TO_RAD);

  return { l: okL, c: chroma, h: hue };
}

export function rgbToOklab(rgb: Rgb): OklabPoint {
  const red = srgbByteToLinear(rgb[0]);
  const green = srgbByteToLinear(rgb[1]);
  const blue = srgbByteToLinear(rgb[2]);

  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const okL = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const okA = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const okB = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  return [okL, okA, okB];
}

export function deltaEOk(first: OklabPoint, second: OklabPoint): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

export function formatCssOklch(oklch: Oklch): string {
  return `oklch(${oklch.l.toFixed(6)} ${oklch.c.toFixed(6)} ${oklch.h.toFixed(3)})`;
}

export function hexFromRgb(rgb: Rgb): string {
  return `#${HEX[rgb[0]]}${HEX[rgb[1]]}${HEX[rgb[2]]}`;
}

export function normalizeHue(hue: number): number {
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
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

function findGamutIntersection(
  okA: number,
  okB: number,
  lightness1: number,
  chroma1: number,
  lightness0: number,
): number {
  const cusp = findCusp(okA, okB);
  let amount: number;

  if ((lightness1 - lightness0) * cusp.chroma - (cusp.lightness - lightness0) * chroma1 <= 0) {
    amount =
      (cusp.chroma * lightness0) /
      (chroma1 * cusp.lightness + cusp.chroma * (lightness0 - lightness1));
  } else {
    amount =
      (cusp.chroma * (lightness0 - 1)) /
      (chroma1 * (cusp.lightness - 1) + cusp.chroma * (lightness0 - lightness1));

    const deltaLightness = lightness1 - lightness0;
    const deltaChroma = chroma1;
    const kL = 0.3963377774 * okA + 0.2158037573 * okB;
    const kM = -0.1055613458 * okA - 0.0638541728 * okB;
    const kS = -0.0894841775 * okA - 1.291485548 * okB;
    const lDelta = deltaLightness + deltaChroma * kL;
    const mDelta = deltaLightness + deltaChroma * kM;
    const sDelta = deltaLightness + deltaChroma * kS;
    const lightness = lightness0 * (1 - amount) + amount * lightness1;
    const chroma = amount * chroma1;
    const lPrime = lightness + chroma * kL;
    const mPrime = lightness + chroma * kM;
    const sPrime = lightness + chroma * kS;
    const l = lPrime * lPrime * lPrime;
    const m = mPrime * mPrime * mPrime;
    const s = sPrime * sPrime * sPrime;
    const ldt = 3 * lDelta * lPrime * lPrime;
    const mdt = 3 * mDelta * mPrime * mPrime;
    const sdt = 3 * sDelta * sPrime * sPrime;
    const ldt2 = 6 * lDelta * lDelta * lPrime;
    const mdt2 = 6 * mDelta * mDelta * mPrime;
    const sdt2 = 6 * sDelta * sDelta * sPrime;

    const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s - 1;
    const red1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
    const red2 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;
    const redStep = halleyStep(red, red1, red2);

    const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s - 1;
    const green1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
    const green2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;
    const greenStep = halleyStep(green, green1, green2);

    const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s - 1;
    const blue1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.707614701 * sdt;
    const blue2 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.707614701 * sdt2;
    const blueStep = halleyStep(blue, blue1, blue2);

    amount += Math.min(redStep, greenStep, blueStep);
  }

  return amount;
}

function findCusp(okA: number, okB: number): { lightness: number; chroma: number } {
  const saturation = computeMaxSaturation(okA, okB);
  const [red, green, blue] = oklabToLinearSrgb(1, saturation * okA, saturation * okB);
  const lightness = Math.cbrt(1 / Math.max(red, green, blue));

  return { lightness, chroma: lightness * saturation };
}

function computeMaxSaturation(okA: number, okB: number): number {
  let k0: number;
  let k1: number;
  let k2: number;
  let k3: number;
  let k4: number;
  let wl: number;
  let wm: number;
  let ws: number;

  if (-1.88170328 * okA - 0.80936493 * okB > 1) {
    k0 = 1.19086277;
    k1 = 1.76576728;
    k2 = 0.59662641;
    k3 = 0.75515197;
    k4 = 0.56771245;
    wl = 4.0767416621;
    wm = -3.3077115913;
    ws = 0.2309699292;
  } else if (1.81444104 * okA - 1.19445276 * okB > 1) {
    k0 = 0.73956515;
    k1 = -0.45954404;
    k2 = 0.08285427;
    k3 = 0.1254107;
    k4 = 0.14503204;
    wl = -1.2684380046;
    wm = 2.6097574011;
    ws = -0.3413193965;
  } else {
    k0 = 1.35733652;
    k1 = -0.00915799;
    k2 = -1.1513021;
    k3 = -0.50559606;
    k4 = 0.00692167;
    wl = -0.0041960863;
    wm = -0.7034186147;
    ws = 1.707614701;
  }

  let saturation = k0 + k1 * okA + k2 * okB + k3 * okA * okA + k4 * okA * okB;
  const kL = 0.3963377774 * okA + 0.2158037573 * okB;
  const kM = -0.1055613458 * okA - 0.0638541728 * okB;
  const kS = -0.0894841775 * okA - 1.291485548 * okB;
  const lPrime = 1 + saturation * kL;
  const mPrime = 1 + saturation * kM;
  const sPrime = 1 + saturation * kS;
  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;
  const lS = 3 * kL * lPrime * lPrime;
  const mS = 3 * kM * mPrime * mPrime;
  const sS = 3 * kS * sPrime * sPrime;
  const lS2 = 6 * kL * kL * lPrime;
  const mS2 = 6 * kM * kM * mPrime;
  const sS2 = 6 * kS * kS * sPrime;
  const f = wl * l + wm * m + ws * s;
  const f1 = wl * lS + wm * mS + ws * sS;
  const f2 = wl * lS2 + wm * mS2 + ws * sS2;

  saturation -= (f * f1) / (f1 * f1 - 0.5 * f * f2);
  return saturation;
}

function halleyStep(value: number, first: number, second: number): number {
  const denominator = first * first - 0.5 * value * second;
  const factor = first / denominator;

  return factor >= 0 ? -value * factor : Number.POSITIVE_INFINITY;
}

function linearToByte(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 255;
  }

  return GAMMA_LUT[Math.floor(value * GAMMA_TABLE_SIZE)];
}

function srgbByteToLinear(value: number): number {
  const normalized = value / 255;

  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

import { maxChromaForLightnessHue, safeChromaForLightness } from "./oklab.js";

const HK_STRENGTH = 0.32;
const HK_ZERO_HUE = 110;
const HK_TABLE_SIZE = 256;
const HK_WEIGHT_LUT = new Float64Array(HK_TABLE_SIZE);

for (let index = 0; index < HK_TABLE_SIZE; index += 1) {
  const hue = (index / HK_TABLE_SIZE) * 360;
  HK_WEIGHT_LUT[index] = 0.5 * (1 - Math.cos(((hue - HK_ZERO_HUE) * Math.PI) / 180));
}

export interface HkResult {
  lightness: number;
  chroma: number;
  clamped: boolean;
  reduction: number;
}

export function applyHelmholtzKohlrausch(lightness: number, chroma: number, hue: number): HkResult {
  const weight = hkWeight(hue);
  const displayLightness = clamp01(lightness - HK_STRENGTH * chroma * weight);
  const safeChroma = safeChromaForLightness(displayLightness);

  if (chroma <= safeChroma) {
    return { lightness: displayLightness, chroma, clamped: false, reduction: 0 };
  }

  const clampedChroma = Math.min(chroma, maxChromaForLightnessHue(displayLightness, hue));
  const clamped = clampedChroma < chroma;

  return {
    lightness: displayLightness,
    chroma: clampedChroma,
    clamped,
    reduction: clamped && chroma > 0 ? (chroma - clampedChroma) / chroma : 0,
  };
}

function hkWeight(hue: number): number {
  const normalized = ((hue % 360) + 360) % 360;
  const scaled = (normalized / 360) * HK_TABLE_SIZE;
  const lowerIndex = Math.floor(scaled) % HK_TABLE_SIZE;
  const upperIndex = (lowerIndex + 1) % HK_TABLE_SIZE;
  const amount = scaled - Math.floor(scaled);

  return (
    HK_WEIGHT_LUT[lowerIndex] + (HK_WEIGHT_LUT[upperIndex] - HK_WEIGHT_LUT[lowerIndex]) * amount
  );
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

import type { ChannelSpec, ChromaRange, Mood, Range } from "./types.js";

export interface HueWeight {
  min: number;
  max: number;
  weight: number;
}

export interface MoodConfig {
  hue: ChannelSpec;
  hueWeights?: readonly HueWeight[];
  lightness: Range;
  chroma: ChromaRange;
  chromaMode: "uniform" | "relative";
  hk: boolean;
}

export const MOODS: Record<Mood, MoodConfig> = {
  balanced: {
    hue: { min: 0, max: 360 },
    lightness: { min: 0.6, max: 0.75 },
    chroma: { min: 0.08, max: "safe" },
    chromaMode: "uniform",
    hk: true,
  },
  pastel: {
    hue: { min: 0, max: 360 },
    lightness: { min: 0.78, max: 0.88 },
    chroma: { min: 0.04, max: 0.07 },
    chromaMode: "uniform",
    hk: false,
  },
  vibrant: {
    hue: { min: 0, max: 360 },
    lightness: { min: 0.58, max: 0.7 },
    chroma: { min: 0.8, max: 0.95 },
    chromaMode: "relative",
    hk: true,
  },
  jewel: {
    hue: { min: 0, max: 360 },
    hueWeights: [
      { min: 0, max: 90, weight: 1 },
      { min: 90, max: 130, weight: 0.4 },
      { min: 130, max: 360, weight: 1 },
    ],
    lightness: { min: 0.42, max: 0.55 },
    chroma: { min: 0.7, max: 0.9 },
    chromaMode: "relative",
    hk: true,
  },
  earth: {
    hue: { min: 0, max: 360 },
    hueWeights: [
      { min: 0, max: 20, weight: 0.15 },
      { min: 20, max: 110, weight: 1 },
      { min: 110, max: 360, weight: 0.15 },
    ],
    lightness: { min: 0.5, max: 0.68 },
    chroma: { min: 0.05, max: 0.09 },
    chromaMode: "uniform",
    hk: true,
  },
  neon: {
    hue: { min: 0, max: 360 },
    lightness: { min: 0.65, max: 0.78 },
    chroma: { min: 0.9, max: 1 },
    chromaMode: "relative",
    hk: true,
  },
};

export const CVD_SAFE_PRESET: MoodConfig = {
  hue: [
    { min: 35, max: 90 },
    { min: 225, max: 290 },
  ],
  lightness: { min: 0.55, max: 0.8 },
  chroma: { min: 0.07, max: "safe" },
  chromaMode: "uniform",
  hk: true,
};

export type Mood = "balanced" | "pastel" | "vibrant" | "jewel" | "earth" | "neon";

export interface Range {
  min: number;
  max: number;
}

export interface ChromaRange {
  min: number;
  max: number | "safe";
}

export type ChannelSpec = number | readonly number[] | Range | readonly Range[];
export type ChromaSpec = number | readonly number[] | ChromaRange | readonly ChromaRange[];

export type Rgb = readonly [number, number, number];

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export interface OkhashOptions {
  mood?: Mood;
  hue?: ChannelSpec;
  lightness?: ChannelSpec;
  chroma?: ChromaSpec | { mode: "uniform" | "relative"; range: ChromaSpec };
  hk?: boolean;
  surface?: "light" | "dark";
  cvdSafe?: boolean;
  seed?: number;
  normalize?: "NFC" | false;
  cache?: number;
}

export interface ForegroundOptions {
  candidates?: readonly string[];
  metric?: "auto" | "wcag2";
  rank?: (background: Rgb, candidate: Rgb) => number;
}

export interface Color {
  hex(): string;
  rgb(): Rgb;
  oklch(): Oklch;
  css(): string;
  foreground(options?: ForegroundOptions): string;
  variant(surface: "light" | "dark"): Color;
}

export interface ColorHashFn {
  (input: string): Color;
  hex(input: string): string;
  rgb(input: string): Rgb;
  oklch(input: string): Oklch;
  css(input: string): string;
}

import {
  createColorHash,
  hashColor,
  type Color,
  type ColorHashFn,
  type OkhashOptions,
  type Rgb,
} from "okhash";
import * as okhash from "okhash";
import { distinctAssign, paletteFrom, type DistinctOptions } from "okhash/palette";

const options: OkhashOptions = {
  hue: { min: 330, max: 30 },
  lightness: 0.65,
  chroma: { min: 0.08, max: "safe" },
  normalize: "NFC",
  cache: 0,
};

const colorize: ColorHashFn = createColorHash(options);
const color: Color = colorize("Alice");
const _rgb: Rgb = hashColor.rgb("Alice");
const distinctOptions: DistinctOptions = { ...options, threshold: 0.09 };

color.hex();
color.rgb();
color.oklch();
color.css();
color.foreground({ metric: "auto" });
color.variant("dark");
paletteFrom("seed", 3, options);
distinctAssign(["Alice", "Bob"], distinctOptions);

// @ts-expect-error okhash intentionally has no default export.
const _noDefault = okhash.default;

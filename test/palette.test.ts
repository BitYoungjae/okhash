import { describe, expect, it } from "vitest";

import { distinctAssign, paletteFrom } from "../palette/src/index.js";
import { createColorHash, type Color, type OkhashOptions } from "../src/index.js";
import { deltaEOk, rgbToOklab } from "../src/oklab.js";

describe("palette module", () => {
  it("generates deterministic golden-angle palettes with representative golden output", () => {
    const palette = paletteFrom("team-alpha", 6);

    expect(palette.map((color) => color.hex())).toEqual([
      "#3cb5c6",
      "#de98be",
      "#8ca45c",
      "#799fe1",
      "#eba088",
      "#44ab94",
    ]);
    expect(palette.map((color) => color.css())).toEqual([
      "oklch(0.714187 0.106617 208.529)",
      "oklch(0.759536 0.096566 345.904)",
      "oklch(0.683182 0.101210 124.121)",
      "oklch(0.701208 0.106216 261.067)",
      "oklch(0.773386 0.096232 38.494)",
      "oklch(0.674681 0.101450 175.806)",
    ]);
    expect(paletteFrom("team-alpha", 6).map((color) => color.hex())).toEqual(
      palette.map((color) => color.hex()),
    );
  });

  it("applies resolved okhash options to palette colors", () => {
    expect(paletteFrom("team-alpha", 4, { mood: "pastel" }).map((color) => color.hex())).toEqual([
      "#acdee7",
      "#f7dbe9",
      "#bccba1",
      "#c1d5f8",
    ]);
  });

  it("assigns distinct colors by sorted key set, independent of call order", () => {
    const keys = ["zoe", "alice", "mallory", "bob", "alice"];
    const assigned = distinctAssign(keys);
    const reversed = distinctAssign([...keys].reverse());

    expect([...assigned.keys()]).toEqual(["alice", "bob", "mallory", "zoe"]);
    expect(hexEntries(assigned)).toEqual([
      ["alice", "#6679ac"],
      ["bob", "#b96c85"],
      ["mallory", "#b2744b"],
      ["zoe", "#61a9d7"],
    ]);
    expect(hexEntries(reversed)).toEqual(hexEntries(assigned));
    expect(minimumDelta([...assigned.values()])).toBeGreaterThanOrEqual(0.09);
  });

  it("keeps anchors when the threshold permits them and advances hue when it does not", () => {
    const keys = ["b", "a", "c"];
    const coreOptions = { lightness: 0.65, chroma: 0.08, hk: false } satisfies OkhashOptions;
    const colorize = createColorHash(coreOptions);
    const anchored = distinctAssign(keys, { ...coreOptions, threshold: 0 });
    const separated = distinctAssign(keys, { ...coreOptions, threshold: 0.25 });

    expect(hexEntries(anchored)).toEqual([
      ["a", colorize.hex("a")],
      ["b", colorize.hex("b")],
      ["c", colorize.hex("c")],
    ]);
    expect(separated.get("a")?.hex()).toBe(colorize.hex("a"));
    expect(separated.get("b")?.hex()).not.toBe(colorize.hex("b"));
    expect(separated.get("c")?.hex()).not.toBe(colorize.hex("c"));
  });

  it("terminates with the best candidate when a dense assignment cannot meet the threshold", () => {
    const assigned = distinctAssign(
      Array.from({ length: 12 }, (_, index) => `dense-${index}`),
      {
        hue: 180,
        lightness: 0.65,
        chroma: 0.08,
        hk: false,
        threshold: 0.5,
      },
    );

    expect(assigned.size).toBe(12);
    expect(new Set([...assigned.values()].map((color) => color.hex()))).toEqual(
      new Set(["#529f91"]),
    );
  });

  it("validates palette and assignment inputs", () => {
    expect(paletteFrom("seed", 0)).toEqual([]);
    expect(() => paletteFrom(42 as unknown as string, 1)).toThrow(TypeError);
    expect(() => paletteFrom("seed", 1.5)).toThrow(TypeError);
    expect(() => paletteFrom("seed", -1)).toThrow(RangeError);
    expect(() => distinctAssign(["a", 1 as unknown as string])).toThrow(TypeError);
    expect(() => distinctAssign(["a"], { threshold: Number.NaN })).toThrow(TypeError);
    expect(() => distinctAssign(["a"], { threshold: -0.1 })).toThrow(RangeError);
  });
});

function hexEntries(map: ReadonlyMap<string, Color>): Array<[string, string]> {
  return [...map].map(([key, color]) => [key, color.hex()]);
}

function minimumDelta(colors: readonly Color[]): number {
  const labs = colors.map((color) => rgbToOklab(color.rgb()));
  let minimum = Number.POSITIVE_INFINITY;

  for (let first = 0; first < labs.length; first += 1) {
    for (let second = first + 1; second < labs.length; second += 1) {
      minimum = Math.min(minimum, deltaEOk(labs[first], labs[second]));
    }
  }

  return minimum;
}

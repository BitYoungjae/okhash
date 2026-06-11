import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createColorHash, type OkhashOptions } from "../src/index.js";

interface GoldenCase {
  name: string;
  options: OkhashOptions;
  hex: string[];
}

interface GoldenFixture {
  version: number;
  inputs: string[];
  cases: GoldenCase[];
}

const HEX_RE = /^#[0-9a-f]{6}$/;
const fixture = readGoldenFixture();

describe("frozen OKH1 golden corpus", () => {
  it("has the expected fixture shape", () => {
    expect(fixture.version).toBe(1);
    expect(fixture.inputs.length).toBeGreaterThanOrEqual(550);
    expect(new Set(fixture.inputs).size).toBe(fixture.inputs.length);
    expect(fixture.cases.map((entry) => entry.name)).toEqual([
      "default",
      "mood-balanced",
      "mood-pastel",
      "mood-vibrant",
      "mood-jewel",
      "mood-earth",
      "mood-neon",
      "cvd-safe",
      "surface-light",
      "surface-dark",
      "seed-1",
      "seed-c0ffee",
      "hk-off",
    ]);

    for (const entry of fixture.cases) {
      expect(entry.hex).toHaveLength(fixture.inputs.length);
      expect(entry.hex.every((value) => HEX_RE.test(value))).toBe(true);
    }
  });

  for (const entry of fixture.cases) {
    it(`matches ${entry.name} hex output bit-for-bit`, () => {
      const colorize = createColorHash(entry.options);

      for (let index = 0; index < fixture.inputs.length; index += 1) {
        expect(colorize.hex(fixture.inputs[index])).toBe(entry.hex[index]);
      }
    });
  }
});

function readGoldenFixture(): GoldenFixture {
  return JSON.parse(readFileSync("test/fixtures/golden-corpus.json", "utf8")) as GoldenFixture;
}

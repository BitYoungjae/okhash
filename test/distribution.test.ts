import { describe, expect, it } from "vitest";

import { cyrb53pair } from "../src/hash.js";

const HUE_BINS = 359;
const DISTRIBUTION_SAMPLES = 50_000;
const SIMILAR_INPUT_PAIRS = 1_000;

describe("hash and channel distribution gates", () => {
  it("keeps hue distribution inside the chi-square gate", () => {
    const counts = Array.from({ length: HUE_BINS }, () => 0);

    for (let index = 0; index < DISTRIBUTION_SAMPLES; index += 1) {
      const [h1] = cyrb53pair(`distribution-${index}`);
      const hueT = (h1 & 0xffff) / 0x10000;
      counts[Math.min(Math.floor(hueT * HUE_BINS), HUE_BINS - 1)] += 1;
    }

    const expected = DISTRIBUTION_SAMPLES / HUE_BINS;
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);

    expect(chiSquare).toBeLessThan(450);
  });

  it("keeps nearby names from collapsing into nearby hues", () => {
    let close = 0;

    for (let index = 0; index < SIMILAR_INPUT_PAIRS; index += 1) {
      const first = hueDegrees(`user-${index}`);
      const second = hueDegrees(`user-${index + 1}`);
      const delta = Math.abs(first - second);

      if (Math.min(delta, 360 - delta) < 10) {
        close += 1;
      }
    }

    expect(close).toBeGreaterThanOrEqual(30);
    expect(close).toBeLessThanOrEqual(80);
  });

  it("keeps sampled channel byte correlation below the design gate", () => {
    const hueBytes: number[] = [];
    const chromaBytes: number[] = [];
    const lightnessBytes: number[] = [];

    for (let index = 0; index < DISTRIBUTION_SAMPLES; index += 1) {
      const [h1, h2] = cyrb53pair(`correlation-${index}`);

      hueBytes.push(h1 & 0xff);
      chromaBytes.push(h2 & 0xff);
      lightnessBytes.push((h2 >>> 8) & 0xff);
    }

    expect(Math.abs(correlation(hueBytes, chromaBytes))).toBeLessThan(0.01);
    expect(Math.abs(correlation(hueBytes, lightnessBytes))).toBeLessThan(0.01);
    expect(Math.abs(correlation(chromaBytes, lightnessBytes))).toBeLessThan(0.01);
  });
});

function hueDegrees(input: string): number {
  const [h1] = cyrb53pair(input);
  return ((h1 & 0xffff) / 0x10000) * 360;
}

function correlation(first: readonly number[], second: readonly number[]): number {
  const firstMean = mean(first);
  const secondMean = mean(second);
  let covariance = 0;
  let firstVariance = 0;
  let secondVariance = 0;

  for (let index = 0; index < first.length; index += 1) {
    const firstDelta = first[index] - firstMean;
    const secondDelta = second[index] - secondMean;

    covariance += firstDelta * secondDelta;
    firstVariance += firstDelta * firstDelta;
    secondVariance += secondDelta * secondDelta;
  }

  return covariance / Math.sqrt(firstVariance * secondVariance);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

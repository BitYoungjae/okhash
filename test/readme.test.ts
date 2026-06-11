import { describe, expect, it } from "vitest";

import { createColorHash, hashColor } from "../src/index.js";
import { distinctAssign, paletteFrom } from "../palette/src/index.js";

// Every value asserted here is quoted verbatim in README.md, docs/REFERENCE.md,
// or the demo. If the algorithm changes these on purpose, update the docs in the
// same change so the published examples never drift from real output.

describe("README examples", () => {
  it("matches the quick-start outputs", () => {
    expect(hashColor.hex("Alice")).toBe("#a293cb");
    expect(hashColor.rgb("Alice")).toEqual([162, 147, 203]);
    expect(hashColor.css("Alice")).toBe("oklch(0.696651 0.082351 296.496)");

    const oklch = hashColor.oklch("Alice");
    expect(oklch.l).toBeCloseTo(0.696651, 5);
    expect(oklch.c).toBeCloseTo(0.082351, 5);
    expect(oklch.h).toBeCloseTo(296.496, 2);
  });

  it("matches the configured-instance outputs", () => {
    const colorize = createColorHash({ mood: "vibrant", seed: 0xc0ffee });
    const color = colorize("user@acme.io");
    expect(color.hex()).toBe("#6a60db");

    expect(createColorHash({ mood: "pastel" }).hex("design")).toBe("#e1bbc6");
  });

  it("matches the foreground example", () => {
    expect(hashColor("Alice Park").hex()).toBe("#a97849");
    expect(hashColor("Alice Park").foreground()).toBe("#000000");
  });

  it("matches the palette examples", () => {
    expect(paletteFrom("acme-corp", 5).map((c) => c.hex())).toEqual([
      "#ca767f",
      "#6eba81",
      "#7d75b7",
      "#c3894b",
      "#2ab6c1",
    ]);

    const colors = distinctAssign(["frontend", "infra", "design", "data"]);
    expect(colors.get("frontend")?.hex()).toBe("#c8a447");
    expect(colors.get("infra")?.hex()).toBe("#3c94b6");
    expect(colors.get("design")?.hex()).toBe("#7da26d");
    expect(colors.get("data")?.hex()).toBe("#997dbd");
  });

  it("keeps css() equal to a hand-built string from oklch()", () => {
    const color = hashColor("Alice");
    const o = color.oklch();
    const built = `oklch(${o.l.toFixed(6)} ${o.c.toFixed(6)} ${o.h.toFixed(3)})`;
    expect(color.css()).toBe(built);
  });
});

import { describe, expect, it } from "vitest";

import { distinctAssign, paletteFrom } from "../palette/src/index.js";
import { createColorHash, hashColor } from "../src/index.js";

describe("bootstrap exports", () => {
  it("exposes core entry points", () => {
    expect(typeof createColorHash).toBe("function");
    expect(typeof hashColor).toBe("function");
    expect(typeof hashColor.hex).toBe("function");
    expect(typeof hashColor.rgb).toBe("function");
    expect(typeof hashColor.oklch).toBe("function");
    expect(typeof hashColor.css).toBe("function");
  });

  it("exposes palette entry points", () => {
    expect(typeof paletteFrom).toBe("function");
    expect(typeof distinctAssign).toBe("function");
  });
});

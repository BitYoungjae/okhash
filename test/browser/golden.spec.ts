import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

interface GoldenFixture {
  inputs: string[];
  cases: Array<{
    name: string;
    options: unknown;
    hex: string[];
  }>;
}

const fixture = JSON.parse(
  readFileSync("test/fixtures/golden-corpus.json", "utf8"),
) as GoldenFixture;
const defaultCase = fixture.cases.find((entry) => entry.name === "default");

if (defaultCase === undefined) {
  throw new Error("default golden case is missing");
}

test("browser golden output matches the full frozen corpus", async ({ page }) => {
  await page.route("http://okhash.local/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/") {
      await route.fulfill({
        contentType: "text/html",
        body: `
          <!doctype html>
          <script type="module">
            import { createColorHash, hashColor } from "/index.mjs";
            globalThis.__okhash = { createColorHash, hashColor };
          </script>
        `,
      });
      return;
    }

    await route.fulfill({
      path: resolve("dist", url.pathname.slice(1)),
      contentType: "text/javascript",
    });
  });

  await page.goto("http://okhash.local/");
  await page.waitForFunction(() => "__okhash" in globalThis);
  const mismatch = await page.evaluate(async (golden) => {
    const okhash = (
      globalThis as typeof globalThis & {
        __okhash: {
          createColorHash(options: unknown): { hex(input: string): string };
          hashColor: { hex(input: string): string };
        };
      }
    ).__okhash;
    const defaultEntry = golden.cases.find((entry) => entry.name === "default");

    if (defaultEntry === undefined) {
      return {
        caseName: "fixture",
        input: "",
        actual: "missing default case",
        expected: "default case",
      };
    }

    for (const entry of golden.cases) {
      const colorize = okhash.createColorHash(entry.options);

      for (let index = 0; index < golden.inputs.length; index += 1) {
        const actual = colorize.hex(golden.inputs[index]);
        if (actual !== entry.hex[index]) {
          return {
            caseName: entry.name,
            input: golden.inputs[index],
            actual,
            expected: entry.hex[index],
          };
        }
      }
    }

    for (let index = 0; index < golden.inputs.length; index += 1) {
      const actual = okhash.hashColor.hex(golden.inputs[index]);
      if (actual !== defaultEntry.hex[index]) {
        return {
          caseName: "hashColor",
          input: golden.inputs[index],
          actual,
          expected: defaultEntry.hex[index],
        };
      }
    }

    return null;
  }, fixture);

  expect(mismatch).toBeNull();
});

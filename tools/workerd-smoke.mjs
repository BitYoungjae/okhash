import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

const fixture = JSON.parse(await readFile("test/fixtures/golden-corpus.json", "utf8"));
const tempDir = resolve(tmpdir(), `okhash-workerd-smoke-${process.pid}`);

await mkdir(tempDir, { recursive: true });

try {
  const distModules = ["dist/index.mjs", ...(await findDistChunks())];

  for (const modulePath of distModules) {
    await cp(modulePath, resolve(tempDir, basename(modulePath)));
  }

  await writeFile(
    resolve(tempDir, "worker.mjs"),
    `
import { createColorHash, hashColor } from "./index.mjs";

const inputs = ${JSON.stringify(fixture.inputs)};
const cases = ${JSON.stringify(fixture.cases)};
const defaultCase = cases.find((entry) => entry.name === "default");

export default {
  async test() {
    if (defaultCase === undefined) {
      throw new Error("default golden case is missing");
    }

    for (const entry of cases) {
      const colorize = createColorHash(entry.options);

      for (let index = 0; index < inputs.length; index += 1) {
        const actual = colorize.hex(inputs[index]);
        if (actual !== entry.hex[index]) {
          throw new Error(\`\${entry.name} golden mismatch for \${JSON.stringify(inputs[index])}: \${actual} !== \${entry.hex[index]}\`);
        }
      }
    }

    for (let index = 0; index < inputs.length; index += 1) {
      const actual = hashColor.hex(inputs[index]);
      if (actual !== defaultCase.hex[index]) {
        throw new Error(\`hashColor golden mismatch for \${JSON.stringify(inputs[index])}: \${actual} !== \${defaultCase.hex[index]}\`);
      }
    }
  },
};
`,
  );

  await writeFile(resolve(tempDir, "config.capnp"), workerdConfig(distModules));

  const result = spawnSync(
    resolve("node_modules/.bin/workerd"),
    ["test", "-I", "node_modules/workerd", resolve(tempDir, "config.capnp")],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  if (result.status !== 0) {
    throw new Error(`workerd runtime smoke failed\n${result.stdout}\n${result.stderr}`.trim());
  }

  console.log("workerd: okhash runtime smoke passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

async function findDistChunks() {
  const index = await readFile("dist/index.mjs", "utf8");
  return [...index.matchAll(/\bimport\s*(?:[^"']*from\s*)?["'](\.\/[^"']+)["']/g)].map(
    (match) => `dist/${match[1].slice(2)}`,
  );
}

function workerdConfig(distModules) {
  const modules = [
    '(name = "worker.mjs", esModule = embed "worker.mjs")',
    ...distModules.map(
      (modulePath) =>
        `(name = "${basename(modulePath)}", esModule = embed "${basename(modulePath)}")`,
    ),
  ].join(",\n        ");

  return `
using Workerd = import "/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (
      name = "main",
      worker = (
        compatibilityDate = "2026-06-11",
        modules = [
        ${modules}
        ],
      ),
    ),
  ],
  sockets = [],
);
`;
}

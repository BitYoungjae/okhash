import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const fixture = JSON.parse(await readFile("test/fixtures/golden-corpus.json", "utf8"));
const distUrl = pathToFileURL(resolve("dist/index.mjs")).href;
const scriptPath = resolve(tmpdir(), `okhash-runtime-smoke-${process.pid}.mjs`);
const smokeScript = `
import { createColorHash, hashColor } from ${JSON.stringify(distUrl)};

const inputs = ${JSON.stringify(fixture.inputs)};
const cases = ${JSON.stringify(fixture.cases)};
const defaultCase = cases.find((entry) => entry.name === "default");

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

console.log("okhash runtime smoke passed");
`;

await mkdir(dirname(scriptPath), { recursive: true });
await writeFile(scriptPath, smokeScript);

try {
  run("node", process.execPath, [scriptPath]);
  await runRequired("deno", ["run", "--allow-read", scriptPath]);
  await runRequired("bun", [scriptPath]);
} finally {
  await rm(scriptPath, { force: true });
}

function run(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(
      `${name} runtime smoke failed\n${result.stdout.trim()}\n${result.stderr.trim()}`.trim(),
    );
  }

  console.log(`${name}: ${result.stdout.trim()}`);
}

async function runRequired(command, args) {
  if (!(await isCommandAvailable(command))) {
    throw new Error(`${command} runtime smoke failed: command not found`);
  }

  run(command, command, args);
}

async function isCommandAvailable(command) {
  const pathEntries = process.env.PATH?.split(":") ?? [];

  for (const pathEntry of pathEntries) {
    try {
      await access(resolve(pathEntry, command));
      return true;
    } catch {
      // Keep looking.
    }
  }

  return false;
}

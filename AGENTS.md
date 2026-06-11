# Repository Guidelines

## Project Structure & Module Organization

This repository is an ESM-only TypeScript package for deterministic OKLCH color generation. Core library code lives in `src/`, with the public entry point in `src/index.ts`. The palette subpath is implemented under `palette/src/`. Tests live in `test/`, including browser coverage in `test/browser/` and deterministic fixtures in `test/fixtures/`. Build, smoke, benchmark, and golden-corpus utilities live in `tools/` and `bench/`. The Vite/React demo is isolated under `demo/`, and reference documentation lives in `docs/REFERENCE.md`.

## Build, Test, and Development Commands

Use Node `>=22.22.1` and install with `npm ci`.

- `npm run build`: builds the package with `tsdown` into `dist/`.
- `npm run check`: runs format check, lint, typecheck, and Vitest.
- `npm run test`: runs all `test/**/*.test.ts` unit tests with Vitest.
- `npm run test:exports`: builds and verifies package exports/types.
- `npm run test:runtime`: checks runtime compatibility smoke tests.
- `npm run test:browser`: builds and runs Playwright browser tests.
- `npm run golden:update`: regenerates deterministic golden fixtures after intentional algorithm changes.
- `npm run demo:dev`: starts the local demo with `demo/vite.config.ts`.

## Coding Style & Naming Conventions

Keep TypeScript strict and ESM-native. Use explicit `.js` extensions in relative imports, `type` imports for types, and small pure functions for color math and hashing paths. Source files use two-space indentation and semicolons. Prefer descriptive camelCase for values/functions and PascalCase for exported types/interfaces. Run `npm run format` before submitting broad edits; `oxfmt` ignores `demo/`, while `oxlint` ignores `demo/` and `dist/`.

## Testing Guidelines

Vitest test files should end in `.test.ts` and stay under `test/`. Add focused tests near the behavior being changed: core API behavior in `test/core.test.ts`, package/export behavior in distribution tests, and color stability in golden tests. If deterministic output changes, update fixtures with `npm run golden:update` and explain why in the PR. For browser-facing changes, run `npm run test:browser`; for package-boundary changes, run `npm run test:package`.

## Commit & Pull Request Guidelines

This checkout has no commit history to infer a local commit style from, so use concise imperative commit subjects such as `Add palette contrast tests` or `Fix dark surface variant`. Pull requests should follow `.github/PULL_REQUEST_TEMPLATE.md`: include a summary, changed areas, test plan, and any skipped checks. Document public API or export changes in both `README.md` and `docs/REFERENCE.md`. Note size, benchmark, runtime, or demo impacts when relevant, and include screenshots for visible demo changes.

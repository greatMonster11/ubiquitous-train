# AGENTS.md

Guidance for coding agents working in `patch_pdf`.

## Project Snapshot

- Runtime: Node.js with ES modules (`"type": "module"`).
- Package manager: Bun (`bun.lockb` is generated on install).
- Main scripts/files in repo root:
  - `main.js`: downloads a PDF and applies masking patches.
  - `extractor.js`: extracts text/coords and detects email/phone/LinkedIn locations.
  - `pdf2html.js`: one-off conversion/debug script.
- No CI, lint, formatter, or formal test framework is currently configured.

## Environment and Setup

- Use a modern Node.js version (Node 18+ recommended; Node 20+ preferred).
- Install deps:
  - `bun install`
- Run scripts from repository root:
  - `/Users/npthanh/Documents/sample/patch_pdf`

## Build, Lint, and Test Commands

This repository currently has no true build step and no lint setup.

### Build / Run

- Run main flow:
  - `bun run main.js`
- Run PDF-to-HTML helper script:
  - `bun run pdf2html.js`
- Quick syntax check for all JS files:
  - `bun run --check main.js`
  - `bun run --check extractor.js`
  - `bun run --check pdf2html.js`

### Lint / Format

- No linter is configured yet.
- No auto-formatter is configured yet.
- If you introduce ESLint/Prettier, add scripts in `package.json` and document them here.

### Tests

- Current `bun test` script intentionally fails:
  - `bun test`
  - Expected behavior today: exits with error (`"no test specified"`).
- No committed test files exist at the moment.

If adding tests, prefer Node's built-in test runner to keep dependencies light:

- Run all tests:
  - `bun test`
- Run a single test file:
  - `bun test path/to/file.test.js`
- Run tests matching a name/pattern:
  - `bun test --test-name-pattern "mask email"`
- Run a single test file + name pattern:
  - `bun test path/to/file.test.js --test-name-pattern "phone"`

Suggested `package.json` scripts if you add tests:

- `"test": "bun test"`
- `"test:one": "bun test"` (pass file path after `--`)
- `"test:remote": "RUN_REMOTE_TESTS=1 bun test remote-cv.test.js"`
- Example:
  - `bun run test:one -- test/extractor.test.js`

## Repository-Specific Coding Guidelines

Follow existing style in current files unless a deliberate refactor is requested.

### Imports

- Use ESM `import`/`export` only.
- Prefer grouping imports in this order:
  1. Node built-ins (`fs`, `path`, etc.)
  2. Third-party packages (`axios`, `pdf-lib`, `pdfjs-dist`)
  3. Local modules (`./extractor.js`)
- Keep one import per module source.
- Include file extensions for local ESM imports (for example `./extractor.js`).

### Formatting

- Use 2-space indentation.
- Use semicolons.
- Use double quotes for strings.
- Keep trailing commas where they improve diffs (already used in object/array literals).
- Keep line length readable; wrap long calls/arrays across lines.

### Types and Data Shapes

- Codebase is JavaScript, not TypeScript.
- Preserve stable object shapes for coordinate records:
  - `str`, `x`, `y`, `width`, `height`, `page`, optional `fontSize`.
- Prefer defensive checks around nullable values (for example missing annotations/text).
- If introducing complex objects, add lightweight JSDoc typedefs instead of migrating to TS.

### Naming Conventions

- Functions: `camelCase` (`findEmailCoordinates`).
- Variables: `camelCase`.
- Constants: `camelCase` for local constants; reserve `UPPER_SNAKE_CASE` for true globals.
- Files: short lowercase names; keep current root-level naming unless restructuring is requested.
- Use clear verb-based names for actions (`extract`, `find`, `remove`, `apply`).

### Error Handling and Logging

- Wrap top-level async workflows in `try/catch`.
- Log actionable context with errors (which input/page/step failed).
- Prefer rethrowing or returning structured failure data in library-style functions.
- Avoid swallowing errors silently.
- Avoid adding noisy `console.log` debugging to committed code.

### Async and Performance

- Use `async/await` over raw Promise chains.
- Keep page-level loops deterministic and easy to trace.
- Avoid repeated expensive operations inside tight loops when values can be cached.
- Be careful mutating extracted coordinate objects in-place; document when mutation is intentional.

### PDF-Specific Safety Rules

- Do not assume every PDF annotation has `url` or uniform rectangle data.
- Guard against malformed coordinate/transform data.
- Keep masking logic idempotent where possible (running twice should not corrupt output unexpectedly).
- Validate page index math carefully (`page` values are 1-based in current code).

## Change Management Expectations for Agents

- Keep changes minimal and scoped to the user request.
- Do not add new dependencies unless clearly justified.
- If you add scripts/tools (lint/test/build), update `package.json` and this file together.
- If you modify behavior in `main.js` or `extractor.js`, include a short note in PR/commit messages about PDF assumptions.

## Rules Files Check (Cursor / Copilot)

The following rule locations were checked and are currently absent in this repository:

- `.cursorrules`
- `.cursor/rules/`
- `.github/copilot-instructions.md`

If any of these files are added later, treat them as authoritative and merge their guidance into this document.

## Quick Command Reference

- Install deps: `bun install`
- Run app: `bun run main.js`
- Run helper script: `bun run pdf2html.js`
- Run all tests (when added): `bun test`
- Run single test file (when added): `bun test test/file.test.js`
- Run matching tests (when added): `bun test --test-name-pattern "pattern"`

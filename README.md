# patch_pdf

Patch sensitive contact information in CV PDFs by locating and masking:

- Email addresses
- Phone numbers
- LinkedIn URLs

The tool extracts PDF text/coordinates, detects contact spans, maps them back to page bounding boxes, and draws mask blocks over the original content.

## Requirements

- Node.js 18+ (Node 20+ recommended)
- Bun 1.1+

## Install

```bash
bun install
```

## Usage

Run with either a local file path or a remote URL.

### From local file

```bash
bun run main.js --input /path/to/cv.pdf --output /path/to/output_patched.pdf --style sharded
```

### From URL

```bash
bun run main.js --url "https://example.com/cv.pdf" --output ./output_patched.pdf --style solid
```

### CLI options

- `--input <path>`: Input local PDF file
- `--url <url>`: Input remote PDF URL
- `--output <path>`: Output file path (default: `./output_patched.pdf`)
- `--style <sharded|solid>`: Mask style (default: `sharded`)

Notes:

- Provide either `--input` or `--url`.
- If both are provided, `--input` is used first.

## What is detected

- Emails, including split-token patterns (for example: `john . doe @ mail . com`)
- Phone numbers with common separators and optional extension (`ext`, `x`)
- LinkedIn URLs from:
  - PDF link annotations
  - Plain text in content (`linkedin.com/in`, `linkedin.com/company`, `linkedin.com/school`, `lnkd.in`)

## Tests

### Unit tests

```bash
bun test
```

### Remote CV integration tests

Runs patching against configured public CV URLs.

```bash
bun run test:remote
```

This suite is opt-in and internally sets `RUN_REMOTE_TESTS=1`.

## Project structure

- `main.js`: CLI entry point and mask rendering
- `extractor.js`: text extraction and contact coordinate detection
- `extractor.test.js`: unit tests for detector behavior
- `remote-cv.test.js`: integration tests for remote CV URLs
- `pdf2html.js`: helper/debug conversion script

## Limitations

- Scanned/image-only PDFs are not OCR-processed yet.
- Extremely complex layouts (rotated/warped text) may require additional geometry handling.

## Quick commands

- Syntax check:
  - `bun run --check main.js`
  - `bun run --check extractor.js`
  - `bun run --check pdf2html.js`
- Run tool:
  - `bun run main.js --input /path/to/cv.pdf --output ./patched.pdf`
- Run tests:
  - `bun test`
  - `bun run test:remote`

## Notes on Bun

- Bun will generate `bun.lockb` on install.
- If you previously used npm, you can remove `package-lock.json` after switching to Bun to avoid confusion.
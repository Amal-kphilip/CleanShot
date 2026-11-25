# Contributing to CleanShot

Thank you for your interest in contributing to CleanShot! Every contribution helps keep client-side privacy tooling accurate, fast, and reliable.

## Local Development Setup

### Prerequisites

- **Node.js** 20+ (Node 22 LTS recommended)
- **npm** (included with Node.js)

### Getting Started

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/Amal-kphilip/CleanShot.git
   cd CleanShot
   ```
2. Install dependencies (this also runs `postinstall` to copy local ExifTool WASM and Gemini video assets into `public/`):
   ```bash
   npm ci
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Validation Commands

Before opening a pull request, run all four validation commands and ensure they pass:

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run lint
npm test
npm run build
```

## Branch & Pull Request Flow

1. Create a descriptive branch from `main` (e.g., `feat/avif-stripper`, `fix/pdf-xmp-parsing`, `docs/update-coverage`).
2. Keep changes focused and atomic. Never introduce network uploads or external tracking — all file processing must remain **100% client-side**.
3. Add or update unit tests for any new behavior or bug fix.
4. Run the four validation commands above.
5. Open a pull request against `main` and complete the pull request checklist.

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <short description>
```

Common types:
- `feat`: A new feature or format handler
- `fix`: A bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code restructuring without behavior change
- `chore`: Maintenance, dependencies, or tooling
- `ci`: CI/CD workflow changes

Examples:
- `feat(engine): add metadata stripping for Foo format`
- `fix(jpeg): preserve ICC color profile when requested`
- `test(png): add fixture for iTXt chunk removal`

## Adding a Test Fixture or Format Handler

CleanShot's metadata-cleaning and inspection engine lives under [`src/lib/engine/`](src/lib/engine/), with unit tests and fixtures in [`src/lib/engine/__tests__/`](src/lib/engine/__tests__/).

### Adding a Test Fixture

1. Use minimal, synthetic, or public-domain test files — **never commit files containing real personal or sensitive metadata** (GPS coordinates, real names, serial numbers).
2. Add or update tests in `src/lib/engine/__tests__/` using Vitest (`npm test`).
3. Verify both that targeted metadata is stripped/redacted and that valid output structure/pixels/streams are preserved.

### Adding a New Format Handler

1. Create a format-specific module in `src/lib/engine/` (following existing handlers such as `png.ts`, `jpeg.ts`, or `pdf.ts`).
2. Register magic-byte detection in `src/lib/engine/magic.ts` and route cleaning/inspection in `src/lib/engine/stripper.ts` and `src/lib/engine/inspector.ts`.
3. Update `src/lib/engine/types.ts` and `docs/PRIVACY_AND_FORMAT_COVERAGE.md` to document the supported format and what metadata is removed vs. preserved.
4. Add comprehensive tests in `src/lib/engine/__tests__/` covering valid files, edge cases, and malformed inputs.

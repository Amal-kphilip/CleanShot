# CleanShot

[![CI](https://github.com/[YOUR_GITHUB_USERNAME]/[REPO_NAME]/actions/workflows/ci.yml/badge.svg)](https://github.com/[YOUR_GITHUB_USERNAME]/[REPO_NAME]/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/[YOUR_GITHUB_USERNAME]/[REPO_NAME])](https://github.com/[YOUR_GITHUB_USERNAME]/[REPO_NAME]/releases)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.6-black)](https://nextjs.org/)

> A privacy-focused file metadata inspector, metadata remover, and Gemini watermark remover. All processing runs locally in your browser with zero server uploads.

## Live Demo

- **Web App:** [DEMO_URL]

## Screenshots

> Add screenshots to `docs/images/` before publishing.

| Metadata Cleaner & Inspector | Gemini Watermark Remover |
| --- | --- |
| ![Metadata Cleaner](docs/images/screenshot-cleaner.png) | ![Gemini Watermark Remover](docs/images/screenshot-watermark.png) |

## Features

- **100% Client-Side Processing:** Files are read, inspected, and cleaned locally in your browser. No files are uploaded to a server.
- **Format-Specific Metadata Removal:** Removes targeted metadata across JPEG/JPG, PNG, WebP, GIF, SVG, PDF, DOCX, MP4, MOV, WebM, MKV, MP3, AAC, FLAC, WAV, and M4A files.
- **Browser Web Worker Pool:** Runs metadata cleaning, ZIP extraction, ZIP archiving, and Gemini image processing in a bounded worker pool, with a safe main-thread fallback for small non-video files when module workers are unavailable.
- **Metadata Inspector & Full Scan:** Inspect common EXIF/XMP/IPTC, document, and container metadata fields before and after cleaning, plus an optional client-side ExifTool scan.
- **Client-Side ZIP Extraction & Batch Export:** Extract supported files directly from uploaded `.zip` archives and package cleaned batches into a downloadable ZIP archive in the browser.
- **Additional Browser Tools:** Gemini Watermark Remover (images & WebCodecs video, routed through the same canonical metadata-removal engine), Image Comparison, Metadata Editor, and Image Analyzer.
- **Honest Unsupported-Format Handling:** Formats without safe support (TIFF/RAW, HEIC/HEIF, AVIF, BMP, JPEG XL, AVI, OGG, `.doc`) are rejected explicitly and never marked as cleaned.

## Tech Stack

- **Framework:** Next.js 16 (`16.4.6`), React 19 (`19.3.1`), TypeScript 5
- **Styling & UI:** Tailwind CSS 3, Framer Motion, Lucide Icons
- **Client-Side Engines & Runtimes:** Custom format-specific binary/container parsers (`src/lib/engine/`), `@lilohuang/exiftool` (WebAssembly via `zeroperl`), `@pilio/gemini-watermark-remover` & `onnxruntime-web`, `exifr`, `pdf-lib`, `jszip`, `fflate`
- **Testing & Tooling:** Vitest, ESLint 9, Docker

## Privacy Model

All file inspection, metadata removal, archive handling, and watermark removal run entirely in your browser using JavaScript, Web Workers, and WebAssembly. No files or metadata leave your device.

For full details on supported formats, stripped vs. preserved fields, and verification guarantees, see [Privacy Model and Metadata Coverage](docs/PRIVACY_AND_FORMAT_COVERAGE.md) and [Lossless Guarantee](docs/LOSSLESS_GUARANTEE.md).

## Documentation & Notices

- [Privacy Model and Metadata Coverage](docs/PRIVACY_AND_FORMAT_COVERAGE.md)
- [Implementation Notes](docs/IMPLEMENTATION_NOTES.md)
- [Lossless Guarantee](docs/LOSSLESS_GUARANTEE.md)
- [Metadata Coverage](docs/METADATA-COVERAGE.md)
- [ExifTool Version](docs/EXIFTOOL-VERSION.md)
- [ExifTool Metadata Viewer](docs/EXIFTOOL-METADATA-VIEWER.md)
- [Mobile Dark Theme Fix](docs/MOBILE-DARK-THEME-FIX.md)
- [Third-Party Notices](THIRD_PARTY_NOTICES.md)

## Quick Start

```bash
npm ci
npm run dev
```

## Validation & Build

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run lint
npm test
npm run build
```

## Docker

```bash
docker-compose up -d --build
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## Security

If you discover a security vulnerability, please report it privately as described in [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

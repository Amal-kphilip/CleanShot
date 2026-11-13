# CleanShot

> A privacy-focused file metadata inspector, cleaner, and Gemini watermark remover. All processing runs locally in your browser.

## Features

- **Metadata removal without re-encoding** for the supported JPEG, PNG, WebP, and GIF paths. SVG is sanitized as text markup, so its serialized bytes change and exact pixel equivalence is not claimed.
- **Bounded browser worker pool** for supported image-processing tasks, with a safe main-thread fallback for small files where module workers are unavailable.
- **Metadata inspector** for reviewing common image metadata and GPS-related fields before and after cleaning.
- **Color profile controls** to preserve supported color-profile chunks when opted in.
- **Batch processing and ZIP download** generated entirely in the browser.
- **Honest unsupported-format handling** for HEIC/HEIF, AVIF, TIFF/RAW, BMP, and JPEG XL. These are recognized where possible, but are not marked as cleaned.
- **Client-side only:** Files are read and processed locally in your browser. No files are uploaded to a server.

## Quick Start

```bash
npm ci
npm run dev
```

## Validation

```bash
node node_modules/typescript/bin/tsc --noEmit
npm test
npm run build
```

A successful type check is not a substitute for the tests and production build. Run all three validation commands in an environment with the platform-specific Next.js and Rollup optional dependencies installed before deploying.

## Docker

```bash
docker-compose up -d --build
```

## License

MIT

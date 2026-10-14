# CleanShot

> A privacy-focused photo metadata inspector and remover. Processing is browser-side by default, with an explicitly selectable server mode.

## Features

- **Metadata removal without re-encoding** for the supported JPEG, PNG, WebP, and GIF paths. SVG is sanitized as text markup, so its serialized bytes change and exact pixel equivalence is not claimed.
- **Bounded browser worker pool** for supported image-processing tasks, with a safe main-thread fallback where module workers are unavailable.
- **Metadata inspector** for reviewing common image metadata and GPS-related fields before and after cleaning.
- **Color profile controls** to preserve supported color-profile chunks by default.
- **Batch processing and ZIP download** with browser-side output in client mode and API-backed downloads in server mode.
- **Honest unsupported-format handling** for HEIC/HEIF, AVIF, TIFF/RAW, BMP, and JPEG XL. These are recognized where possible, but are not marked as cleaned.
- **Privacy modes:** Client-Side mode processes images in the browser. Server-Side mode uploads selected images to the application server for processing. Server-side job data is held in process memory and is subject to the host's lifecycle; this is not a guarantee of secure erasure or persistence across instances.

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

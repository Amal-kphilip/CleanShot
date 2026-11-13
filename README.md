# CleanShot (StripMeta)

> A privacy-focused file metadata inspector, cleaner, and Gemini watermark remover. All processing runs locally in your browser with zero server uploads.

## Features

- **100% Client-Side Processing:** Files are read, inspected, and cleaned locally in your browser. No files are uploaded to a server.
- **Lossless Metadata Removal:** Strips privacy-sensitive metadata without re-encoding for supported JPEG, PNG, WebP, and GIF paths. SVG is sanitized as text markup (serialized bytes change; exact pixel equivalence is not claimed).
- **Browser Web Worker Pool:** Runs supported image-processing tasks in a bounded worker pool, with a safe main-thread fallback when module workers are unavailable.
- **Metadata Inspector & Full Scan:** Inspect common EXIF/XMP/IPTC and GPS fields before and after cleaning, plus an optional client-side ExifTool scan.
- **Color Profile & Orientation Controls:** Opt in to preserving supported ICC color-profile chunks or EXIF orientation tags.
- **Client-Side Batch ZIP Export:** Package cleaned batches into a ZIP archive directly in the browser (`fflate`), with optional folder-structure preservation and filename-collision deduplication.
- **Additional Browser Tools:** Gemini Watermark Remover (images & WebCodecs video), Image Comparison, Metadata Editor, and Image Analyzer.
- **Honest Unsupported-Format Handling:** Formats without safe lossless support (TIFF/RAW, HEIC/HEIF, AVIF, BMP, JPEG XL) are recognized where possible and not marked as cleaned.

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

## License

MIT

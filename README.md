# CleanShot

> A privacy-focused file metadata inspector, metadata remover, and Gemini watermark remover. All processing runs locally in your browser with zero server uploads.

## Features

- **100% Client-Side Processing:** Files are read, inspected, and cleaned locally in your browser. No files are uploaded to a server.
- **Format-Specific Metadata Removal:** Removes targeted metadata across JPEG/JPG, PNG, WebP, GIF, SVG, PDF, DOCX, MP4, MOV, WebM, MKV, MP3, AAC, FLAC, WAV, and M4A files.
- **Browser Web Worker Pool:** Runs metadata cleaning, ZIP extraction, ZIP archiving, and Gemini image processing in a bounded worker pool, with a safe main-thread fallback for small non-video files when module workers are unavailable.
- **Metadata Inspector & Full Scan:** Inspect common EXIF/XMP/IPTC, document, and container metadata fields before and after cleaning, plus an optional client-side ExifTool scan.
- **Client-Side ZIP Extraction & Batch Export:** Extract supported files directly from uploaded `.zip` archives and package cleaned batches into a downloadable ZIP archive in the browser.
- **Additional Browser Tools:** Gemini Watermark Remover (images & WebCodecs video, routed through the same canonical metadata-removal engine), Image Comparison, Metadata Editor, and Image Analyzer.
- **Honest Unsupported-Format Handling:** Formats without safe support (TIFF/RAW, HEIC/HEIF, AVIF, BMP, JPEG XL, AVI, OGG, `.doc`) are rejected explicitly and never marked as cleaned.

## Documentation & Notices

- [Privacy Model and Metadata Coverage](docs/PRIVACY_AND_FORMAT_COVERAGE.md)
- [Implementation Notes](docs/IMPLEMENTATION_NOTES.md)
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

## License

MIT — see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

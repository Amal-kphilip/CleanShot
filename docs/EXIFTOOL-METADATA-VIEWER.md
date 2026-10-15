# Full ExifTool Metadata Viewer

This patch adds an opt-in **Full ExifTool Scan** tab to the existing Metadata Inspector.

## What it adds

- A browser-local ExifTool WebAssembly scan of the originally selected file.
- Deep tag output using `-a -u -G1 -s -n` (duplicates, unknown tags, group names, short/raw tag names and numeric values).
- Search across the complete raw output.
- Copy and TXT download for the original ExifTool output.
- JSON output generation and download on demand.
- Local file details: file name, browser MIME type, size, last-modified timestamp, first 32 bytes in hex and SHA-256 where practical.

## Privacy and runtime

Metadata extraction runs in the browser. The selected file is passed to `@lilohuang/exiftool`; there is no metadata upload route. The runtime fetches `/zeroperl.wasm` from the same origin. This file is generated from the installed `@lilohuang/zeroperl-ts` dependency during `postinstall` and is intentionally ignored by Git so deployments generate it from the lockfile.

The initial runtime download is several megabytes. If it fails, confirm `public/zeroperl.wasm` was created after `npm install` and is served from `/zeroperl.wasm` by the development server/hosting build.

## Limits

The package integration pins @lilohuang/exiftool 1.0.10, which bundles ExifTool 13.59. Keep this dependency pinned and re-check the upstream package metadata when upgrading. The tool reports what the bundled ExifTool can parse from the chosen file. It does not guarantee that every format-specific tag, proprietary maker note or damaged-file structure is readable, and missing tags are not evidence of authenticity or AI origin.

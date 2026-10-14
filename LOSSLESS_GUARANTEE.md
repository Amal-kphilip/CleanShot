# CleanShot — Format Support and Verification Boundaries

This document describes the current implementation, not a universal guarantee that every image or metadata format is fully sanitized. The supported parsers operate on container structures and do not re-encode raster image data. Unsupported or malformed inputs should return an error instead of being reported as cleaned.

## Current status by format

| Format | Current behavior | Important limits |
|---|---|---|
| JPEG/JFIF | Parses marker segments, removes comments and selected auxiliary APP segments, removes trailing bytes after EOI, and preserves the compressed scan data. JFIF, Adobe transform markers, and ICC data are retained according to implementation/options. | The orientation setting may preserve a minimal EXIF block containing only the orientation tag. Marker-based handling is not a certification against every non-standard private-data convention. |
| PNG | Validates chunk boundaries and CRCs, removes known text/timestamp/signature metadata, and can replace EXIF with an orientation-only chunk. | Known rendering/color chunks are kept or filtered according to settings. Unknown chunks and malformed files are rejected rather than passed through. |
| WebP | Parses RIFF chunks, strips EXIF/XMP, updates RIFF length and metadata feature flags, and can preserve only EXIF orientation. | Unknown chunk types and malformed RIFF structures are rejected. |
| GIF | Removes comment blocks and recognized metadata application extensions while keeping image blocks, timing/control structures, and known animation-loop extensions. | Plain-text extensions are retained because they can affect visible content. Unknown application extensions are rejected. |
| SVG | Removes selected comments, metadata/editor attributes, and simple script/event-handler markup patterns. | This is text sanitization, not an XML security certification. Treat untrusted SVGs cautiously; the output is not claimed to be pixel-identical. |
| HEIC/HEIF, AVIF, TIFF/RAW, BMP, JPEG XL | Explicitly not supported for safe lossless stripping in this implementation. | Processing should return an unsupported-format error without modifying the original. |

## What “without re-encoding” means

For the supported raster formats, the implementation edits the container and retains encoded image-data segments rather than decoding and recompressing the picture. That avoids an additional lossy encode. It does not mean every output has identical rendering under every viewer: for example, orientation or color-profile settings can affect display interpretation. SVG text is modified directly, so pixel equality is not asserted.

## Verification limits

- The engine validates selected structural properties and has unit tests and direct checks for representative metadata cases.
- Test fixtures do not cover every vendor extension, camera model, file corruption mode, or metadata convention.
- No claim is made here that a full independent decoded-pixel comparison has been run for every format.
- A successful operation means the supported parser completed its checks; it is not a forensic guarantee that all possible private information was removed.

For high-sensitivity use cases, independently inspect cleaned outputs with a separate metadata parser and verify that the specific metadata fields of concern are absent.

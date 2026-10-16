# StripMeta metadata-removal policy

StripMeta's default mode now uses strict metadata removal for formats with a format-specific parser. It removes known metadata and unknown optional/ancillary extension chunks rather than failing on every unknown metadata chunk. Unknown critical chunks, malformed containers, and unsupported formats still fail without marking the original file as cleaned.

## Current parser support

- **JPEG:** removes APP metadata segments, comments, trailing data, ICC/color-profile metadata, and EXIF orientation by default. The encoded scan data is not recompressed. CMYK/Adobe color interpretation may differ when color metadata is removed.
- **PNG:** removes text, EXIF, time, C2PA (`caBX`/`c2pa`), digital-signature chunks, physical-size/resolution metadata, unknown ancillary chunks, and color-profile/transfer metadata by default. Keeps required image data, palette/transparency data, and APNG animation chunks. Unknown critical chunks are rejected.
- **WebP:** removes EXIF, XMP, ICC profile metadata, and unknown chunks by default, while updating the VP8X feature flags and RIFF size.
- **GIF:** removes comments, application metadata (except standard animation-loop control), and unrecognized extension metadata while preserving image data, graphic-control blocks, and plain-text graphic content.
- **SVG:** applies the existing metadata/comments/RDF/XMP/editor-attribute cleanup. SVG is text-based and the current parser does not claim to remove every conceivable custom namespace attribute or metadata-like text node.

## Unsupported formats

TIFF, RAW variants, HEIC/HEIF, AVIF, BMP, and JPEG XL are not currently safely rewritten by this lossless engine. They must produce an explicit unsupported/error result, not a successful “cleaned” file. “Strip all metadata” means all removable metadata recognized by the active supported-format parser; no tool can guarantee removal of arbitrary information encoded into visible pixels or reliably rewrite every proprietary format without format-specific support.

## Trade-offs

The default strips color-profile and EXIF-orientation metadata. This improves metadata removal but can change color interpretation or the displayed orientation of some images. Users may explicitly opt to preserve this rendering metadata, in which case the output intentionally is not fully metadata-free.

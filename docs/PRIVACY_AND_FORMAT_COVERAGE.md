# CleanShot Privacy Model and Metadata Coverage

This document defines CleanShot's metadata-removal coverage, format-specific removal and preservation rules, and privacy boundaries across all supported formats. It should be updated whenever a supported format or stripping algorithm changes.

## Privacy Boundary

File bytes are read and transformed by JavaScript locally in the user's browser (inside CleanShot's Web Worker pool where supported, with a size-restricted fallback for small non-video files). The cleaning code does not upload file bytes or filenames to any server.

This boundary does not make a cleaned file anonymous. Visible or audible content can still reveal faces, voices, addresses, account names, landmarks, screen content, or other personal information. Because the downloaded filename is derived from the original filename, users should rename files when the filename itself is sensitive.

## Canonical Metadata-Removal Pipeline

Both of CleanShot's processing workflows execute the exact same canonical metadata-removal engine (`stripImageMetadata` / `stripMetadataBuffer`):

1. **Standard Metadata Removal (`/`)**: Transfers the uploaded file's bytes to the shared Web Worker pool, runs the format-specific CleanShot metadata cleaner, verifies the output format, and returns the cleaned bytes for inspection and download.
2. **Gemini Watermark Remover (`/gemini-watermark-remover`)**: Removes the visible Gemini/Veo watermark, encodes the resulting image or MP4 video, and passes the final encoded bytes through the exact same canonical metadata-cleaning engine (without format-overriding retention flags) before creating the preview or download Blob.

## Supported Formats and Targeted Structures

CleanShot implements strict format-specific removal and preservation policies across all 17 supported extensions:

| Format | Removed or Neutralised | Preserved / Important Limits |
|---|---|---|
| **JPEG / JPG** | EXIF and XMP `APP1` (`0xFFE1`) segments, IPTC/Photoshop `APP13` (`0xFFED`) segments, and `COM` (`0xFFFE`) comments | Compressed image data from `SOS` (`0xFFDA`) onward is copied losslessly when segment structure parses cleanly (falling back to browser raster decode/re-encode if segment parsing fails). `APP0` (JFIF), `APP2` (ICC colour profiles), `APP14` (Adobe colour-transform markers), and other unmodified markers are preserved. |
| **PNG** | Pre-screened via `inspectPngAnimation()`, then decoded and re-encoded onto a fresh canvas (`OffscreenCanvas` in workers, `<canvas>` fallback) to produce a clean PNG | Static PNG only. Animated PNG (`acTL`, `fcTL`, `fdAT`) and malformed PNG containers are rejected rather than flattened. Colour-profile behaviour depends on the browser's canvas encoder. |
| **WebP** | Pre-screened via `inspectWebpAnimation()`, decoded and re-encoded via canvas, then parsed by `stripWebpMetadataChunks()` to strip `ICCP`, `EXIF`, and `XMP ` chunks and clear their `VP8X` flags (dropping `VP8X` if no alpha/animation flags remain) | Static WebP only. Animated WebP (`ANIM`, `ANMF`, or `VP8X` animation flag `0x02`) and malformed RIFF/WebP containers are rejected rather than flattened. |
| **GIF** | Comment extensions (`0xFE`), Plain-Text extensions (`0x01`), XMP application extensions, and all non-animation application/extension blocks (`stripGifBlocks()`) | `GIF87a`/`GIF89a` header, palettes, image descriptors, LZW-compressed frame data, Graphic Control Extensions (`0xF9` timing/transparency), and `NETSCAPE`/`ANIMEXTS` loop extensions are copied without raster re-encoding. |
| **PDF** | Catalog `/Metadata` XMP stream reference, Document Info fields (`Title`, `Author`, `Subject`, `Keywords`, `Producer`, `Creator` cleared in-place), trailer `/Info` reference, and trailer `/ID` document identifier pair (`pdf-lib`) | Loaded with `updateMetadata: false` and saved with `useObjectStreams: false`. Pages and visible document content, annotations, forms, and embedded streams are preserved and not redacted. |
| **DOCX** | Entire `docProps/` folder (`core.xml`, `app.xml`, `custom.xml`, thumbnails); WordprocessingML `<*:rsids>` tables; identity attributes (`author`, `initials`, `providerId`, `userId`, `personId` cleared to `""`); revision dates (`date`, `dateUtc`), `durableId`, and `rsid*` attributes across all `word/**/*.xml` parts | Rebuilt as a valid `.docx` ZIP archive using `DEFLATE` level 6. Visible document text, comment text, and tracked-change markup are preserved. |
| **MP4, MOV, M4A** | `udta` and `meta` boxes (rewritten to `free` and zeroed), creation/modification timestamps in `mvhd`/`tkhd`/`mdhd`, and Apple `meta` handler tracks plus their timed sample payloads in `mdat` (`stripIsobmffBoxes()`) | Audio/video media samples and container byte offsets are preserved. Classic sample tables (`stsc`, `stsz`/`stz2`, `stco`/`co64`) and fragmented MP4 structures (`mvex`/`trex`, `moof`/`traf`/`tfhd`/`trun`) are validated before mutation. Ambiguous metadata-track layouts fail safely. |
| **WebM, MKV** | `Tags`, `Chapters`, and `Attachments` (neutralised in-place as same-sized EBML `Void` elements); `SegmentInfo` `WritingApp` and `MuxingApp`; per-track `Name` and `Language` strings (`stripEbmlElements()`) | Encoded `Cluster` media payloads are preserved without descending into block data. Known-size and schema-valid unknown-size live `Cluster` elements are supported; other unknown-size layouts fail safely. |
| **MP3** | Leading `ID3v2` tag and conventional trailing `ID3v1`, `ID3v1 Extended`, and `APEv2` tags (`stripId3Tags()`) | MPEG audio frames are preserved. When a leading `ID3v2` tag is removed before a raw MPEG audio frame, a 10-byte empty `ID3v2.4` header is prepended for strict reader compatibility. |
| **AAC** | Non-standard leading/trailing `ID3`/`APE` tags plus validated Libav (`Lavc`/`Lavf`) encoder-identification text inside the first ADTS frame's fill element (`stripAacEncoderIdentification()`) | Raw ADTS AAC audio frames and bit layout are preserved at identical offsets. |
| **FLAC** | `VORBIS_COMMENT`, `PICTURE`, `APPLICATION`, and `PADDING` metadata blocks (`stripFlacBlocks()`) | `STREAMINFO` (mandatory first block), `SEEKTABLE`, `CUESHEET`, reserved/unknown block types (`>= 7`), and audio frames are preserved, with the final kept metadata block's last-block flag bit updated. |
| **WAV** | RIFF `LIST/INFO`, Broadcast Wave `bext`, and `id3 ` chunks (`stripRiffChunks()`) | `fmt `, `data`, `fact`, and unknown RIFF chunks are preserved conservatively, with RIFF size and word-alignment padding maintained. |
| **SVG** *(CleanShot extra)* | XML comments, `<metadata>`, `<rdf:RDF>`, editor namespaces/attributes (`inkscape`, `sodipodi`, `illustrator`, `figma`), and embedded `<script>`/`on*` handlers | Vector paths, shapes, gradients, styles, and `viewBox` are preserved as UTF-8 text markup. |

## Unsupported Formats & Failure Behaviour

AVI, OGG, HEIC/HEIF, AVIF, TIFF/RAW, BMP, JPEG XL, and legacy `.doc` files are not supported for metadata removal and are rejected explicitly rather than passed through as cleaned.

All container parsers validate lengths, offsets, sample tables, and schema bounds before mutating data. When safe bounds cannot be established (or when an animated PNG/WebP or ambiguous metadata track is encountered), CleanShot fails closed for that file and surfaces a per-file error while allowing the rest of the batch to continue.

## Browser API Requirements

- **Web Workers & Transferable ArrayBuffers**: Used to run metadata stripping, ZIP extraction, ZIP creation, and Gemini image processing off the main thread. A conservative 10 MB main-thread fallback is permitted only for non-video files when workers cannot initialize.
- **`createImageBitmap` & `OffscreenCanvas` (or HTML `<canvas>` fallback)**: Required for browser raster decode/re-encode of static PNG and WebP files (and JPEG fallback re-encoding).
- **WebCodecs (`VideoDecoder` / `VideoEncoder`)**: Required for local Gemini video watermark removal.

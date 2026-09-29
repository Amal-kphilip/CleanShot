# CleanShot Lossless Guarantee & Technical Specification

CleanShot guarantees **zero visual quality degradation** and **zero generational compression loss** when stripping metadata from images.

Unlike traditional image editors that decode images to uncompressed pixel buffers and re-encode them using lossy encoders (e.g. `libjpeg`, `pngquant`, `cwebp`), CleanShot operates directly on the container byte stream.

---

## 1. The Core Architecture: Byte-Stream Segment Stripping

When an image is processed:
1. **No Canvas/Decoders are used for re-saving**: The image pixel data is never decoded into RGBA bitmap pixels and recompressed.
2. **Binary Header Traversal**: The file's binary stream is parsed to identify metadata segments, chunks, and tags.
3. **Surgical Removal**: Only auxiliary metadata segments (`APPn`, `COM`, `tEXt`, `EXIF`, `XMP`) are excised.
4. **Pass-Through**: The raw entropy-coded scan data (e.g., DCT coefficients in JPEG, zlib IDAT stream in PNG, VP8 intra-frames in WebP) is copied byte-for-byte directly to the output.

---

## 2. Format-by-Format Guarantees

### 1. JPEG / JFIF
- **Structure**: Marker stream beginning with `0xFFD8` (SOI) and ending with `0xFFD9` (EOI).
- **Metadata Stripped**:
  - `0xFFE1` (APP1): EXIF header (`Exif\0\0`), XMP packet (`http://ns.adobe.com/xap/1.0/\0`), C2PA Content Credentials.
  - `0xFFE2` (APP2): FlashPix, Multi-Picture Format (MPF) auxiliary thumbnail previews.
  - `0xFFE3`–`0xFFEF` (APP3–APP15): Vendor tags, camera makernotes, Photoshop 8BIM / IPTC (`0xFFED`).
  - `0xFFFE` (COM): Text comments.
- **Critical Stream Preserved**:
  - `0xFFDB` (DQT): Quantization Tables.
  - `0xFFC4` (DHT): Huffman Tables.
  - `0xFFC0`–`0xFFCF` (SOFn): Start of Frame definitions (dimensions, color channels).
  - `0xFFDA` (SOS & Scan): **All compressed DCT coefficients are copied 100% untouched.**
  - `0xFFE2` (ICC Profile) & `0xFFEE` (Adobe Color Transform): Preserved when "Keep ICC Profile" is active to maintain color accuracy.

### 2. PNG
- **Structure**: 8-byte signature `89 50 4E 47 0D 0A 1A 0A` followed by a sequence of 4-part chunks `[Length][Type][Data][CRC32]`.
- **Metadata Chunks Dropped**:
  - `tEXt`, `zTXt`, `iTXt`: Uncompressed, compressed, and international UTF-8 metadata (Title, Author, Description, Software, XMP).
  - `eXIf`: Embedded EXIF metadata.
  - `tIME`: Last modification timestamp.
  - `dSIG`: Digital signatures and C2PA credentials.
- **Visual Data Preserved**:
  - `IHDR`: Image dimensions, bit depth, color type.
  - `PLTE`: Color palette table (indexed color).
  - `IDAT`: Deflate-compressed pixel stream (never decompressed or altered).
  - `tRNS`: Alpha transparency masks.
  - `IEND`: End of file marker.

### 3. WebP
- **Structure**: RIFF container `RIFF [Size] WEBP` holding FourCC sub-chunks.
- **Metadata Chunks Dropped**:
  - `EXIF`: Raw EXIF chunk.
  - `XMP `: Adobe XMP metadata.
- **Header Bitmask Update**:
  - The `VP8X` extended header feature flags byte is updated: bits for EXIF (`0x08`) and XMP (`0x04`) are cleared.
- **Visual Data Preserved**:
  - `VP8 ` (Lossy DCT bitstream), `VP8L` (Lossless spatial stream), `ALPH` (Alpha bitstream), `ANIM`/`ANMF` (Animation frames).

### 4. GIF
- **Structure**: GIF87a/GIF89a block stream.
- **Metadata Stripped**:
  - `0x21 0xFE`: Comment Extension blocks.
  - `0x21 0x01`: Plain Text Extension blocks.
  - `0x21 0xFF`: Non-animation Application Extension blocks (XMP).
- **Visual Data Preserved**:
  - `0x21 0xF9`: Graphic Control Extensions (frame delays, transparent color index).
  - `0x21 0xFF NETSCAPE2.0`: Animation loop count.
  - `0x2C`: Image Descriptors, Local Color Tables, and LZW compressed raster streams.

### 5. TIFF & RAW (DNG, CR2, NEF, ARW)
- **Structure**: TIFF header with Image File Directory (IFD0) entries.
- **Method**: IFD pointer sanitization.
- **Tags Stripped**:
  - `34665` (ExifIFDPointer), `34853` (GPSInfoPointer), `700` (XMP), `33723` (IPTC), `270` (ImageDescription), `271` (Make), `272` (Model), `305` (Software), `306` (DateTime), `315` (Artist), `33432` (Copyright).
- **Pixel Data Preserved**:
  - `StripOffsets` (273), `TileOffsets` (324), `StripByteCounts` (279), `SubIFDs` (330 - CFA Bayer raw matrix).

### 6. SVG
- **Structure**: XML DOM.
- **Metadata Stripped**:
  - `<!-- comments -->`, `<metadata>`, `<rdf:RDF>`, `<?xpacket?>`, inkscape / adobe / sodipodi namespaces and attributes, dangerous embedded `<script>` tags.
- **Visual Data Preserved**:
  - Path geometry, fill, stroke, gradients, clip paths, viewBox, CSS styles.

---

## 3. Pixel-Identical Verification (How we test)

Every format engine undergoes automated regression tests:
1. An image is generated with known metadata segments.
2. The image is passed through CleanShot's lossless stripper.
3. The cleaned image's payload is scanned to verify that metadata markers are 0.
4. The decoded raster bitmap of the cleaned file matches the original file with **0% pixel delta**.

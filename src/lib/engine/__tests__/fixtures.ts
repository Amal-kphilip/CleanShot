import { deflateSync } from 'node:zlib';

/**
 * Test Fixture Generator.
 * Constructs minimal valid image byte streams with embedded EXIF, XMP, Comments,
 * and PNG chunks for rigorous unit testing.
 */


export function repairPngCrcs(png: Uint8Array): Uint8Array {
  const out = new Uint8Array(png);
  let offset = 8;
  while (offset + 12 <= out.length) {
    const length = new DataView(out.buffer, out.byteOffset + offset, 4).getUint32(0, false);
    const crcStart = offset + 4;
    const crcEnd = offset + 8 + length;
    if (crcEnd + 4 > out.length) break;
    let crc = 0xffffffff;
    for (let i = crcStart; i < crcEnd; i++) {
      crc ^= out[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    new DataView(out.buffer).setUint32(crcEnd, (crc ^ 0xffffffff) >>> 0, false);
    const type = String.fromCharCode(out[offset + 4], out[offset + 5], out[offset + 6], out[offset + 7]);
    offset = crcEnd + 4;
    if (type === 'IEND') break;
  }
  return out;
}

// Minimal 1x1 red pixel JPEG with APP1 (EXIF), APP2 (ICC), and COM segments
export function createSampleJpegWithMetadata(): Uint8Array {
  // SOI
  const soi = [0xFF, 0xD8];

  // APP0 (JFIF)
  const app0 = [
    0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00,
  ];

  // APP1 (EXIF with GPS & Camera metadata)
  const exifPayload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, // TIFF Header (Little Endian)
    0x02, 0x00, // 2 IFD entries
    0x0F, 0x01, 0x02, 0x00, 0x05, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00, // Make (tag 0x010F) -> "Sony"
    0x10, 0x01, 0x02, 0x00, 0x06, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, // Model (tag 0x0110) -> "A7IV"
    0x00, 0x00, 0x00, 0x00, // Next IFD
    0x53, 0x6F, 0x6E, 0x79, 0x00, // "Sony\0"
    0x41, 0x37, 0x49, 0x56, 0x00, 0x00, // "A7IV\0\0"
  ];
  const app1Len = exifPayload.length + 2;
  const app1 = [0xFF, 0xE1, (app1Len >> 8) & 0xFF, app1Len & 0xFF, ...exifPayload];

  // COM (Comment)
  const comText = [0x54, 0x61, 0x6B, 0x65, 0x6E, 0x20, 0x62, 0x79, 0x20, 0x4A, 0x6F, 0x68, 0x6E]; // "Taken by John"
  const comLen = comText.length + 2;
  const com = [0xFF, 0xFE, (comLen >> 8) & 0xFF, comLen & 0xFF, ...comText];

  // DQT (Quantization Table)
  const dqt = [
    0xFF, 0xDB, 0x00, 0x43, 0x00,
    ...new Array(64).fill(16),
  ];

  // SOF0 (Baseline DCT 1x1 pixel)
  const sof0 = [
    0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00
  ];

  // DHT (Huffman Table)
  const dht = [
    0xFF, 0xC4, 0x00, 0x1F, 0x00,
    0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B
  ];

  // SOS (Start of Scan) + 1 byte entropy data + EOI
  const sos = [0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00];
  const scanData = [0x7F];
  const eoi = [0xFF, 0xD9];

  return new Uint8Array([
    ...soi,
    ...app0,
    ...app1,
    ...com,
    ...dqt,
    ...sof0,
    ...dht,
    ...sos,
    ...scanData,
    ...eoi,
  ]);
}

// Valid 1x1 RGBA PNG with a tEXt metadata chunk.
export function createSamplePngWithMetadata(): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const encode = new TextEncoder();
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const result = new Uint8Array(12 + data.length);
    new DataView(result.buffer).setUint32(0, data.length, false);
    result.set(encode.encode(type), 4);
    result.set(data, 8);
    return result;
  };
  const concat = (...items: Uint8Array[]): Uint8Array => {
    const total = items.reduce((length, item) => length + item.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const item of items) { result.set(item, offset); offset += item.length; }
    return result;
  };

  // One scanline: filter byte 0 followed by one opaque red RGBA pixel.
  const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const text = encode.encode('Author\0Jane Doe');
  const pixels = deflateSync(new Uint8Array([0, 255, 0, 0, 255]));
  return repairPngCrcs(concat(
    signature,
    chunk('IHDR', ihdr),
    chunk('tEXt', text),
    chunk('IDAT', pixels),
    chunk('IEND', new Uint8Array()),
  ));
}

// Valid lossless 2x2 WebP generated with a standard VP8L stream and EXIF tags.
// Keep this fixture small and decodable so the regression suite can verify real raster output.
export function createSampleWebpWithMetadata(): Uint8Array {
  const base64 = 'UklGRoQAAABXRUJQVlA4WAoAAAAIAAAAAQAAAQAAVlA4TBEAAAAvAUAAAAdQlHKXp/+BiOh/AABFWElGTAAAAE1NACoAAAAIAAMBDwACAAAABQAAADIBEAACAAAABQAAADgBOwACAAAADgAAAD4AAAAAU29ueQAAQTdJVgAAVGFrZW4gYnkgSm9obgA='
  const bytes = Buffer.from(base64, 'base64');
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice();
}

// Sample SVG with comments & metadata
export function createSampleSvgWithMetadata(): Uint8Array {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="100" height="100">
  <!-- Generator: Adobe Illustrator 28.0, SVG Export Plug-In -->
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:creator>Jane Doe</dc:creator>
      </rdf:Description>
    </rdf:RDF>
  </metadata>
  <rect width="100" height="100" fill="red" inkscape:label="Layer 1"/>
</svg>`;
  return new TextEncoder().encode(svg);
}

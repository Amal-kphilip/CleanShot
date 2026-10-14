import { describe, it, expect } from 'vitest';
import { detectImageFormat, sanitizeFilename, buildCleanedFilename } from '../magic';
import { stripImageMetadata } from '../stripper';
import {
  createSampleJpegWithMetadata,
  createSamplePngWithMetadata,
  createSampleWebpWithMetadata,
  createSampleSvgWithMetadata,
  repairPngCrcs,
} from './fixtures';

describe('Magic Byte Detector & Sanitizer', () => {
  it('detects JPEG format correctly', () => {
    const jpeg = createSampleJpegWithMetadata();
    const info = detectImageFormat(jpeg);
    expect(info.format).toBe('jpeg');
    expect(info.mimeType).toBe('image/jpeg');
    expect(info.isLosslessStrippable).toBe(true);
  });

  it('detects PNG format correctly', () => {
    const png = createSamplePngWithMetadata();
    const info = detectImageFormat(png);
    expect(info.format).toBe('png');
    expect(info.mimeType).toBe('image/png');
  });

  it('detects WebP format correctly', () => {
    const webp = createSampleWebpWithMetadata();
    const info = detectImageFormat(webp);
    expect(info.format).toBe('webp');
  });

  it('detects SVG format correctly', () => {
    const svg = createSampleSvgWithMetadata();
    const info = detectImageFormat(svg);
    expect(info.format).toBe('svg');
  });

  it('sanitizes unsafe filenames and path traversal attempts', () => {
    expect(sanitizeFilename('../../../secret/photo.jpg')).toBe('photo.jpg');
    expect(sanitizeFilename('..\\..\\malicious.exe')).toBe('malicious.exe');
    expect(sanitizeFilename('my<invalid>:file?.png')).toBe('my_invalid__file_.png');
  });

  it('builds cleaned filename with suffix', () => {
    expect(buildCleanedFilename('vacation.jpg', '_clean')).toBe('vacation_clean.jpg');
    expect(buildCleanedFilename('avatar.png', '_stripped')).toBe('avatar_stripped.png');
    expect(buildCleanedFilename('raw_photo', '_clean')).toBe('raw_photo_clean');
  });
});

describe('Lossless JPEG Stripping Engine', () => {
  it('strips APP1 (EXIF) and COM (Comment) segments losslessly', async () => {
    const originalJpeg = createSampleJpegWithMetadata();
    const result = await stripImageMetadata(originalJpeg, 'test_camera.jpg');

    expect(result.format).toBe('jpeg');
    expect(result.pixelIdentical).toBe(true);
    expect(result.cleanedSize).toBeLessThan(result.originalSize);
    expect(result.bytesSaved).toBeGreaterThan(0);
    expect(result.removedSegments.some((s) => s.includes('APP1'))).toBe(true);
    expect(result.removedSegments.some((s) => s.includes('COM'))).toBe(true);

    // Verify cleaned buffer starts with SOI (FF D8) and ends with EOI (FF D9)
    const cleaned = result.cleanedBuffer;
    expect(cleaned[0]).toBe(0xFF);
    expect(cleaned[1]).toBe(0xD8);
    expect(cleaned[cleaned.length - 2]).toBe(0xFF);
    expect(cleaned[cleaned.length - 1]).toBe(0xD9);

    // Verify APP1 marker (0xFFE1) and COM marker (0xFFFE) no longer exist in cleaned buffer
    let hasApp1 = false;
    let hasCom = false;
    for (let i = 0; i < cleaned.length - 1; i++) {
      if (cleaned[i] === 0xFF && cleaned[i + 1] === 0xE1) hasApp1 = true;
      if (cleaned[i] === 0xFF && cleaned[i + 1] === 0xFE) hasCom = true;
    }
    expect(hasApp1).toBe(false);
    expect(hasCom).toBe(false);
  });

  it('strips C2PA manifests (APP11) and drops trailing payloads after EOI', async () => {
    const originalJpeg = createSampleJpegWithMetadata();
    // Append APP11 (0xFFEB) C2PA manifest and trailing metadata after EOI
    const app11 = [0xFF, 0xEB, 0x00, 0x06, 0x4A, 0x50, 0x00, 0x00]; // "JP"
    const trailingBytes = [0x54, 0x52, 0x41, 0x49, 0x4C, 0x49, 0x4E, 0x47]; // "TRAILING"

    const jpegWithC2pa = new Uint8Array([
      originalJpeg[0], originalJpeg[1],
      ...app11,
      ...originalJpeg.slice(2),
      ...trailingBytes
    ]);

    const result = await stripImageMetadata(jpegWithC2pa, 'ai_art.jpg');
    expect(result.pixelIdentical).toBe(true);

    // Verify APP11 is removed
    const cleaned = result.cleanedBuffer;
    let hasApp11 = false;
    for (let i = 0; i < cleaned.length - 1; i++) {
      if (cleaned[i] === 0xFF && cleaned[i + 1] === 0xEB) hasApp11 = true;
    }
    expect(hasApp11).toBe(false);

    // Verify trailing bytes after EOI are dropped
    expect(cleaned[cleaned.length - 2]).toBe(0xFF);
    expect(cleaned[cleaned.length - 1]).toBe(0xD9);
    expect(cleaned.length).toBeLessThan(jpegWithC2pa.length);
  });
});

describe('Lossless PNG Stripping Engine', () => {
  it('drops ancillary tEXt metadata chunks and preserves IHDR, IDAT, IEND', async () => {
    const originalPng = createSamplePngWithMetadata();
    const result = await stripImageMetadata(originalPng, 'graphic.png');

    expect(result.format).toBe('png');
    expect(result.pixelIdentical).toBe(true);
    expect(result.cleanedSize).toBeLessThan(result.originalSize);
    expect(result.removedSegments.some((s) => s.includes('tEXt'))).toBe(true);

    // Verify PNG signature intact
    const cleaned = result.cleanedBuffer;
    expect(cleaned[0]).toBe(0x89);
    expect(cleaned[1]).toBe(0x50);
    expect(cleaned[2]).toBe(0x4E);
    expect(cleaned[3]).toBe(0x47);

    // Verify tEXt chunk is absent
    const cleanedText = new TextDecoder('latin1').decode(cleaned);
    expect(cleanedText.includes('tEXt')).toBe(false);
    expect(cleanedText.includes('IHDR')).toBe(true);
    expect(cleanedText.includes('IDAT')).toBe(true);
    expect(cleanedText.includes('IEND')).toBe(true);
  });
});

describe('Lossless WebP Stripping Engine', () => {
  it('removes EXIF chunk and clears EXIF flag in VP8X header', async () => {
    const originalWebp = createSampleWebpWithMetadata();
    const result = await stripImageMetadata(originalWebp, 'photo.webp');

    expect(result.format).toBe('webp');
    expect(result.cleanedSize).toBeLessThan(result.originalSize);
    expect(result.removedSegments.some((s) => s.includes('EXIF'))).toBe(true);

    const cleaned = result.cleanedBuffer;
    const str = new TextDecoder('latin1').decode(cleaned);
    expect(str.startsWith('RIFF')).toBe(true);
    expect(str.includes('WEBP')).toBe(true);
    expect(str.includes('EXIF')).toBe(false);
    expect(str.includes('VP8 ') || str.includes('VP8L')).toBe(true);
  });
});

describe('Lossless SVG Stripping Engine', () => {
  it('removes comments, <metadata>, RDF, and inkscape namespaces', async () => {
    const originalSvg = createSampleSvgWithMetadata();
    const result = await stripImageMetadata(originalSvg, 'vector.svg');

    expect(result.format).toBe('svg');
    expect(result.bytesSaved).toBeGreaterThan(0);

    const cleanedStr = new TextDecoder('utf-8').decode(result.cleanedBuffer);
    expect(cleanedStr.includes('<!-- Generator')).toBe(false);
    expect(cleanedStr.includes('<metadata>')).toBe(false);
    expect(cleanedStr.includes('xmlns:inkscape')).toBe(false);
    expect(cleanedStr.includes('<rect')).toBe(true);
  });
});




describe('Privacy-safe handling of uncommon container data', () => {
  it('strips metadata markers inserted between JPEG scans instead of retaining them in scan data', async () => {
    const base = createSampleJpegWithMetadata();
    const marker = new Uint8Array([0xff, 0xe1, 0x00, 0x06, 0x41, 0x42, 0x43, 0x44]);
    const eoiStart = base.length - 2;
    const withInterScanMetadata = new Uint8Array(base.length + marker.length);
    withInterScanMetadata.set(base.slice(0, eoiStart));
    withInterScanMetadata.set(marker, eoiStart);
    withInterScanMetadata.set(base.slice(eoiStart), eoiStart + marker.length);
    const result = await stripImageMetadata(withInterScanMetadata, 'inter-scan.jpg');
    expect(result.error).toBeUndefined();
    expect(new TextDecoder('latin1').decode(result.cleanedBuffer)).not.toContain('ABCD');
  });

  it('rejects unknown PNG chunks rather than returning them as cleaned output', async () => {
    const base = createSamplePngWithMetadata();
    const unknownChunk = new Uint8Array([0, 0, 0, 0, 0x76, 0x70, 0x41, 0x67, 0, 0, 0, 0]); // vpAg
    const withUnknownChunk = new Uint8Array(base.length + unknownChunk.length);
    withUnknownChunk.set(base.slice(0, 33));
    withUnknownChunk.set(unknownChunk, 33);
    withUnknownChunk.set(base.slice(33), 33 + unknownChunk.length);
    const result = await stripImageMetadata(repairPngCrcs(withUnknownChunk), 'unknown-chunk.png');
    expect(result.error).toContain('unrecognized ancillary chunk');
    expect(result.cleanedBuffer).toEqual(repairPngCrcs(withUnknownChunk));
  });
});

describe('Unsupported formats and JPEG orientation', () => {
  it('refuses to mark TIFF/RAW and pass-through formats as cleaned', async () => {
    const unsupportedBuffers = [
      new Uint8Array([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]),
      new Uint8Array([0x42, 0x4D, 0x00, 0x00]),
      new Uint8Array([0xFF, 0x0A, 0x00, 0x00]),
      new Uint8Array([0x00, 0x00, 0x00, 0x0C, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A]),
    ];
    for (const [index, input] of unsupportedBuffers.entries()) {
      const result = await stripImageMetadata(input, `unsupported-${index}.bin`);
      expect(result.error).toBeTruthy();
      expect(result.pixelIdentical).toBe(false);
      expect(result.cleanedBuffer).toBe(input);
    }
  });

  it('preserves only the EXIF orientation tag when configured to keep orientation', async () => {
    const base = createSampleJpegWithMetadata();
    const payload = [
      0x45,0x78,0x69,0x66,0,0, 0x49,0x49,0x2A,0,0x08,0,0,0,
      0x01,0, 0x12,0x01,0x03,0,0x01,0,0,0,0x06,0,0,0, 0,0,0,0,
    ];
    const segmentLength = payload.length + 2;
    const orientationSegment = new Uint8Array([0xFF,0xE1,(segmentLength >>> 8) & 0xFF,segmentLength & 0xFF,...payload]);
    const withOrientation = new Uint8Array([...base.slice(0, 2), ...orientationSegment, ...base.slice(2)]);
    const result = await stripImageMetadata(withOrientation, 'portrait.jpg', { keepOrientation: true });
    expect(result.error).toBeUndefined();
    const text = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(text.includes('Sony')).toBe(false);
    expect(text.includes('A7IV')).toBe(false);
    expect(text.includes('Exif\u0000\u0000')).toBe(true);
    expect(result.removedSegments.some((part) => part.includes('orientation tag preserved'))).toBe(true);
  });

  it('rejects truncated PNG data instead of returning a partial success', async () => {
    const truncated = createSamplePngWithMetadata().slice(0, 24);
    const result = await stripImageMetadata(truncated, 'truncated.png');
    expect(result.error).toBeTruthy();
    expect(result.pixelIdentical).toBe(false);
  });
});

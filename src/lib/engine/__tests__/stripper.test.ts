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
    expect(result.pixelIdentical).toBe(false);
    expect(result.cleanedSize).toBeLessThan(result.originalSize);
    expect(result.bytesSaved).toBeGreaterThan(0);
    expect(result.removedSegments.some((s) => s.includes('APP1'))).toBe(true);
    expect(result.removedSegments.some((s) => s.includes('COM'))).toBe(true);
    expect(result.removedSegments.some((s) => s.includes('APP0'))).toBe(true);

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
    expect(result.pixelIdentical).toBe(false);

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
    expect(result.pixelIdentical).toBe(false);
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

  it('strips unrecognized WebP extension chunks as metadata', async () => {
    const base = createSampleWebpWithMetadata();
    const payload = new TextEncoder().encode('private C2PA payload');
    const extra = new Uint8Array(8 + payload.length + (payload.length % 2));
    extra.set(new TextEncoder().encode('C2PA'), 0);
    new DataView(extra.buffer).setUint32(4, payload.length, true);
    extra.set(payload, 8);
    const input = new Uint8Array(base.length + extra.length);
    input.set(base);
    input.set(extra, base.length);
    new DataView(input.buffer).setUint32(4, input.length - 8, true);
    const result = await stripImageMetadata(input, 'vendor-metadata.webp');
    expect(result.error).toBeUndefined();
    expect(result.removedSegments.some((part) => part.includes('C2PA'))).toBe(true);
    expect(new TextDecoder('latin1').decode(result.cleanedBuffer)).not.toContain('private C2PA payload');
  });

  it('strips unknown GIF application metadata while preserving raster content', async () => {
    const encode = new TextEncoder();
    const gif = new Uint8Array([
      ...encode.encode('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0,
      0, 0, 0, 255, 255, 255,
      0x21, 0xff, 0x0b, ...encode.encode('UNKNOWNAPP1'), 0x05, ...encode.encode('C2PA!'), 0,
      0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0x02, 0x02, 0x44, 0x01, 0, 0x3b,
    ]);
    const result = await stripImageMetadata(gif, 'vendor-metadata.gif');
    expect(result.error).toBeUndefined();
    expect(result.removedSegments.some((part) => part.includes('UNKNOWNAPP1'))).toBe(true);
    expect(new TextDecoder('latin1').decode(result.cleanedBuffer)).not.toContain('UNKNOWNAPP1');
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

  it('strips C2PA caBX provenance and unknown ancillary PNG chunks', async () => {
    const base = createSamplePngWithMetadata();
    const makeChunk = (type: string, data: string) => {
      const payload = new TextEncoder().encode(data);
      const chunk = new Uint8Array(12 + payload.length);
      new DataView(chunk.buffer).setUint32(0, payload.length, false);
      chunk.set(new TextEncoder().encode(type), 4);
      chunk.set(payload, 8);
      return chunk;
    };
    const caBX = makeChunk('caBX', 'C2PA private provenance payload');
    const unknown = makeChunk('vpAg', 'vendor-private-data');
    const addAfterIhdr = (input: Uint8Array, inserted: Uint8Array) => {
      const output = new Uint8Array(input.length + inserted.length);
      output.set(input.slice(0, 33));
      output.set(inserted, 33);
      output.set(input.slice(33), 33 + inserted.length);
      return repairPngCrcs(output);
    };
    const withCaBX = addAfterIhdr(base, caBX);
    const input = addAfterIhdr(withCaBX, unknown);
    const result = await stripImageMetadata(input, 'c2pa.png');
    expect(result.error).toBeUndefined();
    expect(result.removedSegments.some((part) => part.includes('caBX'))).toBe(true);
    expect(result.removedSegments.some((part) => part.includes('vpAg'))).toBe(true);
    const text = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(text).not.toContain('caBX');
    expect(text).not.toContain('C2PA private provenance payload');
    expect(text).not.toContain('vendor-private-data');
  });

  it('rejects unknown critical PNG chunks because they may be required to decode pixels', async () => {
    const base = createSamplePngWithMetadata();
    const criticalChunk = new Uint8Array([0, 0, 0, 0, 0x56, 0x70, 0x41, 0x67, 0, 0, 0, 0]); // VpAg: uppercase first byte = critical
    const withUnknownChunk = new Uint8Array(base.length + criticalChunk.length);
    withUnknownChunk.set(base.slice(0, 33));
    withUnknownChunk.set(criticalChunk, 33);
    withUnknownChunk.set(base.slice(33), 33 + criticalChunk.length);
    const input = repairPngCrcs(withUnknownChunk);
    const result = await stripImageMetadata(input, 'unknown-critical.png');
    expect(result.error).toContain('unrecognized critical chunk');
    expect(result.cleanedBuffer).toEqual(input);
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

describe('Multi-Format Metadata Stripping (Documents, Video, Audio)', () => {
  it('strips PDF Document Info, Catalog Metadata, and Trailer ID while preserving PDF header', async () => {
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Metadata 4 0 R >>
endobj
4 0 obj
<< /Type /Metadata /Subtype /XML >>
stream
<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta>SecretXMPAuthor</x:xmpmeta><?xpacket end="w"?>
endstream
endobj
5 0 obj
<< /Author (John Doe) /Title (Confidential Doc) /Creator (LibreOffice) >>
endobj
trailer
<< /Size 6 /Root 1 0 R /Info 5 0 R /ID [ <1122334455667788> <1122334455667788> ] >>
%%EOF`;
    const input = new TextEncoder().encode(pdfContent);
    const result = await stripImageMetadata(input, 'report.pdf');
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('pdf');
    const cleanedStr = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(cleanedStr).not.toContain('John Doe');
    expect(cleanedStr).not.toContain('Confidential Doc');
    expect(cleanedStr).not.toContain('SecretXMPAuthor');
    expect(cleanedStr).not.toContain('1122334455667788');
    expect(cleanedStr).not.toContain('/Info 5 0 R');
  });

  it('strips DOCX docProps folder and sanitizes WordprocessingML author/rsid attributes', async () => {
    const { zipSync } = await import('fflate');
    const enc = new TextEncoder();
    const docxBytes = zipSync({
      '[Content_Types].xml': enc.encode('<?xml version="1.0"?><Types></Types>'),
      'docProps/core.xml': enc.encode('<cp:coreProperties><dc:creator>Alice Secret</dc:creator></cp:coreProperties>'),
      'docProps/app.xml': enc.encode('<Properties><Company>SecretCorp</Company></Properties>'),
      'word/document.xml': enc.encode(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:ins w:id="1" w:author="Alice Secret" w:date="2025-01-01T00:00:00Z" w:rsidR="00A1B2C3"><w:t>Hello World</w:t></w:ins></w:body></w:document>'
      ),
      'word/settings.xml': enc.encode('<w:settings><w:rsids><w:rsidRoot w:val="00A1B2C3"/></w:rsids></w:settings>'),
    });

    const result = await stripImageMetadata(new Uint8Array(docxBytes), 'contract.docx');
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('docx');

    const { unzipSync } = await import('fflate');
    const unzipped = unzipSync(result.cleanedBuffer);
    expect(unzipped['docProps/core.xml']).toBeUndefined();
    expect(unzipped['docProps/app.xml']).toBeUndefined();
    const docXml = new TextDecoder().decode(unzipped['word/document.xml']);
    expect(docXml).toContain('Hello World');
    expect(docXml).not.toContain('Alice Secret');
    expect(docXml).not.toContain('00A1B2C3');
    expect(docXml).not.toContain('2025-01-01T00:00:00Z');
  });

  it('strips MP4/MOV udta/meta boxes and zeroes creation timestamps in mvhd', async () => {
    const enc = new TextEncoder();
    const makeBox = (type: string, payload: Uint8Array) => {
      const box = new Uint8Array(8 + payload.length);
      new DataView(box.buffer).setUint32(0, box.length, false);
      box.set(enc.encode(type), 4);
      box.set(payload, 8);
      return box;
    };

    const ftyp = makeBox('ftyp', enc.encode('isom\x00\x00\x02\x00isomiso2mp41'));
    // mvhd version 0: 4-byte version/flags + 4-byte creation + 4-byte modification + 16 bytes rest
    const mvhdPayload = new Uint8Array(28);
    new DataView(mvhdPayload.buffer).setUint32(4, 0xDEADBEEF, false); // creation_time
    new DataView(mvhdPayload.buffer).setUint32(8, 0xCAFEBABE, false); // modification_time
    const mvhd = makeBox('mvhd', mvhdPayload);
    const udta = makeBox('udta', enc.encode('+37.7749-122.4194/ Secret GPS Tag'));
    const moovPayload = new Uint8Array(mvhd.length + udta.length);
    moovPayload.set(mvhd, 0);
    moovPayload.set(udta, mvhd.length);
    const moov = makeBox('moov', moovPayload);
    const mdat = makeBox('mdat', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

    const mp4 = new Uint8Array(ftyp.length + moov.length + mdat.length);
    mp4.set(ftyp, 0);
    mp4.set(moov, ftyp.length);
    mp4.set(mdat, ftyp.length + moov.length);

    const result = await stripImageMetadata(mp4, 'clip.mp4');
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('mp4');
    const cleanedStr = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(cleanedStr).not.toContain('Secret GPS Tag');
    expect(cleanedStr).not.toContain('udta');
    // Check that mvhd creation/modification timestamps were zeroed
    const mvhdStart = ftyp.length + 8 + 8;
    const view = new DataView(result.cleanedBuffer.buffer, result.cleanedBuffer.byteOffset + mvhdStart, 12);
    expect(view.getUint32(4, false)).toBe(0);
    expect(view.getUint32(8, false)).toBe(0);
  });

  it('strips MP3 leading ID3v2 and trailing ID3v1 tags while preserving MPEG audio frames', async () => {
    const enc = new TextEncoder();
    const id3v2Payload = enc.encode('TIT2\x00\x00\x00\x0b\x00\x00\x00SecretSong');
    const id3v2 = new Uint8Array(10 + id3v2Payload.length);
    id3v2.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, id3v2Payload.length]);
    id3v2.set(id3v2Payload, 10);

    const audioFrames = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02, 0x03]);
    const id3v1 = new Uint8Array(128);
    id3v1.set(enc.encode('TAGSecretTitle                  SecretArtist'), 0);

    const mp3 = new Uint8Array(id3v2.length + audioFrames.length + id3v1.length);
    mp3.set(id3v2, 0);
    mp3.set(audioFrames, id3v2.length);
    mp3.set(id3v1, id3v2.length + audioFrames.length);

    const result = await stripImageMetadata(mp3, 'voice.mp3');
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('mp3');
    const cleanedStr = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(cleanedStr).not.toContain('SecretSong');
    expect(cleanedStr).not.toContain('SecretArtist');
  });

  it('strips FLAC Vorbis comments and Picture blocks while keeping STREAMINFO and updating last-block flag', async () => {
    const enc = new TextEncoder();
    // fLaC + STREAMINFO (type 0, not last, len 34) + VORBIS_COMMENT (type 4, last=true 0x84, len 12) + audio
    const streamInfo = new Uint8Array(4 + 34);
    streamInfo[0] = 0x00; // not last, type 0 (STREAMINFO)
    streamInfo[3] = 34;

    const vorbisPayload = enc.encode('ARTIST=Alice');
    const vorbisBlock = new Uint8Array(4 + vorbisPayload.length);
    vorbisBlock[0] = 0x84; // last=1, type=4 (VORBIS_COMMENT)
    vorbisBlock[3] = vorbisPayload.length;
    vorbisBlock.set(vorbisPayload, 4);

    const audioFrames = new Uint8Array([0xff, 0xf8, 0x69, 0x18, 0x00]);
    const flac = new Uint8Array(4 + streamInfo.length + vorbisBlock.length + audioFrames.length);
    flac.set(enc.encode('fLaC'), 0);
    flac.set(streamInfo, 4);
    flac.set(vorbisBlock, 4 + streamInfo.length);
    flac.set(audioFrames, 4 + streamInfo.length + vorbisBlock.length);

    const result = await stripImageMetadata(flac, 'track.flac');
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('flac');
    expect(result.cleanedBuffer[4] & 0x80).toBe(0x80); // STREAMINFO now marked as last metadata block
    const cleanedStr = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(cleanedStr).not.toContain('ARTIST=Alice');
  });

  it('strips WAV LIST/INFO, bext, and id3 chunks while preserving fmt and data chunks', async () => {
    const enc = new TextEncoder();
    const makeChunk = (id: string, payload: Uint8Array) => {
      const pad = payload.length % 2;
      const chunk = new Uint8Array(8 + payload.length + pad);
      chunk.set(enc.encode(id), 0);
      new DataView(chunk.buffer).setUint32(4, payload.length, true);
      chunk.set(payload, 8);
      return chunk;
    };

    const fmt = makeChunk('fmt ', new Uint8Array(16));
    const listInfo = makeChunk('LIST', enc.encode('INFOIART\x06\x00\x00\x00Alice\x00'));
    const data = makeChunk('data', new Uint8Array([0x10, 0x20, 0x30, 0x40]));

    const bodyLen = 4 + fmt.length + listInfo.length + data.length;
    const wav = new Uint8Array(8 + bodyLen);
    wav.set(enc.encode('RIFF'), 0);
    new DataView(wav.buffer).setUint32(4, bodyLen, true);
    wav.set(enc.encode('WAVE'), 8);
    wav.set(fmt, 12);
    wav.set(listInfo, 12 + fmt.length);
    wav.set(data, 12 + fmt.length + listInfo.length);

    const result = await stripImageMetadata(wav, 'sample.wav');
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('wav');
    const cleanedStr = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(cleanedStr).not.toContain('Alice');
    expect(cleanedStr).toContain('fmt ');
    expect(cleanedStr).toContain('data');
  });

  it('strips Matroska / WebM EBML Tags, Chapters, Attachments, WritingApp, MuxingApp, and TrackName', async () => {
    const enc = new TextEncoder();
    const writingApp = enc.encode('SecretMuxerApp');
    const muxingApp = enc.encode('SecretLibav');
    const trackName = enc.encode('CameraMicTrack');
    const tagPayload = enc.encode('CLEANSHOT_TEST_TAG');

    // EBML Header (0x1A45DFA3, size 4 -> 0x84, payload 'webm')
    const ebmlHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x84, ...enc.encode('webm')]);

    // Info (0x1549A966): WritingApp (0x5741) + MuxingApp (0x4D80)
    const infoBody = new Uint8Array([
      0x57, 0x41, 0x80 | writingApp.length, ...writingApp,
      0x4d, 0x80, 0x80 | muxingApp.length, ...muxingApp,
    ]);
    const infoEl = new Uint8Array([0x15, 0x49, 0xa9, 0x66, 0x80 | infoBody.length, ...infoBody]);

    // Tracks (0x1654AE6B) -> TrackEntry (0xAE) -> TrackName (0x536E)
    const trackEntryBody = new Uint8Array([0x53, 0x6e, 0x80 | trackName.length, ...trackName]);
    const trackEntry = new Uint8Array([0xae, 0x80 | trackEntryBody.length, ...trackEntryBody]);
    const tracksEl = new Uint8Array([0x16, 0x54, 0xae, 0x6b, 0x80 | trackEntry.length, ...trackEntry]);

    // Tags (0x1254C367)
    const tagsEl = new Uint8Array([0x12, 0x54, 0xc3, 0x67, 0x80 | tagPayload.length, ...tagPayload]);

    const segBody = new Uint8Array(infoEl.length + tracksEl.length + tagsEl.length);
    segBody.set(infoEl, 0);
    segBody.set(tracksEl, infoEl.length);
    segBody.set(tagsEl, infoEl.length + tracksEl.length);

    // Segment (0x18538067)
    const segment = new Uint8Array([0x18, 0x53, 0x80, 0x67, 0x80 | segBody.length, ...segBody]);
    const webm = new Uint8Array(ebmlHeader.length + segment.length);
    webm.set(ebmlHeader, 0);
    webm.set(segment, ebmlHeader.length);

    const result = await stripImageMetadata(webm, 'recording.webm');
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('webm');
    const cleanedStr = new TextDecoder('latin1').decode(result.cleanedBuffer);
    expect(cleanedStr).not.toContain('SecretMuxerApp');
    expect(cleanedStr).not.toContain('SecretLibav');
    expect(cleanedStr).not.toContain('CameraMicTrack');
    expect(cleanedStr).not.toContain('CLEANSHOT_TEST_TAG');
  });
});

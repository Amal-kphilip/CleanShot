import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { describe, it, expect } from 'vitest';
import { stripImageMetadata } from '../stripper';
import { inspectPngAnimation, inspectWebpAnimation } from '../imageAnimation';
import { stripIsobmffBoxes } from '../isobmff';
import { cleanProcessedImageBlobWithAudit } from '../../tools/geminiWatermark';
import { cleanProcessedVideoBlobWithAudit } from '../../tools/geminiVideoWatermark';
import {
  classifyExifValidationSummary,
  findTechnicalValue,
  FixtureOverrides,
  getPolicy,
  isSupportedExtension,
  matchingTags,
  SupportedExtension,
  technicalValuesEqual,
} from './metadataPolicies';

const ROOT = path.resolve(__dirname, '../../../..');
const SYNTHETIC_FIXTURES_ROOT = path.join(
  ROOT,
  'tests',
  'privacy',
  'fixtures',
  'synthetic',
);
const WASM_PATH = path.join(ROOT, 'public', 'zeroperl.wasm');

type MetadataSnapshot = Record<string, unknown>;

let cachedWasmBytes: Uint8Array | null = null;
function getWasmBytes(): Uint8Array {
  if (!cachedWasmBytes) {
    cachedWasmBytes = new Uint8Array(fs.readFileSync(WASM_PATH));
  }
  return cachedWasmBytes;
}

async function runExifToolSnapshot(
  bytes: Uint8Array,
  filename: string,
  args: string[],
): Promise<MetadataSnapshot> {
  const { parseMetadata } = await import('@lilohuang/exiftool');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const file = new File([copy.buffer], filename);
  const wasmBytes = getWasmBytes();

  const hadWindow = 'window' in globalThis;
  const hadDocument = 'document' in globalThis;
  if (!hadWindow) {
    (globalThis as Record<string, unknown>).window = {};
  }
  if (!hadDocument) {
    (globalThis as Record<string, unknown>).document = {};
  }

  let res: {
    success: boolean;
    data?: MetadataSnapshot[];
    error?: string;
  };
  try {
    res = (await parseMetadata(file, {
      args,
      fetch: async () =>
        new Response(wasmBytes.slice().buffer, {
          status: 200,
          headers: { 'Content-Type': 'application/wasm' },
        }),
      transform: (out: string) => JSON.parse(out) as MetadataSnapshot[],
    })) as {
      success: boolean;
      data?: MetadataSnapshot[];
      error?: string;
    };
  } finally {
    if (!hadWindow) {
      delete (globalThis as Record<string, unknown>).window;
    }
    if (!hadDocument) {
      delete (globalThis as Record<string, unknown>).document;
    }
  }

  if (!res.success || !Array.isArray(res.data) || !res.data[0]) {
    throw new Error(`ExifTool failed for ${filename}: ${res.error || 'empty output'}`);
  }
  const snapshot = { ...res.data[0] };
  for (const key of Object.keys(snapshot)) {
    if (key === 'SourceFile' || key.endsWith(':SourceFile')) {
      delete snapshot[key];
    }
  }

  // ZeroPerl's WASM build does not include native C Compress::Raw::Zlib /
  // Archive::Zip, so ExifTool's ZIP.pm stops with "Install Archive::Zip to
  // decode compressed ZIP information" on .docx containers. Supplement the
  // WASM ExifTool snapshot with the exact OOXML package tags that ExifTool's
  // ProcessDOCX extracts from [Content_Types].xml and docProps/*.xml.
  if (
    filename.toLowerCase().endsWith('.docx') &&
    String(snapshot['ExifTool:Warning'] ?? '').includes('Archive::Zip')
  ) {
    const zip = await JSZip.loadAsync(bytes);
    if (zip.file('[Content_Types].xml') && zip.file('word/document.xml')) {
      snapshot['File:FileType'] = 'DOCX';
      snapshot['File:FileTypeExtension'] = 'docx';
      snapshot['File:MIMEType'] =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    const xmlTagMap: Record<string, string> = {
      'dc:title': 'XML:Title',
      'dc:subject': 'XML:Subject',
      'dc:creator': 'XML:Creator',
      'cp:keywords': 'XML:Keywords',
      'dc:description': 'XML:Description',
      'cp:lastModifiedBy': 'XML:LastModifiedBy',
      'cp:revision': 'XML:RevisionNumber',
      'dcterms:created': 'XML:CreateDate',
      'dcterms:modified': 'XML:ModifyDate',
      'cp:category': 'XML:Category',
      Application: 'XML:Application',
      AppVersion: 'XML:AppVersion',
      Company: 'XML:Company',
      Manager: 'XML:Manager',
      Template: 'XML:Template',
    };
    for (const entryPath of Object.keys(zip.files)) {
      const entry = zip.files[entryPath];
      if (entry.dir || !/^docProps\/.+\.xml$/i.test(entryPath)) continue;
      const xml = await entry.async('string');
      for (const [xmlElem, exifKey] of Object.entries(xmlTagMap)) {
        const escaped = xmlElem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const m = xml.match(
          new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'),
        );
        if (m && m[1].trim().length > 0) {
          snapshot[exifKey] = m[1].trim();
        }
      }
      const propMatches = xml.matchAll(
        /<property\b[^>]*\bname=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/property>/gi,
      );
      for (const pm of propMatches) {
        const propName = pm[2].replace(/[^A-Za-z0-9_]/g, '');
        const valMatch = pm[3].match(/<[^>]+>([\s\S]*?)<\/[^>]+>/);
        if (propName && valMatch && valMatch[1].trim()) {
          snapshot[`XML:${propName}`] = valMatch[1].trim();
        }
      }
    }
  }

  return snapshot;
}

const EXIFTOOL_FULL_ARGS = [
  '-j',
  '-G1:4',
  '-s',
  '-n',
  '-api',
  'RequestAll=3',
  '-ee3',
  '-a',
];

function discoverSyntheticFixtures(): Array<{
  id: string;
  filePath: string;
  filename: string;
  extension: SupportedExtension;
  overrides: FixtureOverrides;
}> {
  const found: Array<{
    id: string;
    filePath: string;
    filename: string;
    extension: SupportedExtension;
    overrides: FixtureOverrides;
  }> = [];

  for (const dirEntry of fs.readdirSync(SYNTHETIC_FIXTURES_ROOT, {
    withFileTypes: true,
  })) {
    if (!dirEntry.isDirectory()) continue;
    const subDir = path.join(SYNTHETIC_FIXTURES_ROOT, dirEntry.name);
    for (const fileEntry of fs.readdirSync(subDir, { withFileTypes: true })) {
      if (
        !fileEntry.isFile() ||
        fileEntry.name.startsWith('.') ||
        fileEntry.name.endsWith('.privacy.json')
      ) {
        continue;
      }
      const fullPath = path.join(subDir, fileEntry.name);
      const ext = path.extname(fileEntry.name).slice(1).toLowerCase();
      if (!isSupportedExtension(ext)) continue;
      const sidecarPath = `${fullPath}.privacy.json`;
      const overrides: FixtureOverrides = fs.existsSync(sidecarPath)
        ? (JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) as FixtureOverrides)
        : {};
      found.push({
        id: `${dirEntry.name}/${fileEntry.name}`,
        filePath: fullPath,
        filename: fileEntry.name,
        extension: ext,
        overrides,
      });
    }
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}

function extractAutomaticSentinels(bytes: Buffer): string[] {
  const ascii = bytes.toString('latin1');
  const utf16 = bytes.toString('utf16le');
  const pattern = /CLEANSHOT_TEST_[A-Z0-9_.-]+/g;
  return [
    ...new Set([
      ...(ascii.match(pattern) ?? []),
      ...(utf16.match(pattern) ?? []),
    ]),
  ];
}

function bufferContainsSentinel(bytes: Buffer, sentinel: string): boolean {
  return (
    bytes.includes(Buffer.from(sentinel, 'utf8')) ||
    bytes.includes(Buffer.from(sentinel, 'utf16le'))
  );
}

describe('CleanShot Direct Algorithm & Structural Unit Tests', () => {
  it('validates APNG & animated WebP detection and fail-closed checks', () => {
    const ascii = (v: string) => new TextEncoder().encode(v);
    const concat = (...parts: Uint8Array[]) => {
      const res = new Uint8Array(parts.reduce((t, p) => t + p.length, 0));
      let off = 0;
      for (const p of parts) {
        res.set(p, off);
        off += p.length;
      }
      return res;
    };
    const uint32Be = (v: number) => {
      const r = new Uint8Array(4);
      new DataView(r.buffer).setUint32(0, v);
      return r;
    };
    const uint32Le = (v: number) => {
      const r = new Uint8Array(4);
      new DataView(r.buffer).setUint32(0, v, true);
      return r;
    };
    const pngChunk = (type: string, payload = new Uint8Array()) =>
      concat(uint32Be(payload.length), ascii(type), payload, new Uint8Array(4));
    const png = (...chunks: Uint8Array[]) =>
      concat(
        Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
        pngChunk('IHDR', new Uint8Array(13)),
        ...chunks,
        pngChunk('IEND'),
      );
    const webpChunk = (type: string, payload: Uint8Array) =>
      concat(
        ascii(type),
        uint32Le(payload.length),
        payload,
        payload.length & 1 ? Uint8Array.of(0) : new Uint8Array(),
      );
    const webp = (...chunks: Uint8Array[]) => {
      const body = concat(ascii('WEBP'), ...chunks);
      return concat(ascii('RIFF'), uint32Le(body.length), body);
    };

    expect(inspectPngAnimation(png(pngChunk('IDAT')))).toBe('static');
    expect(
      inspectPngAnimation(png(pngChunk('acTL', new Uint8Array(8)), pngChunk('IDAT'))),
    ).toBe('animated');
    expect(
      inspectPngAnimation(png(pngChunk('fcTL', new Uint8Array(26)), pngChunk('IDAT'))),
    ).toBe('animated');
    expect(inspectPngAnimation(png(pngChunk('IDAT')).subarray(0, 20))).toBe(
      'invalid',
    );

    expect(inspectWebpAnimation(webp(webpChunk('VP8 ', new Uint8Array(4))))).toBe(
      'static',
    );
    expect(inspectWebpAnimation(webp(webpChunk('ANIM', new Uint8Array(6))))).toBe(
      'animated',
    );
    expect(inspectWebpAnimation(webp(webpChunk('ANMF', new Uint8Array(16))))).toBe(
      'animated',
    );
    const extendedHeader = new Uint8Array(10);
    extendedHeader[0] = 0x02;
    expect(inspectWebpAnimation(webp(webpChunk('VP8X', extendedHeader)))).toBe(
      'animated',
    );
    const malformedWebp = webp(webpChunk('VP8 ', new Uint8Array(4)));
    malformedWebp[4] = 0;
    expect(inspectWebpAnimation(malformedWebp)).toBe('invalid');
  });

  it('rejects animated PNG and animated WebP in stripImageMetadata instead of flattening frames', async () => {
    const ascii = (v: string) => new TextEncoder().encode(v);
    const uint32Be = (v: number) => {
      const r = new Uint8Array(4);
      new DataView(r.buffer).setUint32(0, v);
      return r;
    };
    const uint32Le = (v: number) => {
      const r = new Uint8Array(4);
      new DataView(r.buffer).setUint32(0, v, true);
      return r;
    };
    const concat = (...parts: Uint8Array[]) => {
      const res = new Uint8Array(parts.reduce((t, p) => t + p.length, 0));
      let off = 0;
      for (const p of parts) {
        res.set(p, off);
        off += p.length;
      }
      return res;
    };
    const pngChunk = (type: string, payload = new Uint8Array()) =>
      concat(uint32Be(payload.length), ascii(type), payload, new Uint8Array(4));
    const apng = concat(
      Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      pngChunk('IHDR', new Uint8Array(13)),
      pngChunk('acTL', new Uint8Array(8)),
      pngChunk('IDAT', new Uint8Array(4)),
      pngChunk('IEND'),
    );
    const apngRes = await stripImageMetadata(apng, 'animated.png');
    expect(apngRes.error).toMatch(/Animated PNG\/WebP/i);

    const webpChunk = (type: string, payload: Uint8Array) =>
      concat(
        ascii(type),
        uint32Le(payload.length),
        payload,
        payload.length & 1 ? Uint8Array.of(0) : new Uint8Array(),
      );
    const animWebpBody = concat(
      ascii('WEBP'),
      webpChunk('ANIM', new Uint8Array(6)),
    );
    const animWebp = concat(
      ascii('RIFF'),
      uint32Le(animWebpBody.length),
      animWebpBody,
    );
    const webpRes = await stripImageMetadata(animWebp, 'animated.webp');
    expect(webpRes.error).toMatch(/Animated PNG\/WebP/i);
  });

  it('validates ISOBMFF fragmented metadata track removal and fail-closed checks', () => {
    const uint32 = (v: number) => {
      const r = new Uint8Array(4);
      new DataView(r.buffer).setUint32(0, v);
      return r;
    };
    const ascii = (v: string) => new TextEncoder().encode(v);
    const concat = (...parts: Uint8Array[]) => {
      const res = new Uint8Array(parts.reduce((t, p) => t + p.length, 0));
      let off = 0;
      for (const p of parts) {
        res.set(p, off);
        off += p.length;
      }
      return res;
    };
    const box = (type: string, ...payloads: Uint8Array[]) => {
      const payload = concat(...payloads);
      return concat(uint32(8 + payload.length), ascii(type), payload);
    };
    const fullBox = (type: string, flags: number, ...payloads: Uint8Array[]) =>
      box(
        type,
        Uint8Array.of(0, (flags >>> 16) & 0xff, (flags >>> 8) & 0xff, flags & 0xff),
        ...payloads,
      );

    const trackId = 7;
    const sentinel = ascii('CLEANSHOT_TEST_FRAGMENT_SAMPLE');
    const emptySampleTable = box(
      'stbl',
      fullBox('stsz', 0, uint32(0), uint32(0)),
      fullBox('stco', 0, uint32(0)),
    );
    const metadataTrack = box(
      'trak',
      fullBox('tkhd', 0, uint32(0), uint32(0), uint32(trackId), uint32(0)),
      box(
        'mdia',
        fullBox('mdhd', 0, uint32(0), uint32(0)),
        fullBox('hdlr', 0, uint32(0), ascii('meta')),
        box('minf', emptySampleTable),
      ),
    );
    const trex = fullBox(
      'trex',
      0,
      uint32(trackId),
      uint32(1),
      uint32(1),
      uint32(sentinel.length),
      uint32(0),
    );
    const moov = box('moov', metadataTrack, box('mvex', trex));
    const tfhd = fullBox('tfhd', 0x020000, uint32(trackId));
    const trunPlaceholder = fullBox('trun', 0x000001, uint32(1), uint32(0));
    const moofPlaceholder = box('moof', box('traf', tfhd, trunPlaceholder));
    const dataOffset = moofPlaceholder.length + 8;
    const trun = fullBox('trun', 0x000001, uint32(1), uint32(dataOffset));
    const moof = box('moof', box('traf', tfhd, trun));
    const input = concat(
      box('ftyp', ascii('isom'), uint32(0), ascii('isom')),
      moov,
      moof,
      box('mdat', sentinel),
    );

    const cleaned = stripIsobmffBoxes(input);
    expect(cleaned).not.toBeNull();
    expect(cleaned?.length).toBe(input.length);
    expect(new TextDecoder().decode(cleaned!)).not.toContain(
      'CLEANSHOT_TEST_FRAGMENT_SAMPLE',
    );

    // Ambiguous multi-track implicit fragment base fails closed
    const metadataTraf = box(
      'traf',
      fullBox('tfhd', 0, uint32(trackId)),
      fullBox('trun', 0, uint32(1)),
    );
    const otherTraf = box(
      'traf',
      fullBox('tfhd', 0x020000, uint32(1)),
      fullBox('trun', 0x000001, uint32(0), uint32(0)),
    );
    const ambiguous = concat(
      box('ftyp', ascii('isom')),
      moov,
      box('moof', otherTraf, metadataTraf),
      box('mdat', sentinel),
    );
    expect(stripIsobmffBoxes(ambiguous)).toBeNull();
  });

  it('validates duration and ExifTool validation summary helpers', () => {
    expect(
      technicalValuesEqual('00:00:13.346000000', 13.346, 'Duration', 'mkv'),
    ).toBe(true);
    expect(
      technicalValuesEqual('00:00:30.543000000', 30.543, 'Duration', 'webm'),
    ).toBe(true);
    expect(technicalValuesEqual('01:02:03.5', 3723.5, 'Duration', 'mkv')).toBe(
      true,
    );
    expect(technicalValuesEqual('00:00:13.346', 14, 'Duration', 'mkv')).toBe(
      false,
    );

    expect(classifyExifValidationSummary('OK')).toBe('ok');
    expect(classifyExifValidationSummary('6 Warnings')).toBe('warning');
    expect(classifyExifValidationSummary('1 Warning')).toBe('warning');
    expect(classifyExifValidationSummary('1 Error, 2 Warnings')).toBe('error');
  });
});

describe('CleanShot Full Synthetic Fixture Suite — ExifTool, Sentinels, Integrity & Workflow Parity', () => {
  const fixtures = discoverSyntheticFixtures();

  it('discovers all 15 CleanShot synthetic fixtures across all supported formats', () => {
    expect(fixtures.length).toBe(15);
  });

  for (const fixture of fixtures) {
    it(
      `cleans ${fixture.id} (${fixture.extension.toUpperCase()}) with 0 forbidden ExifTool tags, 0 raw sentinels, and preserved technical properties`,
      async () => {
        const rawBuffer = fs.readFileSync(fixture.filePath);
        const inputBytes = new Uint8Array(rawBuffer);
        const policy = getPolicy(fixture.extension);
        const forbiddenPatterns = [
          ...policy.forbiddenAfter,
          ...(fixture.overrides.forbiddenAfter ?? []),
        ];
        const requiredBefore = fixture.overrides.requiredBefore ?? [];
        const preserveTags = fixture.overrides.preserveTags ?? policy.preserveTags;

        // 1. ExifTool BEFORE check
        const beforeMeta = await runExifToolSnapshot(
          inputBytes,
          fixture.filename,
          EXIFTOOL_FULL_ARGS,
        );
        for (const reqPattern of requiredBefore) {
          expect(
            matchingTags(beforeMeta, [reqPattern]).length,
            `Fixture ${fixture.id} should contain required metadata ${reqPattern} before cleaning`,
          ).toBeGreaterThan(0);
        }

        // 2. Run CleanShot canonical metadata cleaner (Workflow A)
        const stripRes = await stripImageMetadata(inputBytes, fixture.filename);
        expect(stripRes.error, `Cleaning failed for ${fixture.id}: ${stripRes.error}`).toBeUndefined();
        expect(stripRes.cleanedBuffer.byteLength).toBeGreaterThan(0);

        // 3. Raw binary sentinel check (UTF-8/Latin1 & UTF-16LE)
        const afterBuffer = Buffer.from(
          stripRes.cleanedBuffer.buffer,
          stripRes.cleanedBuffer.byteOffset,
          stripRes.cleanedBuffer.byteLength,
        );
        const sentinels = [
          ...new Set([
            ...(fixture.overrides.sentinels ?? []),
            ...extractAutomaticSentinels(rawBuffer),
          ]),
        ];
        expect(sentinels.length).toBeGreaterThan(0);
        const survivingSentinels = sentinels.filter((s) =>
          bufferContainsSentinel(afterBuffer, s),
        );
        expect(
          survivingSentinels,
          `Raw sentinels survived in ${fixture.id}: ${survivingSentinels.join(', ')}`,
        ).toEqual([]);

        // 4. ExifTool AFTER check: forbidden tags must be 0, technical preserveTags must match
        const afterMeta = await runExifToolSnapshot(
          stripRes.cleanedBuffer,
          fixture.filename,
          EXIFTOOL_FULL_ARGS,
        );
        const remainingForbidden = matchingTags(afterMeta, forbiddenPatterns);
        expect(
          remainingForbidden,
          `Forbidden ExifTool tags remained in ${fixture.id}: ${remainingForbidden.join(', ')}`,
        ).toEqual([]);

        for (const tag of preserveTags) {
          const beforeVal = findTechnicalValue(beforeMeta, tag);
          const afterVal = findTechnicalValue(afterMeta, tag);
          if (beforeVal !== undefined) {
            expect(
              afterVal,
              `Preserved technical tag ${tag} disappeared in ${fixture.id}`,
            ).toBeDefined();
            expect(
              technicalValuesEqual(beforeVal, afterVal, tag, fixture.extension),
              `Technical tag ${tag} changed in ${fixture.id}: ${JSON.stringify(beforeVal)} -> ${JSON.stringify(afterVal)}`,
            ).toBe(true);
          }
        }

        // 5. Document & container structure checks (PDF & DOCX)
        if (fixture.extension === 'pdf') {
          const beforePdf = await PDFDocument.load(inputBytes, {
            updateMetadata: false,
          });
          const afterPdf = await PDFDocument.load(stripRes.cleanedBuffer, {
            updateMetadata: false,
          });
          expect(afterPdf.getPageCount()).toBe(beforePdf.getPageCount());
        }

        if (fixture.extension === 'docx') {
          const afterZip = await JSZip.loadAsync(stripRes.cleanedBuffer);
          expect(afterZip.file('[Content_Types].xml')).not.toBeNull();
          expect(afterZip.file('word/document.xml')).not.toBeNull();
          expect(
            Object.keys(afterZip.files).some((name) => /^docProps\//i.test(name)),
          ).toBe(false);

          const xmlParts: string[] = [];
          for (const entry of Object.values(afterZip.files)) {
            if (!entry.dir && /\.(?:xml|rels)$/i.test(entry.name)) {
              xmlParts.push(await entry.async('string'));
            }
          }
          const combinedXml = xmlParts.join('\n');
          for (const s of sentinels) {
            expect(combinedXml).not.toContain(s);
          }
          expect(combinedXml).toContain('This comment content must be preserved.');
          expect(
            /\s(?:[A-Za-z_][\w.-]*:)?(?:author|initials|providerId|userId|personId)\s*=\s*(["'])[^"'<>]+\1/i.test(
              combinedXml,
            ),
          ).toBe(false);
          expect(
            /\s(?:[A-Za-z_][\w.-]*:)?rsid[A-Za-z0-9_.-]*\s*=/i.test(combinedXml) ||
              /<(?:[A-Za-z_][\w.-]*:)?rsids\b/i.test(combinedXml),
          ).toBe(false);
        }

        // 6. Workflow B parity: Gemini Watermark post-processing cleaner must produce
        // the exact same canonical metadata-cleaned output on JPEG, PNG, WebP, and MP4 fixtures!
        if (
          fixture.extension === 'jpg' ||
          fixture.extension === 'jpeg' ||
          fixture.extension === 'png' ||
          fixture.extension === 'webp'
        ) {
          const mime =
            fixture.extension === 'png'
              ? 'image/png'
              : fixture.extension === 'webp'
                ? 'image/webp'
                : 'image/jpeg';
          const copy = new Uint8Array(inputBytes.byteLength);
          copy.set(inputBytes);
          const geminiAudit = await cleanProcessedImageBlobWithAudit(
            new Blob([copy.buffer], { type: mime }),
            fixture.filename,
            mime,
          );
          const geminiBytes = new Uint8Array(await geminiAudit.blob.arrayBuffer());
          expect(geminiBytes).toEqual(stripRes.cleanedBuffer);
        }

        if (fixture.extension === 'mp4') {
          const copy = new Uint8Array(inputBytes.byteLength);
          copy.set(inputBytes);
          const geminiVidAudit = await cleanProcessedVideoBlobWithAudit(
            new Blob([copy.buffer], { type: 'video/mp4' }),
            fixture.filename,
          );
          const geminiVidBytes = new Uint8Array(
            await geminiVidAudit.blob.arrayBuffer(),
          );
          expect(geminiVidBytes).toEqual(stripRes.cleanedBuffer);
        }
      },
      60_000,
    );
  }
});

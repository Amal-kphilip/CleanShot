import { describe, expect, it } from 'vitest';
import {
  createWatermarkEngine,
  removeWatermarkFromImageDataSync,
} from '@pilio/gemini-watermark-remover/image-data';
import {
  buildCleanFilename,
  cleanProcessedImageBlob,
  cleanProcessedImageBlobWithAudit,
  removeGeminiWatermarkFromFile,
  resolveOutputMimeType,
} from '../geminiWatermark';
import { processGeminiGifBuffer } from '../geminiGifWatermark';
import {
  decodeGif,
  encodeGif,
  lzwDecode,
  lzwEncode,
  type EncodedGifFrameInput,
} from '../gifCodec';
import {
  buildCleanVideoFilename,
  cleanProcessedVideoBlob,
  cleanProcessedVideoBlobWithAudit,
} from '../geminiVideoWatermark';
import { getAutomaticVideoPresetConfig } from '@/lib/gwr-video/videoPresetPolicy.js';
import { resolveAllenkFdncnnRuntimeProfile } from '@/lib/gwr-video/videoDenoiseRuntimePolicy.js';
import { stripImageMetadata } from '@/lib/engine/stripper';
import { stripBlobMetadataInWorker } from '@/lib/worker/workerRunner';
import { createZipArchive } from '@/lib/zip/clientZip';
import {
  createSampleJpegWithMetadata,
  createSamplePngWithMetadata,
  createSampleWebpWithMetadata,
  repairPngCrcs,
} from '@/lib/engine/__tests__/fixtures';

describe('geminiWatermark helpers', () => {
  it('resolves output mime types and extensions correctly', () => {
    expect(resolveOutputMimeType('image/jpeg', 'auto')).toEqual({
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(resolveOutputMimeType('image/webp', 'auto')).toEqual({
      mimeType: 'image/webp',
      extension: 'webp',
    });
    expect(resolveOutputMimeType('image/png', 'auto')).toEqual({
      mimeType: 'image/png',
      extension: 'png',
    });
    expect(resolveOutputMimeType('image/jpeg', 'png')).toEqual({
      mimeType: 'image/png',
      extension: 'png',
    });
    expect(resolveOutputMimeType('image/png', 'webp')).toEqual({
      mimeType: 'image/webp',
      extension: 'webp',
    });
    expect(resolveOutputMimeType('image/gif', 'auto')).toEqual({
      mimeType: 'image/gif',
      extension: 'gif',
    });
    expect(resolveOutputMimeType('image/gif', 'png', 'animation.gif')).toEqual({
      mimeType: 'image/gif',
      extension: 'gif',
    });
  });

  it('builds clean filenames with -clean suffix', () => {
    expect(buildCleanFilename('gemini_photo.png', 'png')).toBe(
      'gemini_photo-clean.png'
    );
    expect(buildCleanFilename('my.image.jpeg', 'jpg')).toBe(
      'my.image-clean.jpg'
    );
    expect(buildCleanFilename('untitled', 'png')).toBe('untitled-clean.png');
  });

  it('runs removeWatermarkFromImageDataSync without throwing on a clean image buffer', () => {
    const width = 512;
    const height = 512;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }

    const result = removeWatermarkFromImageDataSync({ width, height, data });
    expect(result.imageData.width).toBe(width);
    expect(result.imageData.height).toBe(height);
    expect(result.meta).toBeDefined();
    expect(result.meta.applied).toBe(false);
  });

  it('builds clean video filenames and resolves video preset + ONNX model paths', () => {
    expect(buildCleanVideoFilename('veo_clip.mov')).toBe('veo_clip-clean.mp4');
    expect(buildCleanVideoFilename('gemini-video.mp4')).toBe('gemini-video-clean.mp4');

    const preset = getAutomaticVideoPresetConfig(null, { width: 1280, height: 720, duration: 5 });
    expect(preset.denoiseBackend).toBeTruthy();

    const profile = resolveAllenkFdncnnRuntimeProfile({ x: 100, y: 100, width: 48, height: 48 });
    expect(profile.modelUrl).toMatch(/^\/gemini-video\/models\/allenk-fdncnn\//);
  });
});

function makeBox(type: string, payload: Uint8Array): Uint8Array {
  const box = new Uint8Array(8 + payload.length);
  new DataView(box.buffer).setUint32(0, box.length, false);
  for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
  box.set(payload, 8);
  return box;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

function createSampleMp4(options: { withPrivateMeta?: boolean; withProvenance?: boolean } = {}): Uint8Array {
  const ftyp = makeBox('ftyp', new Uint8Array([0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 1, 0x69, 0x73, 0x6f, 0x6d]));

  const mvhdPayload = new Uint8Array(100);
  new DataView(mvhdPayload.buffer).setUint32(4, 0x12345678, false); // creation_time
  new DataView(mvhdPayload.buffer).setUint32(8, 0x87654321, false); // modification_time
  new DataView(mvhdPayload.buffer).setUint32(12, 1000, false); // timescale
  new DataView(mvhdPayload.buffer).setUint32(16, 5000, false); // duration (5s)
  const mvhd = makeBox('mvhd', mvhdPayload);

  const tkhdPayload = new Uint8Array(84);
  new DataView(tkhdPayload.buffer).setUint32(4, 0x11223344, false); // creation_time
  new DataView(tkhdPayload.buffer).setUint32(8, 0x55667788, false); // modification_time
  new DataView(tkhdPayload.buffer).setUint32(12, 1, false); // track_id
  new DataView(tkhdPayload.buffer).setUint32(76, 1280 << 16, false); // width 1280
  new DataView(tkhdPayload.buffer).setUint32(80, 720 << 16, false); // height 720
  const tkhd = makeBox('tkhd', tkhdPayload);

  const mdhdPayload = new Uint8Array(24);
  new DataView(mdhdPayload.buffer).setUint32(4, 0xAABBCCDD, false); // creation_time
  new DataView(mdhdPayload.buffer).setUint32(8, 0xDDCCBBAA, false); // modification_time
  const mdhd = makeBox('mdhd', mdhdPayload);
  const hdlrPayload = new Uint8Array(24);
  hdlrPayload.set([0x76, 0x69, 0x64, 0x65], 8); // 'vide'
  const hdlr = makeBox('hdlr', hdlrPayload);
  const mdia = makeBox('mdia', concatBytes(mdhd, hdlr));
  const trak = makeBox('trak', concatBytes(tkhd, mdia));

  const moovChildren: Uint8Array[] = [mvhd, trak];
  if (options.withPrivateMeta) {
    const privateBytes = new TextEncoder().encode('GPS:+37.7749,-122.4194;Device:Pixel');
    moovChildren.push(makeBox('udta', privateBytes));
  }
  if (options.withProvenance) {
    const c2paPayload = new TextEncoder().encode('jumb_c2pa_contentauth_manifest');
    moovChildren.push(makeBox('meta', c2paPayload));
  }

  const moov = makeBox('moov', concatBytes(...moovChildren));
  const mdat = makeBox('mdat', new Uint8Array([0x00, 0x00, 0x00, 0x02, 0x65, 0x88]));
  return concatBytes(ftyp, moov, mdat);
}

describe('Gemini Watermark Remover metadata-removal integration (canonical CleanShot pipeline)', () => {
  it('cleans JPEG using the exact same segment policy as standard metadata removal', async () => {
    const baseJpeg = createSampleJpegWithMetadata();
    const app2 = new Uint8Array([0xff, 0xe2, 0x00, 0x06, 0x49, 0x43, 0x43, 0x5f]);
    const app13 = new Uint8Array([0xff, 0xed, 0x00, 0x06, 0x38, 0x42, 0x49, 0x4d]);
    const jpegInput = concatBytes(baseJpeg.subarray(0, 2), app2, app13, baseJpeg.subarray(2));

    const cleanedBlob = await cleanProcessedImageBlob(
      bytesToBlob(jpegInput, 'image/jpeg'),
      'photo-clean.jpg',
      'image/jpeg'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const defaultStrip = await stripImageMetadata(jpegInput, 'photo-clean.jpg');

    expect(cleanedBytes).toEqual(defaultStrip.cleanedBuffer);
    const text = new TextDecoder('latin1').decode(cleanedBytes);
    expect(text).not.toContain('Sony');
    expect(text).not.toContain('8BIM');
    expect(text).toContain('ICC_');
  });

  it('cleans PNG using the exact same canonical policy as standard metadata removal', async () => {
    const basePng = createSamplePngWithMetadata();
    const cabxData = new TextEncoder().encode('c2pa_content_credentials');
    const cabxChunk = new Uint8Array(12 + cabxData.length);
    new DataView(cabxChunk.buffer).setUint32(0, cabxData.length, false);
    cabxChunk.set([0x63, 0x61, 0x42, 0x58], 4); // 'caBX'
    cabxChunk.set(cabxData, 8);

    const pngWithCabx = repairPngCrcs(
      concatBytes(basePng.subarray(0, basePng.length - 12), cabxChunk, basePng.subarray(basePng.length - 12))
    );

    const cleanedBlob = await cleanProcessedImageBlob(
      bytesToBlob(pngWithCabx, 'image-clean.png'),
      'image-clean.png',
      'image/png'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const defaultStrip = await stripImageMetadata(pngWithCabx, 'image-clean.png');

    expect(cleanedBytes).toEqual(defaultStrip.cleanedBuffer);
    const text = new TextDecoder('latin1').decode(cleanedBytes);
    expect(text).not.toContain('caBX');
    expect(text).not.toContain('c2pa_content_credentials');
  });

  it('cleans WebP using the exact same canonical policy as standard metadata removal (removing ICCP, EXIF, XMP)', async () => {
    const baseWebp = createSampleWebpWithMetadata();
    const iccpData = new TextEncoder().encode('fake_icc_profile');
    const iccpChunk = new Uint8Array(8 + iccpData.length);
    iccpChunk.set([0x49, 0x43, 0x43, 0x50], 0); // 'ICCP'
    new DataView(iccpChunk.buffer).setUint32(4, iccpData.length, true);
    iccpChunk.set(iccpData, 8);

    const combined = concatBytes(baseWebp, iccpChunk);
    new DataView(combined.buffer).setUint32(4, combined.length - 8, true);

    const cleanedBlob = await cleanProcessedImageBlob(
      bytesToBlob(combined, 'image-clean.webp'),
      'image-clean.webp',
      'image/webp'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const defaultStrip = await stripImageMetadata(combined, 'image-clean.webp');

    expect(cleanedBytes).toEqual(defaultStrip.cleanedBuffer);
    const text = new TextDecoder('latin1').decode(cleanedBytes);
    expect(text).toContain('RIFF');
    expect(text).toContain('WEBP');
    expect(text).not.toContain('EXIF');
    expect(text).not.toContain('ICCP');
    expect(text).not.toContain('fake_icc_profile');
  });

  it('fails closed when image metadata cleaning encounters corrupt data', async () => {
    const corruptBlob = new Blob([new Uint8Array([0xff, 0xd8, 0x00, 0x01])], {
      type: 'image/jpeg',
    });
    await expect(
      cleanProcessedImageBlob(corruptBlob, 'broken-clean.jpg', 'image/jpeg')
    ).rejects.toThrow();
  });

  it('cleans MP4 udta, meta boxes, and creation/modification timestamps identically to standard metadata removal', async () => {
    const mp4 = createSampleMp4({ withPrivateMeta: true, withProvenance: true });
    const cleanedBlob = await cleanProcessedVideoBlob(
      bytesToBlob(mp4, 'video/mp4'),
      'veo-clean.mp4'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const defaultStrip = await stripImageMetadata(mp4, 'veo-clean.mp4');
    expect(cleanedBytes).toEqual(defaultStrip.cleanedBuffer);

    const text = new TextDecoder('latin1').decode(cleanedBytes);
    expect(text).not.toContain('GPS:+37.7749');
    expect(text).not.toContain('jumb_c2pa_contentauth_manifest');
    expect(text).toContain('mdat');

    const mvhdOffset = text.indexOf('mvhd');
    expect(mvhdOffset).toBeGreaterThan(0);
    const mvhdView = new DataView(cleanedBytes.buffer, cleanedBytes.byteOffset + mvhdOffset + 4);
    expect(mvhdView.getUint32(4, false)).toBe(0);
    expect(mvhdView.getUint32(8, false)).toBe(0);
    expect(mvhdView.getUint32(12, false)).toBe(1000);
    expect(mvhdView.getUint32(16, false)).toBe(5000);
  });

  it('fails closed when MP4 metadata cleaning encounters a malformed container or abort', async () => {
    const malformedMp4 = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x08, 0x66, 0x74, 0x79, 0x70])], {
      type: 'video/mp4',
    });
    await expect(cleanProcessedVideoBlob(malformedMp4, 'broken-clean.mp4')).rejects.toThrow();

    const controller = new AbortController();
    controller.abort(new Error('Canceled by user'));
    const validMp4 = bytesToBlob(createSampleMp4({ withPrivateMeta: true }), 'video/mp4');
    await expect(
      cleanProcessedVideoBlob(validMp4, 'canceled-clean.mp4', controller.signal)
    ).rejects.toThrow('Canceled by user');
  });

  it('does not retain provenance or flag unverifiedMetadataRemoval when using canonical CleanShot policy', async () => {
    const mp4 = createSampleMp4({ withPrivateMeta: true, withProvenance: true });
    const videoAudit = await cleanProcessedVideoBlobWithAudit(
      bytesToBlob(mp4, 'video/mp4'),
      'veo-clean.mp4'
    );
    expect(videoAudit.provenancePreserved).toBe(false);
    expect(videoAudit.unverifiedMetadataRemoval).toBe(false);

    const basePng = createSamplePngWithMetadata();
    const imageAudit = await cleanProcessedImageBlobWithAudit(
      bytesToBlob(basePng, 'image/png'),
      'image-clean.png',
      'image/png'
    );
    expect(imageAudit.provenancePreserved).toBe(false);
    expect(imageAudit.unverifiedMetadataRemoval).toBe(false);
  });

  it('exercises Worker transfer, AbortSignal termination, error propagation, and refuses silent main-thread fallback for videos', async () => {
    const originalWorker = (globalThis as { Worker?: unknown }).Worker;
    let terminated = false;
    let postedSkipInspect = false;
    let postedTransferCount = 0;

    class MockSuccessWorker {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: ErrorEvent) => void) | null = null;
      postMessage(msg: { id: string; buffer: ArrayBuffer; filename: string; options: Record<string, unknown>; skipInspect?: boolean }, transfer?: Transferable[]) {
        postedSkipInspect = Boolean(msg.skipInspect);
        postedTransferCount = transfer?.length ?? 0;
        void stripImageMetadata(new Uint8Array(msg.buffer), msg.filename, msg.options).then((result) => {
          this.onmessage?.({ data: { id: msg.id, result } } as MessageEvent);
        });
      }
      terminate() {
        terminated = true;
      }
    }

    try {
      (globalThis as { Worker?: unknown }).Worker = MockSuccessWorker;
      const mp4 = createSampleMp4({ withPrivateMeta: true });
      const res = await stripBlobMetadataInWorker(
        bytesToBlob(mp4, 'video/mp4'),
        'veo-clean.mp4',
        { stripAll: true, preserveProvenance: true }
      );
      expect(postedSkipInspect).toBe(true);
      expect(postedTransferCount).toBe(1);
      expect(terminated).toBe(false);
      expect(new TextDecoder('latin1').decode(res.cleanedBuffer)).not.toContain('GPS:+37.7749');

      // Test AbortSignal terminates an in-flight worker
      terminated = false;
      class MockHangingWorker {
        onmessage: ((ev: MessageEvent) => void) | null = null;
        onerror: ((ev: ErrorEvent) => void) | null = null;
        postMessage() {}
        terminate() {
          terminated = true;
        }
      }
      (globalThis as { Worker?: unknown }).Worker = MockHangingWorker;
      const controller = new AbortController();
      const promise = stripBlobMetadataInWorker(
        bytesToBlob(mp4, 'video/mp4'),
        'veo-clean.mp4',
        { stripAll: true },
        controller.signal
      );
      setTimeout(() => controller.abort(new Error('Aborted in worker')), 5);
      await expect(promise).rejects.toThrow('Aborted in worker');
      expect(terminated).toBe(true);

      // Test worker initialization failure refuses silent main-thread fallback for video files
      (globalThis as { Worker?: unknown }).Worker = function ThrowingWorker() {
        throw new Error('CSP blocked Worker');
      };
      await expect(
        stripBlobMetadataInWorker(bytesToBlob(mp4, 'video/mp4'), 'veo-clean.mp4', { stripAll: true })
      ).rejects.toThrow(/Background metadata worker failed to initialize/i);
    } finally {
      (globalThis as { Worker?: unknown }).Worker = originalWorker;
    }
  });

  it('builds a batch ZIP archive from cleaned image and video Blobs', async () => {
    const cleanedImg = await cleanProcessedImageBlob(
      bytesToBlob(createSampleJpegWithMetadata(), 'image/jpeg'),
      'photo-clean.jpg',
      'image/jpeg'
    );
    const cleanedVid = await cleanProcessedVideoBlob(
      bytesToBlob(createSampleMp4({ withPrivateMeta: true }), 'video/mp4'),
      'veo-clean.mp4'
    );

    const zipBlob = createZipArchive(
      [
        { name: 'photo-clean.jpg', data: new Uint8Array(await cleanedImg.arrayBuffer()) },
        { name: 'veo-clean.mp4', data: new Uint8Array(await cleanedVid.arrayBuffer()) },
      ],
      false
    );
    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
    const zipText = new TextDecoder('latin1').decode(zipBytes);
    expect(zipBytes[0]).toBe(0x50); // 'P'
    expect(zipBytes[1]).toBe(0x4b); // 'K'
    expect(zipText).toContain('photo-clean.jpg');
    expect(zipText).toContain('veo-clean.mp4');
    expect(zipText).not.toContain('SecretCamera');
    expect(zipText).not.toContain('GPS:+37.7749');
  });
});

/**
 * Helper to synthesize a palette-indexed GIF frame with an authentic Gemini watermark
 * blended at the catalog position for `(width, height)`.
 */
async function buildWatermarkedGifFrame(params: {
  width: number;
  height: number;
  baseColor: [number, number, number];
  accentColor?: [number, number, number];
  accentRect?: { x: number; y: number; w: number; h: number };
  transparentRect?: { x: number; y: number; w: number; h: number };
  delayCs?: number;
  disposalMethod?: number;
}): Promise<{
  frame: EncodedGifFrameInput;
  palette: Uint8Array;
  watermarkPosition: { x: number; y: number; width: number; height: number };
  cleanCenterLum: number;
  watermarkedCenterLum: number;
}> {
  const { width, height, baseColor } = params;
  const engine = await createWatermarkEngine();
  const info = engine.getWatermarkInfo(width, height);
  const alphaMap = await engine.getAlphaMap(info.size);
  const pos = info.position;

  // Build a 256-entry palette:
  // Index 0 = baseColor
  // Index 1 = accentColor (if any)
  // Index 2..254 = grayscale/tinted ramp covering watermark blend values
  // Index 255 = transparent slot
  const palette = new Uint8Array(256 * 3);
  palette[0] = baseColor[0];
  palette[1] = baseColor[1];
  palette[2] = baseColor[2];

  const accent = params.accentColor ?? [40, 120, 200];
  palette[3] = accent[0];
  palette[4] = accent[1];
  palette[5] = accent[2];

  for (let i = 2; i < 255; i++) {
    const t = (i - 2) / 252;
    palette[i * 3] = Math.round(baseColor[0] + t * (255 - baseColor[0]));
    palette[i * 3 + 1] = Math.round(baseColor[1] + t * (255 - baseColor[1]));
    palette[i * 3 + 2] = Math.round(baseColor[2] + t * (255 - baseColor[2]));
  }

  const indices = new Uint8Array(width * height);
  if (params.accentRect) {
    const { x, y, w, h } = params.accentRect;
    for (let ry = y; ry < Math.min(height, y + h); ry++) {
      for (let rx = x; rx < Math.min(width, x + w); rx++) {
        indices[ry * width + rx] = 1;
      }
    }
  }

  // Blend the authentic Gemini watermark into the watermark region
  let maxAlphaSeen = -1;
  let peakLum = 0;
  for (let row = 0; row < pos.height; row++) {
    const cy = pos.y + row;
    if (cy < 0 || cy >= height) continue;
    for (let col = 0; col < pos.width; col++) {
      const cx = pos.x + col;
      if (cx < 0 || cx >= width) continue;
      const alpha = Math.max(0, Math.min(1, alphaMap[row * pos.width + col]));
      if (alpha < 0.002) continue;
      const paletteIdx = Math.max(2, Math.min(254, 2 + Math.round(alpha * 252)));
      indices[cy * width + cx] = paletteIdx;
      if (alpha > maxAlphaSeen) {
        maxAlphaSeen = alpha;
        peakLum =
          (palette[paletteIdx * 3] +
            palette[paletteIdx * 3 + 1] +
            palette[paletteIdx * 3 + 2]) /
          3;
      }
    }
  }

  let transparentIndex = -1;
  if (params.transparentRect) {
    transparentIndex = 255;
    const { x, y, w, h } = params.transparentRect;
    for (let ry = y; ry < Math.min(height, y + h); ry++) {
      for (let rx = x; rx < Math.min(width, x + w); rx++) {
        indices[ry * width + rx] = transparentIndex;
      }
    }
  }

  return {
    frame: {
      left: 0,
      top: 0,
      width,
      height,
      delayCs: params.delayCs ?? 10,
      disposalMethod: params.disposalMethod ?? 1,
      transparentIndex,
      localColorTable: null,
      indices,
    },
    palette,
    watermarkPosition: pos,
    cleanCenterLum: (baseColor[0] + baseColor[1] + baseColor[2]) / 3,
    watermarkedCenterLum: peakLum,
  };
}

function injectGifCommentAndXmpMetadata(gifBytes: Uint8Array, commentText: string): Uint8Array {
  const enc = new TextEncoder();
  const commentPayload = enc.encode(commentText);
  const commentExt = new Uint8Array([
    0x21,
    0xfe,
    commentPayload.length,
    ...commentPayload,
    0x00,
  ]);
  const xmpPayload = enc.encode('<x:xmpmeta>CLEANSHOT_TEST_GIF_XMP_SECRET</x:xmpmeta>');
  const xmpHeader = enc.encode('XMP DataXMP');
  const xmpExt = new Uint8Array([
    0x21,
    0xff,
    0x0b,
    ...xmpHeader,
    xmpPayload.length,
    ...xmpPayload,
    0x00,
  ]);

  // Insert right before the final 0x3B trailer
  const withoutTrailer = gifBytes.subarray(0, gifBytes.length - 1);
  const out = new Uint8Array(withoutTrailer.length + commentExt.length + xmpExt.length + 1);
  out.set(withoutTrailer, 0);
  out.set(commentExt, withoutTrailer.length);
  out.set(xmpExt, withoutTrailer.length + commentExt.length);
  out[out.length - 1] = 0x3b;
  return out;
}

function measureWatermarkRegionMeanLuminance(
  decoded: ReturnType<typeof decodeGif>,
  frameIndex: number,
  pos: { x: number; y: number; width: number; height: number },
): number {
  const frame = decoded.frames[frameIndex];
  const palette = frame.localColorTable ?? decoded.globalColorTable!;
  let sum = 0;
  let count = 0;
  for (let row = 0; row < pos.height; row++) {
    const cy = pos.y + row;
    if (cy < frame.top || cy >= frame.top + frame.height) continue;
    for (let col = 0; col < pos.width; col++) {
      const cx = pos.x + col;
      if (cx < frame.left || cx >= frame.left + frame.width) continue;
      const idx = frame.indices[(cy - frame.top) * frame.width + (cx - frame.left)];
      if (idx === frame.transparentIndex) continue;
      const pOff = idx * 3;
      sum += (palette[pOff] + palette[pOff + 1] + palette[pOff + 2]) / 3;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

describe('Gemini GIF Watermark Removal & Metadata Cleaning Pipeline', () => {
  it('round-trips LZW encode and decode losslessly across full 8-bit index streams', () => {
    const indices = new Uint8Array(4096);
    for (let i = 0; i < indices.length; i++) {
      indices[i] = (i * 17 + (i >>> 3)) & 0xff;
    }
    const encoded = lzwEncode(indices, 8);
    expect(encoded[0]).toBe(8);
    expect(encoded[encoded.length - 1]).toBe(0x00);

    // Unwrap GIF sub-blocks (1-byte length prefix per sub-block, terminated by 0x00)
    const unwrapped: number[] = [];
    let pos = 1;
    while (pos < encoded.length) {
      const len = encoded[pos++];
      if (len === 0) break;
      for (let j = 0; j < len; j++) {
        unwrapped.push(encoded[pos++]);
      }
    }
    const decoded = lzwDecode(encoded[0], new Uint8Array(unwrapped), indices.length);
    expect(decoded).toEqual(indices);
  });

  it('removes Gemini watermark and metadata from a static GIF without converting it into an animated GIF', async () => {
    const width = 320;
    const height = 240;
    const { frame, palette, watermarkPosition, cleanCenterLum } =
      await buildWatermarkedGifFrame({
        width,
        height,
        baseColor: [36, 48, 68],
      });

    const rawGif = encodeGif({
      width,
      height,
      globalColorTable: palette,
      loopCount: null,
      frames: [frame],
    });
    const gifWithMeta = injectGifCommentAndXmpMetadata(
      rawGif,
      'CLEANSHOT_TEST_STATIC_GIF_COMMENT',
    );

    const beforeDecoded = decodeGif(gifWithMeta);
    const beforeMeanLum = measureWatermarkRegionMeanLuminance(
      beforeDecoded,
      0,
      watermarkPosition,
    );
    expect(beforeMeanLum).toBeGreaterThan(cleanCenterLum + 5);

    const processed = await processGeminiGifBuffer(gifWithMeta, 'static-clean.gif');
    expect(processed.animated).toBe(false);
    expect(processed.frameCount).toBe(1);
    expect(processed.width).toBe(width);
    expect(processed.height).toBe(height);
    expect(processed.meta?.applied).toBe(true);
    expect(processed.result.error).toBeUndefined();

    // Verify metadata (Comment and XMP) was stripped and no NETSCAPE2.0 loop extension was added
    const cleanedAscii = new TextDecoder('latin1').decode(processed.result.cleanedBuffer);
    expect(cleanedAscii).not.toContain('CLEANSHOT_TEST_STATIC_GIF_COMMENT');
    expect(cleanedAscii).not.toContain('CLEANSHOT_TEST_GIF_XMP_SECRET');
    expect(cleanedAscii).not.toContain('NETSCAPE2.0');

    // Verify decoded output is a valid 1-frame static GIF with watermark luminance restored
    const afterDecoded = decodeGif(processed.result.cleanedBuffer);
    expect(afterDecoded.frames.length).toBe(1);
    expect(afterDecoded.loopCount).toBeNull();
    const afterMeanLum = measureWatermarkRegionMeanLuminance(
      afterDecoded,
      0,
      watermarkPosition,
    );
    expect(afterMeanLum).toBeLessThan(beforeMeanLum - 10);
    expect(Math.abs(afterMeanLum - cleanCenterLum)).toBeLessThan(3.0);
  });

  it('removes Gemini watermark consistently across short animated GIFs with varying frame delays and loop counts', async () => {
    const width = 320;
    const height = 240;
    const delays = [6, 12, 18, 24];
    const frames: EncodedGifFrameInput[] = [];
    let sharedPalette: Uint8Array | null = null;
    let wmPos = { x: 0, y: 0, width: 48, height: 48 };
    let baseLum = 0;

    for (let i = 0; i < delays.length; i++) {
      const built = await buildWatermarkedGifFrame({
        width,
        height,
        baseColor: [42, 54, 72],
        accentColor: [200, 80 + i * 30, 60],
        accentRect: { x: 20 + i * 25, y: 30 + i * 15, w: 40, h: 40 },
        delayCs: delays[i],
        disposalMethod: 1,
      });
      frames.push(built.frame);
      sharedPalette = built.palette;
      wmPos = built.watermarkPosition;
      baseLum = built.cleanCenterLum;
    }

    const rawGif = encodeGif({
      width,
      height,
      globalColorTable: sharedPalette,
      loopCount: 3,
      frames,
    });
    const gifWithMeta = injectGifCommentAndXmpMetadata(
      rawGif,
      'CLEANSHOT_TEST_ANIM_GIF_COMMENT',
    );

    const processed = await processGeminiGifBuffer(gifWithMeta, 'short-anim-clean.gif');
    expect(processed.animated).toBe(true);
    expect(processed.frameCount).toBe(4);
    expect(processed.meta?.applied).toBe(true);

    const cleanedAscii = new TextDecoder('latin1').decode(processed.result.cleanedBuffer);
    expect(cleanedAscii).not.toContain('CLEANSHOT_TEST_ANIM_GIF_COMMENT');
    expect(cleanedAscii).not.toContain('CLEANSHOT_TEST_GIF_XMP_SECRET');
    expect(cleanedAscii).toContain('NETSCAPE2.0');

    const afterDecoded = decodeGif(processed.result.cleanedBuffer);
    expect(afterDecoded.frames.length).toBe(4);
    expect(afterDecoded.loopCount).toBe(3);
    expect(afterDecoded.frames.map((f) => f.delayCs)).toEqual(delays);

    // Every frame must have the watermark removed consistently without frame-to-frame flicker
    const frameLuminances = afterDecoded.frames.map((_, idx) =>
      measureWatermarkRegionMeanLuminance(afterDecoded, idx, wmPos),
    );
    for (const lum of frameLuminances) {
      expect(Math.abs(lum - baseLum)).toBeLessThan(3.0);
    }
    const maxFlickerDelta =
      Math.max(...frameLuminances) - Math.min(...frameLuminances);
    expect(maxFlickerDelta).toBeLessThan(0.5);
  });

  it('handles long animated GIFs (24 frames), transparency, disposal methods (1, 2, 3), and partial-frame updates', async () => {
    const width = 320;
    const height = 240;
    const totalFrames = 24;
    const frames: EncodedGifFrameInput[] = [];
    let sharedPalette: Uint8Array | null = null;
    let wmPos = { x: 0, y: 0, width: 48, height: 48 };
    let baseLum = 0;

    for (let i = 0; i < totalFrames; i++) {
      const disposal = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3;
      const built = await buildWatermarkedGifFrame({
        width,
        height,
        baseColor: [30, 60, 50],
        accentColor: [220, 180, 40],
        accentRect: { x: (i * 10) % 180, y: (i * 7) % 120, w: 32, h: 32 },
        transparentRect: { x: 8, y: 8, w: 24, h: 24 },
        delayCs: 5 + (i % 4),
        disposalMethod: disposal,
      });

      if (i === 5) {
        // Make frame 5 a partial frame in the top-left corner that does not touch the watermark
        const partialW = 60;
        const partialH = 50;
        const partialIndices = new Uint8Array(partialW * partialH).fill(1);
        frames.push({
          left: 10,
          top: 10,
          width: partialW,
          height: partialH,
          delayCs: 7,
          disposalMethod: 1,
          transparentIndex: 255,
          localColorTable: null,
          indices: partialIndices,
        });
      } else {
        frames.push(built.frame);
      }

      sharedPalette = built.palette;
      wmPos = built.watermarkPosition;
      baseLum = built.cleanCenterLum;
    }

    const rawGif = encodeGif({
      width,
      height,
      globalColorTable: sharedPalette,
      loopCount: 0,
      frames,
    });

    const progressUpdates: number[] = [];
    const processed = await processGeminiGifBuffer(rawGif, 'long-anim-clean.gif', {
      onProgress: (p) => progressUpdates.push(p.progress),
    });

    expect(processed.animated).toBe(true);
    expect(processed.frameCount).toBe(totalFrames);
    expect(processed.meta?.applied).toBe(true);
    expect(progressUpdates.length).toBeGreaterThan(2);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(1);

    const afterDecoded = decodeGif(processed.result.cleanedBuffer);
    expect(afterDecoded.frames.length).toBe(totalFrames);
    expect(afterDecoded.loopCount).toBe(0);

    // Frame 0 transparent top-left corner must remain transparent
    const f0 = afterDecoded.frames[0];
    expect(f0.transparentIndex).toBeGreaterThanOrEqual(0);
    expect(f0.indices[10 * f0.width + 10]).toBe(f0.transparentIndex);

    // Frame 5 partial frame dimensions and position must be preserved
    const f5 = afterDecoded.frames[5];
    expect(f5.left).toBe(10);
    expect(f5.top).toBe(10);
    expect(f5.width).toBe(60);
    expect(f5.height).toBe(50);

    // Full frames must have the watermark removed
    for (const idx of [0, 1, 2, 10, 15, 23]) {
      const lum = measureWatermarkRegionMeanLuminance(afterDecoded, idx, wmPos);
      expect(Math.abs(lum - baseLum)).toBeLessThan(3.0);
    }
  });

  it('handles large-dimension GIFs (1200x1200 with 96x96 watermark) and end-to-end removeGeminiWatermarkFromFile + ZIP export', async () => {
    const width = 1200;
    const height = 1200;
    const built = await buildWatermarkedGifFrame({
      width,
      height,
      baseColor: [48, 40, 64],
      delayCs: 10,
    });
    expect(built.watermarkPosition.width).toBe(96);

    const rawLargeGif = injectGifCommentAndXmpMetadata(
      encodeGif({
        width,
        height,
        globalColorTable: built.palette,
        loopCount: 0,
        frames: [built.frame, { ...built.frame, delayCs: 15 }],
      }),
      'CLEANSHOT_TEST_LARGE_GIF_SECRET',
    );

    const gifCopy = new Uint8Array(rawLargeGif.byteLength);
    gifCopy.set(rawLargeGif);
    const gifFile = new File([gifCopy.buffer], 'banner.gif', {
      type: 'image/gif',
    });

    const originalWorker = (globalThis as { Worker?: unknown }).Worker;
    try {
      // Force fallback to direct in-process execution in Node test environment
      (globalThis as { Worker?: unknown }).Worker = undefined;

      const fileRes = await removeGeminiWatermarkFromFile(gifFile, {
        adaptiveMode: 'auto',
        outputFormat: 'auto',
      });

      expect(fileRes.mimeType).toBe('image/gif');
      expect(fileRes.outputName).toBe('banner-clean.gif');
      expect(fileRes.width).toBe(1200);
      expect(fileRes.height).toBe(1200);
      expect(fileRes.frameCount).toBe(2);
      expect(fileRes.animated).toBe(true);
      expect(fileRes.meta?.applied).toBe(true);
      expect(fileRes.meta?.size).toBe(96);

      const outBytes = new Uint8Array(await fileRes.blob.arrayBuffer());
      const outAscii = new TextDecoder('latin1').decode(outBytes);
      expect(outAscii).not.toContain('CLEANSHOT_TEST_LARGE_GIF_SECRET');
      expect(outAscii).not.toContain('CLEANSHOT_TEST_GIF_XMP_SECRET');

      const outDecoded = decodeGif(outBytes);
      expect(outDecoded.frames.length).toBe(2);
      expect(outDecoded.frames.map((f) => f.delayCs)).toEqual([10, 15]);
      for (let i = 0; i < 2; i++) {
        const lum = measureWatermarkRegionMeanLuminance(
          outDecoded,
          i,
          built.watermarkPosition,
        );
        expect(Math.abs(lum - built.cleanCenterLum)).toBeLessThan(3.0);
      }

      // Verify batch ZIP export packages the cleaned GIF properly
      const zipBlob = createZipArchive(
        [{ name: fileRes.outputName, data: outBytes }],
        false,
      );
      const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
      const zipText = new TextDecoder('latin1').decode(zipBytes);
      expect(zipText).toContain('banner-clean.gif');
      expect(zipText).not.toContain('CLEANSHOT_TEST_LARGE_GIF_SECRET');

      URL.revokeObjectURL(fileRes.originalUrl);
      URL.revokeObjectURL(fileRes.previewUrl);
    } finally {
      (globalThis as { Worker?: unknown }).Worker = originalWorker;
    }
  });
});

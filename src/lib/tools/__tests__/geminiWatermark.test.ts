import { describe, expect, it } from 'vitest';
import { removeWatermarkFromImageDataSync } from '@pilio/gemini-watermark-remover/image-data';
import {
  buildCleanFilename,
  cleanProcessedImageBlob,
  cleanProcessedImageBlobWithAudit,
  resolveOutputMimeType,
} from '../geminiWatermark';
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

describe('Gemini Watermark Remover metadata-removal integration', () => {
  it('cleans privacy metadata from JPEG while preserving C2PA/APP11 provenance', async () => {
    const baseJpeg = createSampleJpegWithMetadata();
    const c2paPayload = new TextEncoder().encode('JP\x00\x00c2pa_contentauth');
    const app11 = new Uint8Array(4 + c2paPayload.length);
    app11[0] = 0xff;
    app11[1] = 0xeb;
    app11[2] = ((c2paPayload.length + 2) >> 8) & 0xff;
    app11[3] = (c2paPayload.length + 2) & 0xff;
    app11.set(c2paPayload, 4);

    // Insert APP11 right after SOI (FF D8)
    const jpegWithC2pa = concatBytes(baseJpeg.subarray(0, 2), app11, baseJpeg.subarray(2));
    const cleanedBlob = await cleanProcessedImageBlob(
      bytesToBlob(jpegWithC2pa, 'image/jpeg'),
      'photo-clean.jpg',
      'image/jpeg'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(cleanedBytes);

    expect(cleanedBytes[0]).toBe(0xff);
    expect(cleanedBytes[1]).toBe(0xd8);
    expect(cleanedBytes[cleanedBytes.length - 2]).toBe(0xff);
    expect(cleanedBytes[cleanedBytes.length - 1]).toBe(0xd9);
    // Private EXIF/COM stripped, C2PA APP11 preserved
    expect(text).not.toContain('SecretCamera');
    expect(text).toContain('c2pa_contentauth');

    // Regression: default StripMeta mode still strips APP11 C2PA
    const defaultStrip = await stripImageMetadata(jpegWithC2pa, 'photo.jpg');
    expect(new TextDecoder('latin1').decode(defaultStrip.cleanedBuffer)).not.toContain('c2pa_contentauth');
  });

  it('cleans privacy metadata from PNG while preserving caBX provenance and iCCP', async () => {
    const basePng = createSamplePngWithMetadata();
    const cabxData = new TextEncoder().encode('c2pa_content_credentials');
    const cabxChunk = new Uint8Array(12 + cabxData.length);
    new DataView(cabxChunk.buffer).setUint32(0, cabxData.length, false);
    cabxChunk.set([0x63, 0x61, 0x42, 0x58], 4); // 'caBX'
    cabxChunk.set(cabxData, 8);

    // Insert caBX before IEND (last 12 bytes)
    const pngWithCabx = repairPngCrcs(
      concatBytes(basePng.subarray(0, basePng.length - 12), cabxChunk, basePng.subarray(basePng.length - 12))
    );

    const cleanedBlob = await cleanProcessedImageBlob(
      bytesToBlob(pngWithCabx, 'image/png'),
      'image-clean.png',
      'image/png'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(cleanedBytes);

    expect(text).not.toContain('PrivatePrompt');
    expect(text).toContain('caBX');
    expect(text).toContain('c2pa_content_credentials');

    // Regression: default StripMeta mode still removes caBX
    const defaultStrip = await stripImageMetadata(pngWithCabx, 'image.png');
    expect(new TextDecoder('latin1').decode(defaultStrip.cleanedBuffer)).not.toContain('caBX');
  });

  it('cleans privacy metadata from WebP while preserving C2PA provenance', async () => {
    const baseWebp = createSampleWebpWithMetadata();
    const c2paChunkData = new TextEncoder().encode('c2pa_webp_manifest');
    const c2paChunk = new Uint8Array(8 + c2paChunkData.length);
    c2paChunk.set([0x43, 0x32, 0x50, 0x41], 0); // 'C2PA'
    new DataView(c2paChunk.buffer).setUint32(4, c2paChunkData.length, true);
    c2paChunk.set(c2paChunkData, 8);

    const combined = concatBytes(baseWebp, c2paChunk);
    new DataView(combined.buffer).setUint32(4, combined.length - 8, true);

    const cleanedBlob = await cleanProcessedImageBlob(
      bytesToBlob(combined, 'image/webp'),
      'image-clean.webp',
      'image/webp'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(cleanedBytes);

    expect(text).toContain('RIFF');
    expect(text).toContain('WEBP');
    expect(text).not.toContain('SecretWebpExif');
    expect(text).toContain('c2pa_webp_manifest');
  });

  it('fails closed when image metadata cleaning encounters corrupt data', async () => {
    const corruptBlob = new Blob([new Uint8Array([0xff, 0xd8, 0x00, 0x01])], {
      type: 'image/jpeg',
    });
    await expect(
      cleanProcessedImageBlob(corruptBlob, 'broken-clean.jpg', 'image/jpeg')
    ).rejects.toThrow();
  });

  it('cleans private MP4 metadata & timestamps while preserving C2PA provenance and streams', async () => {
    const mp4 = createSampleMp4({ withPrivateMeta: true, withProvenance: true });
    const cleanedBlob = await cleanProcessedVideoBlob(
      bytesToBlob(mp4, 'video/mp4'),
      'veo-clean.mp4'
    );
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(cleanedBytes);

    // Private udta GPS/device metadata stripped; provenance meta preserved; mdat intact
    expect(text).not.toContain('GPS:+37.7749');
    expect(text).toContain('jumb_c2pa_contentauth_manifest');
    expect(text).toContain('mdat');

    // Verify mvhd creation/modification timestamps zeroed while duration (5000) and timescale (1000) remain intact
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

  it('propagates unverifiedMetadataRemoval when unknown or mixed provenance structures are retained', async () => {
    const mp4 = createSampleMp4({ withPrivateMeta: true, withProvenance: true });
    const videoAudit = await cleanProcessedVideoBlobWithAudit(
      bytesToBlob(mp4, 'video/mp4'),
      'veo-clean.mp4'
    );
    expect(videoAudit.provenancePreserved).toBe(true);
    expect(videoAudit.unverifiedMetadataRemoval).toBe(true);

    // Unknown ancillary PNG chunk ('prIv') retained under preserveProvenance -> unverifiedMetadataRemoval: true
    const basePng = createSamplePngWithMetadata();
    const unknownData = new TextEncoder().encode('custom_ancillary_payload');
    const unknownChunk = new Uint8Array(12 + unknownData.length);
    new DataView(unknownChunk.buffer).setUint32(0, unknownData.length, false);
    unknownChunk.set([0x70, 0x72, 0x49, 0x76], 4); // 'prIv' (lowercase first byte = ancillary)
    unknownChunk.set(unknownData, 8);
    const pngWithUnknown = repairPngCrcs(
      concatBytes(basePng.subarray(0, basePng.length - 12), unknownChunk, basePng.subarray(basePng.length - 12))
    );
    const imageAudit = await cleanProcessedImageBlobWithAudit(
      bytesToBlob(pngWithUnknown, 'image/png'),
      'image-clean.png',
      'image/png'
    );
    expect(imageAudit.unverifiedMetadataRemoval).toBe(true);
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
      expect(terminated).toBe(true);
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

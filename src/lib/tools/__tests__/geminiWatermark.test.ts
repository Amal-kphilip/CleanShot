import { describe, expect, it } from 'vitest';
import { removeWatermarkFromImageDataSync } from '@pilio/gemini-watermark-remover/image-data';
import {
  buildCleanFilename,
  resolveOutputMimeType,
} from '../geminiWatermark';
import { buildCleanVideoFilename } from '../geminiVideoWatermark';
import { getAutomaticVideoPresetConfig } from '@/lib/gwr-video/videoPresetPolicy.js';
import { resolveAllenkFdncnnRuntimeProfile } from '@/lib/gwr-video/videoDenoiseRuntimePolicy.js';

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

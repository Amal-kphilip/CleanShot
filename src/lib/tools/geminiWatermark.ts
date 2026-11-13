import {
  createWatermarkEngine,
  removeWatermarkFromImage,
  type ImageRemovalResult,
  type WatermarkEngine,
  type WatermarkMeta,
} from '@pilio/gemini-watermark-remover/browser';

export type AdaptiveMode = 'auto' | 'always' | 'off';
export type OutputFormat = 'auto' | 'png' | 'jpeg' | 'webp';
export type ResolvedImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ProcessedWatermarkResult {
  blob: Blob;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  meta: WatermarkMeta | null;
  elapsedMs: number;
  outputName: string;
  mimeType: ResolvedImageMime;
}

/**
 * Resolves the target output MIME type and file extension from the source file
 * type and user-selected format preference.
 */
export function resolveOutputMimeType(
  sourceMimeType: string,
  format: OutputFormat
): { mimeType: ResolvedImageMime; extension: string } {
  if (format === 'png') return { mimeType: 'image/png', extension: 'png' };
  if (format === 'jpeg') return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (format === 'webp') return { mimeType: 'image/webp', extension: 'webp' };

  const normalized = sourceMimeType.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (normalized === 'image/webp') {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return { mimeType: 'image/png', extension: 'png' };
}

/**
 * Builds a clean download filename preserving the base name with a `-clean` suffix.
 */
export function buildCleanFilename(originalName: string, extension: string): string {
  const trimmed = originalName.trim() || 'image';
  const lastDot = trimmed.lastIndexOf('.');
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  return `${base}-clean.${extension}`;
}

/**
 * Converts either an OffscreenCanvas or HTMLCanvasElement into a Blob.
 */
export async function canvasToImageBlob(
  canvas: ImageRemovalResult['canvas'],
  mimeType: ResolvedImageMime,
  quality = 0.95
): Promise<Blob> {
  const maybeOffscreen = canvas as unknown as {
    convertToBlob?: (options?: { type?: string; quality?: number }) => Promise<Blob>;
    toBlob?: (
      callback: (blob: Blob | null) => void,
      type?: string,
      quality?: number
    ) => void;
  };

  if (typeof maybeOffscreen.convertToBlob === 'function') {
    return maybeOffscreen.convertToBlob({
      type: mimeType,
      quality: mimeType === 'image/png' ? undefined : quality,
    });
  }

  if (typeof maybeOffscreen.toBlob === 'function') {
    return new Promise<Blob>((resolve, reject) => {
      maybeOffscreen.toBlob!(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to encode the processed image.'));
          }
        },
        mimeType,
        mimeType === 'image/png' ? undefined : quality
      );
    });
  }

  throw new Error('Browser canvas export API is unavailable.');
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('The selected image could not be decoded by this browser.'));
    image.src = url;
  });
}

let sharedEnginePromise: Promise<WatermarkEngine> | null = null;

/**
 * Lazily creates and caches a shared WatermarkEngine instance for the browser session.
 */
export function getSharedWatermarkEngine(): Promise<WatermarkEngine> {
  if (!sharedEnginePromise) {
    sharedEnginePromise = createWatermarkEngine().catch((err) => {
      sharedEnginePromise = null;
      throw err;
    });
  }
  return sharedEnginePromise;
}

/**
 * Removes Gemini watermarks from an image File entirely in the browser.
 * Caller is responsible for revoking `originalUrl` and `previewUrl` when done.
 */
export async function removeGeminiWatermarkFromFile(
  file: File,
  options: {
    adaptiveMode?: AdaptiveMode;
    outputFormat?: OutputFormat;
    engine?: WatermarkEngine;
  } = {}
): Promise<ProcessedWatermarkResult> {
  const adaptiveMode = options.adaptiveMode ?? 'auto';
  const outputFormat = options.outputFormat ?? 'auto';
  const originalUrl = URL.createObjectURL(file);

  try {
    const startedAt = performance.now();
    const image = await loadHtmlImage(originalUrl);
    const engine = options.engine ?? (await getSharedWatermarkEngine());
    const { canvas, meta } = await removeWatermarkFromImage(image, {
      engine,
      adaptiveMode,
    });

    const { mimeType, extension } = resolveOutputMimeType(file.type, outputFormat);
    const blob = await canvasToImageBlob(canvas, mimeType);
    const previewUrl = URL.createObjectURL(blob);
    const elapsedMs = Math.round(performance.now() - startedAt);

    return {
      blob,
      previewUrl,
      originalUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
      meta,
      elapsedMs,
      outputName: buildCleanFilename(file.name, extension),
      mimeType,
    };
  } catch (error) {
    URL.revokeObjectURL(originalUrl);
    throw error;
  }
}

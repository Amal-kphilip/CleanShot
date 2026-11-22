import {
  createWatermarkEngine,
  removeWatermarkFromImage,
  type ImageRemovalResult,
  type WatermarkEngine,
  type WatermarkMeta,
} from '@pilio/gemini-watermark-remover/browser';
import {
  MAX_MAIN_THREAD_FALLBACK_BYTES,
  processGeminiImageInWorker,
  stripBlobMetadataInWorker,
} from '@/lib/worker/workerRunner';
import {
  GifWatermarkProgress,
  isGifImage,
  processGeminiGifBuffer,
} from './geminiGifWatermark';

export type AdaptiveMode = 'auto' | 'always' | 'off';
export type OutputFormat = 'auto' | 'png' | 'jpeg' | 'webp' | 'gif';
export type ResolvedImageMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif';

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
  frameCount?: number;
  animated?: boolean;
  provenancePreserved?: boolean;
  unverifiedMetadataRemoval?: boolean;
}

/**
 * Resolves the target output MIME type and file extension from the source file
 * type and user-selected format preference. GIF inputs are always preserved as
 * `image/gif` so animated and static GIFs are never routed through static-only encoders.
 */
export function resolveOutputMimeType(
  sourceMimeType: string,
  format: OutputFormat,
  sourceFilename = ''
): { mimeType: ResolvedImageMime; extension: string } {
  if (isGifImage(sourceMimeType, sourceFilename) || format === 'gif') {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
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

export interface CleanedMediaAudit {
  blob: Blob;
  provenancePreserved: boolean;
  unverifiedMetadataRemoval: boolean;
}

/**
 * Runs the existing StripMeta metadata engine (with ICC color profile and
 * C2PA/provenance preservation enabled) on a processed image Blob and returns
 * both the cleaned Blob and metadata-audit flags.
 */
export async function cleanProcessedImageBlobWithAudit(
  blob: Blob,
  filename: string,
  mimeType: ResolvedImageMime,
  signal?: AbortSignal
): Promise<CleanedMediaAudit> {
  const stripResult = await stripBlobMetadataInWorker(
    blob,
    filename,
    {},
    signal
  );

  const cleanedCopy = new Uint8Array(stripResult.cleanedBuffer.byteLength);
  cleanedCopy.set(stripResult.cleanedBuffer);
  const cleanedBlob = new Blob([cleanedCopy.buffer], {
    type: stripResult.mimeType || mimeType,
  });
  if (cleanedBlob.size === 0) {
    throw new Error('Metadata cleaning produced an empty image file.');
  }
  return {
    blob: cleanedBlob,
    provenancePreserved: Boolean(stripResult.provenancePreserved),
    unverifiedMetadataRemoval: Boolean(stripResult.unverifiedMetadataRemoval),
  };
}

/**
 * Runs the existing StripMeta metadata engine (with ICC color profile and
 * C2PA/provenance preservation enabled) on a processed image Blob.
 */
export async function cleanProcessedImageBlob(
  blob: Blob,
  filename: string,
  mimeType: ResolvedImageMime,
  signal?: AbortSignal
): Promise<Blob> {
  const { blob: cleanedBlob } = await cleanProcessedImageBlobWithAudit(
    blob,
    filename,
    mimeType,
    signal
  );
  return cleanedBlob;
}

/**
 * Removes Gemini watermarks from an image File entirely in the browser,
 * then cleans privacy-sensitive metadata via the StripMeta engine.
 * Caller is responsible for revoking `originalUrl` and `previewUrl` when done.
 */
export async function removeGeminiWatermarkFromFile(
  file: File,
  options: {
    adaptiveMode?: AdaptiveMode;
    outputFormat?: OutputFormat;
    engine?: WatermarkEngine;
    signal?: AbortSignal;
    onProgress?: (progress: GifWatermarkProgress) => void;
  } = {}
): Promise<ProcessedWatermarkResult> {
  const adaptiveMode = options.adaptiveMode ?? 'auto';
  const outputFormat = options.outputFormat ?? 'auto';
  const originalUrl = URL.createObjectURL(file);

  try {
    const startedAt = performance.now();
    const { mimeType, extension } = resolveOutputMimeType(
      file.type,
      outputFormat,
      file.name
    );
    const outputName = buildCleanFilename(file.name, extension);
    const isGif = isGifImage(file.type, file.name) || mimeType === 'image/gif';

    if (!options.engine) {
      const workerResult = await processGeminiImageInWorker(
        file,
        outputName,
        mimeType,
        adaptiveMode,
        options.signal,
        options.onProgress
      );
      if (workerResult) {
        const cleanedCopy = new Uint8Array(workerResult.result.cleanedBuffer.byteLength);
        cleanedCopy.set(workerResult.result.cleanedBuffer);
        const blob = new Blob([cleanedCopy.buffer], {
          type: workerResult.result.mimeType || mimeType,
        });
        if (blob.size === 0) {
          throw new Error('Metadata cleaning produced an empty image file.');
        }
        const previewUrl = URL.createObjectURL(blob);
        const elapsedMs = Math.round(performance.now() - startedAt);
        return {
          blob,
          previewUrl,
          originalUrl,
          width: workerResult.width,
          height: workerResult.height,
          meta: (workerResult.meta as WatermarkMeta | null) ?? null,
          elapsedMs,
          outputName,
          mimeType,
          ...(workerResult.frameCount !== undefined
            ? { frameCount: workerResult.frameCount }
            : {}),
          ...(workerResult.animated !== undefined
            ? { animated: workerResult.animated }
            : {}),
          ...(workerResult.result.provenancePreserved ? { provenancePreserved: true } : {}),
          ...(workerResult.result.unverifiedMetadataRemoval
            ? { unverifiedMetadataRemoval: true }
            : {}),
        };
      }

      if (typeof window !== 'undefined' && file.size > MAX_MAIN_THREAD_FALLBACK_BYTES) {
        throw new Error(
          'Background OffscreenCanvas worker is unavailable on this browser. Images larger than 10 MB cannot be processed on the main thread.'
        );
      }
    }

    if (isGif) {
      const gifBytes = new Uint8Array(await file.arrayBuffer());
      const gifProcessed = await processGeminiGifBuffer(gifBytes, outputName, {
        adaptiveMode,
        engine: options.engine,
        signal: options.signal,
        onProgress: options.onProgress,
      });
      const cleanedCopy = new Uint8Array(gifProcessed.result.cleanedBuffer.byteLength);
      cleanedCopy.set(gifProcessed.result.cleanedBuffer);
      const blob = new Blob([cleanedCopy.buffer], {
        type: gifProcessed.result.mimeType || 'image/gif',
      });
      if (blob.size === 0) {
        throw new Error('Metadata cleaning produced an empty GIF file.');
      }
      const previewUrl = URL.createObjectURL(blob);
      const elapsedMs = Math.round(performance.now() - startedAt);
      return {
        blob,
        previewUrl,
        originalUrl,
        width: gifProcessed.width,
        height: gifProcessed.height,
        meta: gifProcessed.meta,
        elapsedMs,
        outputName,
        mimeType: 'image/gif',
        frameCount: gifProcessed.frameCount,
        animated: gifProcessed.animated,
        ...(gifProcessed.result.provenancePreserved ? { provenancePreserved: true } : {}),
        ...(gifProcessed.result.unverifiedMetadataRemoval
          ? { unverifiedMetadataRemoval: true }
          : {}),
      };
    }

    const image = await loadHtmlImage(originalUrl);
    const engine = options.engine ?? (await getSharedWatermarkEngine());
    const { canvas, meta } = await removeWatermarkFromImage(image, {
      engine,
      adaptiveMode,
    });

    const canvasBlob = await canvasToImageBlob(canvas, mimeType);
    const {
      blob,
      provenancePreserved,
      unverifiedMetadataRemoval,
    } = await cleanProcessedImageBlobWithAudit(
      canvasBlob,
      outputName,
      mimeType,
      options.signal
    );
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
      outputName,
      mimeType,
      ...(provenancePreserved ? { provenancePreserved: true } : {}),
      ...(unverifiedMetadataRemoval ? { unverifiedMetadataRemoval: true } : {}),
    };
  } catch (error) {
    URL.revokeObjectURL(originalUrl);
    throw error;
  }
}

import {
  detectGeminiVideoWatermark,
  removeGeminiVideoWatermark,
  VIDEO_DENOISE_BACKENDS,
  type VideoDetectionSummary,
  type VideoExportResult,
  type VideoMetadata,
  type VideoProgressEvent,
} from '@/lib/gwr-video/videoExport.js';
import { getAutomaticVideoPresetConfig } from '@/lib/gwr-video/videoPresetPolicy.js';
import {
  resolveAllenkFdncnnRuntimeProfile,
  type AllenkProfile,
} from '@/lib/gwr-video/videoDenoiseRuntimePolicy.js';
import { stripBlobMetadataInWorker } from '@/lib/worker/workerRunner';

export type VideoDenoiseMode = 'auto' | 'ai' | 'fast' | 'none';

export interface ProcessedVideoResult {
  blob: Blob;
  previewUrl: string;
  originalUrl: string;
  outputName: string;
  elapsedMs: number;
  exportResult: VideoExportResult;
  provenancePreserved?: boolean;
  unverifiedMetadataRemoval?: boolean;
}

export interface VideoProgressUpdate {
  phase: 'detect' | 'model' | 'encode';
  progress: number;
  message: string;
}

const ALLENK_WASM_PATHS = {
  mjs: '/gemini-video/onnxruntime/ort-wasm-simd-threaded.mjs',
  wasm: '/gemini-video/onnxruntime/ort-wasm-simd-threaded.wasm',
};

const ALLENK_WEBGPU_WASM_PATHS = {
  mjs: '/gemini-video/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs',
  wasm: '/gemini-video/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm',
};

const runtimeCache = new Map<string, Promise<{ id: string; executionProvider: string }>>();

export function buildCleanVideoFilename(originalName: string): string {
  const trimmed = originalName.trim() || 'video';
  const lastDot = trimmed.lastIndexOf('.');
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  return `${base}-clean.mp4`;
}

export function isWebCodecsSupported(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { VideoDecoder?: unknown }).VideoDecoder === 'function' &&
    typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === 'function'
  );
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function loadOnnxRuntime(profile: AllenkProfile, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const cached = runtimeCache.get(profile.id);
  if (cached) return cached;

  const promise = (async () => {
    const response = await fetch(profile.modelUrl, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load ONNX model (${response.status})`);
    }
    const modelBytes = new Uint8Array(await response.arrayBuffer());
    signal?.throwIfAborted();

    const { createAllenkFdncnnOnnxRuntime } = await import(
      '@gwr-core/allenkFdncnnOnnxRuntime.js'
    );
    signal?.throwIfAborted();

    const nav = globalThis.navigator as { gpu?: unknown } | undefined;
    if (nav?.gpu) {
      try {
        const webgpuOrt = await import('onnxruntime-web/webgpu');
        signal?.throwIfAborted();
        return await createAllenkFdncnnOnnxRuntime({
          ort: webgpuOrt,
          modelBytes,
          executionProvider: 'webgpu',
          wasmPaths: ALLENK_WEBGPU_WASM_PATHS,
          inputName: 'fdncnn_input',
          outputName: 'fdncnn_output',
          inputShape: profile.inputShape,
          outputShape: profile.outputShape,
        });
      } catch {
        signal?.throwIfAborted();
      }
    }

    return await createAllenkFdncnnOnnxRuntime({
      modelBytes,
      executionProvider: 'wasm',
      wasmPaths: ALLENK_WASM_PATHS,
      inputName: 'fdncnn_input',
      outputName: 'fdncnn_output',
      inputShape: profile.inputShape,
      outputShape: profile.outputShape,
    });
  })();

  runtimeCache.set(profile.id, promise);
  promise.catch(() => {
    if (runtimeCache.get(profile.id) === promise) {
      runtimeCache.delete(profile.id);
    }
  });

  return promise;
}

export interface CleanedVideoAudit {
  blob: Blob;
  provenancePreserved: boolean;
  unverifiedMetadataRemoval: boolean;
}

/**
 * Runs the existing StripMeta ISOBMFF/MP4 metadata engine in a Web Worker
 * (preserving C2PA/Content Credentials provenance) on the exported MP4 Blob
 * and returns both the cleaned Blob and metadata-audit flags.
 */
export async function cleanProcessedVideoBlobWithAudit(
  blob: Blob,
  filename: string,
  signal?: AbortSignal
): Promise<CleanedVideoAudit> {
  const stripResult = await stripBlobMetadataInWorker(
    blob,
    filename,
    {
      stripAll: true,
      preserveProvenance: true,
    },
    signal
  );

  const cleanedCopy = new Uint8Array(stripResult.cleanedBuffer.byteLength);
  cleanedCopy.set(stripResult.cleanedBuffer);
  const cleanedBlob = new Blob([cleanedCopy.buffer], {
    type: stripResult.mimeType || 'video/mp4',
  });
  if (cleanedBlob.size === 0) {
    throw new Error('Metadata cleaning produced an empty MP4 file.');
  }
  return {
    blob: cleanedBlob,
    provenancePreserved: Boolean(stripResult.provenancePreserved),
    unverifiedMetadataRemoval: Boolean(stripResult.unverifiedMetadataRemoval),
  };
}

/**
 * Runs the existing StripMeta ISOBMFF/MP4 metadata engine in a Web Worker
 * (preserving C2PA/Content Credentials provenance) on the exported MP4 Blob.
 */
export async function cleanProcessedVideoBlob(
  blob: Blob,
  filename: string,
  signal?: AbortSignal
): Promise<Blob> {
  const { blob: cleanedBlob } = await cleanProcessedVideoBlobWithAudit(
    blob,
    filename,
    signal
  );
  return cleanedBlob;
}

/**
 * Removes Gemini/Veo watermarks from a video File locally in the browser using WebCodecs,
 * then strips privacy-sensitive container metadata from the exported MP4 in a Web Worker.
 */
export async function removeGeminiWatermarkFromVideo(
  file: File,
  options: {
    denoiseMode?: VideoDenoiseMode;
    allowLowConfidence?: boolean;
    preserveAudio?: boolean;
    signal?: AbortSignal;
    onProgress?: (update: VideoProgressUpdate) => void;
  } = {}
): Promise<ProcessedVideoResult> {
  if (!isWebCodecsSupported()) {
    throw new Error(
      'Your browser does not support WebCodecs (VideoDecoder/VideoEncoder). Please use a modern Chromium-based browser (Chrome, Edge, Brave).'
    );
  }

  const denoiseMode = options.denoiseMode ?? 'auto';
  const allowLowConfidence = options.allowLowConfidence ?? true;
  const preserveAudio = options.preserveAudio ?? true;
  const onProgress = options.onProgress ?? (() => {});
  const originalUrl = URL.createObjectURL(file);

  try {
    const startedAt = performance.now();

    onProgress({
      phase: 'detect',
      progress: 0.02,
      message: 'Sampling video frames to locate Gemini/Veo watermark…',
    });

    const detected: { metadata: VideoMetadata; detection: VideoDetectionSummary } =
      await detectGeminiVideoWatermark(file, {
        signal: options.signal,
        sampleCount: 12,
        yieldToMainThread,
        onProgress: (ev: VideoProgressEvent) => {
          onProgress({
            phase: 'detect',
            progress: Math.min(0.2, (ev.progress || 0) * 0.2),
            message: 'Detecting watermark signature and anchor position…',
          });
        },
      });

    options.signal?.throwIfAborted();

    const preset = getAutomaticVideoPresetConfig(
      detected.detection,
      detected.metadata
    );

    let denoiseBackend = preset.denoiseBackend;
    if (denoiseMode === 'ai') {
      denoiseBackend = VIDEO_DENOISE_BACKENDS.ALLENK_FDNCNN_BROWSER_SPIKE;
    } else if (denoiseMode === 'fast') {
      denoiseBackend = VIDEO_DENOISE_BACKENDS.CANVAS_FOOTPRINT_POLISH;
    } else if (denoiseMode === 'none') {
      denoiseBackend = VIDEO_DENOISE_BACKENDS.NONE;
    }

    let allenkFdncnnRuntime: { id: string; executionProvider: string } | undefined;
    if (denoiseBackend === VIDEO_DENOISE_BACKENDS.ALLENK_FDNCNN_BROWSER_SPIKE) {
      onProgress({
        phase: 'model',
        progress: 0.22,
        message: 'Loading local ONNX AI cleanup model…',
      });
      try {
        const profile = resolveAllenkFdncnnRuntimeProfile(
          detected.detection?.position
        );
        allenkFdncnnRuntime = await loadOnnxRuntime(profile, options.signal);
      } catch (err) {
        if (options.signal?.aborted) throw err;
        // Fallback to fast canvas polish if ONNX runtime cannot initialize
        denoiseBackend = VIDEO_DENOISE_BACKENDS.CANVAS_FOOTPRINT_POLISH;
      }
    }

    options.signal?.throwIfAborted();

    const exportResult = await removeGeminiVideoWatermark(file, {
      signal: options.signal,
      detection: detected,
      alphaGain: preset.alphaGain,
      adaptiveAlpha: preset.adaptiveAlpha,
      highQualityCleanup: preset.highQualityCleanup,
      denoiseBackend,
      edgeDenoiseStrength: preset.edgeDenoiseStrength,
      residualCleanupStrength: preset.residualCleanupStrength,
      videoBitrate: preset.videoBitrateMbps * 1_000_000,
      sampleCount: preset.sampleCount,
      allowLowConfidence,
      preserveAudio,
      allenkFdncnnRuntime,
      allenkFdncnnTemporalReuse: allenkFdncnnRuntime?.executionProvider === 'wasm',
      allenkFdncnnReuseThreshold: 6.5,
      yieldToMainThread,
      onProgress: (ev: VideoProgressEvent) => {
        const mapped = 0.25 + Math.max(0, Math.min(1, ev.progress || 0)) * 0.7;
        onProgress({
          phase: 'encode',
          progress: mapped,
          message:
            ev.totalFrames && ev.frameIndex != null
              ? `Processing frame ${ev.frameIndex} / ${ev.totalFrames}…`
              : 'Removing watermark & encoding MP4…',
        });
      },
    });

    options.signal?.throwIfAborted();
    const outputName = buildCleanVideoFilename(file.name);
    onProgress({
      phase: 'encode',
      progress: 0.96,
      message: 'Removing privacy metadata from MP4 container…',
    });

    const {
      blob: cleanedBlob,
      provenancePreserved,
      unverifiedMetadataRemoval,
    } = await cleanProcessedVideoBlobWithAudit(
      exportResult.blob,
      outputName,
      options.signal
    );
    const finalExportResult: VideoExportResult = {
      ...exportResult,
      blob: cleanedBlob,
    };

    const previewUrl = URL.createObjectURL(cleanedBlob);
    const elapsedMs = Math.round(performance.now() - startedAt);

    onProgress({
      phase: 'encode',
      progress: 1,
      message: 'Completed',
    });

    return {
      blob: cleanedBlob,
      previewUrl,
      originalUrl,
      outputName,
      elapsedMs,
      exportResult: finalExportResult,
      ...(provenancePreserved ? { provenancePreserved: true } : {}),
      ...(unverifiedMetadataRemoval ? { unverifiedMetadataRemoval: true } : {}),
    };
  } catch (error) {
    URL.revokeObjectURL(originalUrl);
    throw error;
  }
}

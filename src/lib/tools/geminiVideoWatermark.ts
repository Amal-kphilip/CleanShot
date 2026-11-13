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

export type VideoDenoiseMode = 'auto' | 'ai' | 'fast' | 'none';

export interface ProcessedVideoResult {
  blob: Blob;
  previewUrl: string;
  originalUrl: string;
  outputName: string;
  elapsedMs: number;
  exportResult: VideoExportResult;
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

/**
 * Removes Gemini/Veo watermarks from a video File locally in the browser using WebCodecs.
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
        const mapped = 0.25 + Math.max(0, Math.min(1, ev.progress || 0)) * 0.75;
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

    const previewUrl = URL.createObjectURL(exportResult.blob);
    const elapsedMs = Math.round(performance.now() - startedAt);

    return {
      blob: exportResult.blob,
      previewUrl,
      originalUrl,
      outputName: buildCleanVideoFilename(file.name),
      elapsedMs,
      exportResult,
    };
  } catch (error) {
    URL.revokeObjectURL(originalUrl);
    throw error;
  }
}

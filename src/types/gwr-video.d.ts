declare module '@/lib/gwr-video/videoExport.js' {
  export const DEFAULT_SAMPLE_COUNT: number;
  export const DEFAULT_ALPHA_GAIN: number;
  export const DEFAULT_ADAPTIVE_ALPHA: boolean;
  export const DEFAULT_VIDEO_BITRATE: number;
  export const VIDEO_DENOISE_BACKENDS: {
    NONE: string;
    ALLENK_FDNCNN_BROWSER_SPIKE: string;
    CANVAS_EDGE_DENOISE: string;
    CANVAS_EDGE_BAND_DENOISE: string;
    CANVAS_EDGE_CORE_DENOISE: string;
    CANVAS_FOOTPRINT_POLISH: string;
    CANVAS_TEMPORAL_DELTA_STABILIZE: string;
    CANVAS_TEMPORAL_MATCH_DELTA_STABILIZE: string;
    CANVAS_TEMPORAL_STABILIZE: string;
    CANVAS_TEXTURE_REPAIR: string;
  };

  export interface VideoMetadata {
    width: number;
    height: number;
    duration: number;
    firstTimestamp?: number;
    frameRate?: number;
    codec?: string;
    hasAudio?: boolean;
  }

  export interface VideoWatermarkPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    marginRight?: number;
    marginBottom?: number;
  }

  export interface VideoDetectionSummary {
    isConfident: boolean;
    confidence?: number;
    position?: VideoWatermarkPosition | null;
    summary?: {
      best?: {
        id?: string;
        label?: string;
        confidence?: number;
      } | null;
    } | null;
    alphaSeed?: {
      seedGain?: number;
    } | null;
  }

  export interface VideoProgressEvent {
    phase: 'detect' | 'encode' | string;
    step?: string;
    progress: number;
    metadata?: VideoMetadata;
    detection?: VideoDetectionSummary;
    frameIndex?: number;
    totalFrames?: number;
  }

  export interface VideoExportResult {
    blob: Blob;
    metadata: VideoMetadata;
    detection: VideoDetectionSummary;
    alphaGain: number;
    adaptiveAlpha: boolean;
    highQualityCleanup: boolean;
    denoiseBackend: string;
    processedFrames: number;
    skippedFrames: number;
    aiDenoiseFrames: number;
    audioCopied: boolean;
  }

  export function inspectGeminiVideoFile(file: File): Promise<VideoMetadata & { candidates?: unknown[] }>;
  export function detectGeminiVideoWatermark(
    file: File,
    options?: {
      signal?: AbortSignal;
      sampleCount?: number;
      onProgress?: (event: VideoProgressEvent) => void;
      yieldToMainThread?: () => Promise<void>;
    }
  ): Promise<{ metadata: VideoMetadata; detection: VideoDetectionSummary }>;
  export function removeGeminiVideoWatermark(
    file: File,
    options?: {
      signal?: AbortSignal;
      detection?: { metadata: VideoMetadata; detection: VideoDetectionSummary };
      alphaGain?: number;
      adaptiveAlpha?: boolean;
      highQualityCleanup?: boolean;
      denoiseBackend?: string;
      edgeDenoiseStrength?: number;
      residualCleanupStrength?: number;
      videoBitrate?: number;
      sampleCount?: number;
      allowLowConfidence?: boolean;
      preserveAudio?: boolean;
      allenkFdncnnRuntime?: unknown;
      allenkFdncnnTemporalReuse?: boolean;
      allenkFdncnnReuseThreshold?: number;
      onProgress?: (event: VideoProgressEvent) => void;
      yieldToMainThread?: () => Promise<void>;
    }
  ): Promise<VideoExportResult>;
}

declare module '@/lib/gwr-video/videoPresetPolicy.js' {
  import type { VideoDetectionSummary, VideoMetadata } from '@/lib/gwr-video/videoExport.js';

  export interface VideoPresetConfig {
    id: string;
    label: string;
    description: string;
    alphaGain: number;
    adaptiveAlpha: boolean;
    highQualityCleanup: boolean;
    denoiseBackend: string;
    edgeDenoiseStrength: number;
    residualCleanupStrength: number;
    sampleCount: number;
    videoBitrateMbps: number;
    allowLowConfidence: boolean;
  }

  export function getAutomaticVideoPresetConfig(
    detection?: VideoDetectionSummary | null,
    metadata?: VideoMetadata | null
  ): VideoPresetConfig;
}

declare module '@/lib/gwr-video/videoDenoiseRuntimePolicy.js' {
  import type { VideoWatermarkPosition } from '@/lib/gwr-video/videoExport.js';

  export interface AllenkProfile {
    id: string;
    modelSize: number;
    modelWidth: number;
    modelHeight: number;
    modelUrl: string;
    inputShape: number[];
    outputShape: number[];
    padding: number;
  }

  export function resolveAllenkFdncnnRuntimeProfile(
    position?: VideoWatermarkPosition | null
  ): AllenkProfile;
}

declare module '@gwr-core/allenkFdncnnOnnxRuntime.js' {
  export function createAllenkFdncnnOnnxRuntime(options: {
    ort?: unknown;
    modelBytes: Uint8Array;
    executionProvider: 'wasm' | 'webgpu';
    wasmPaths?: { mjs: string; wasm: string };
    inputName: string;
    outputName: string;
    inputShape: number[];
    outputShape: number[];
  }): Promise<{
    id: string;
    executionProvider: string;
  }>;
}

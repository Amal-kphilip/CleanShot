declare module '@gwr-core/blendModes.js' {
  export function removeWatermark(
    imageData: { width: number; height: number; data: Uint8ClampedArray },
    alphaMap: Float32Array,
    position: { x: number; y: number; width: number; height: number },
    options?: { alphaGain?: number; logoValue?: number },
  ): void;
}

declare module '@/lib/gwr-video/veoTextWatermarkTemplates.js' {
  export interface VeoTextWatermarkTemplate {
    id: string;
    width: number;
    height: number;
    marginRight: number;
    marginBottom: number;
    alphaMap: Float32Array;
    detectorMap: Float32Array;
    observedSeedScale?: number;
  }
  export function getVeoTextWatermarkTemplates(): VeoTextWatermarkTemplate[];
}

declare module '@/lib/gwr-video/veoTextWatermarkDetector.js' {
  import type { VeoTextWatermarkTemplate } from '@/lib/gwr-video/veoTextWatermarkTemplates.js';

  export interface VeoTextSearchCandidate {
    id: string;
    watermarkKind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    marginRight: number;
    marginBottom: number;
    template: VeoTextWatermarkTemplate;
  }

  export function resolveVeoTextSearchCandidates(options?: {
    width?: number;
    height?: number;
    templates?: VeoTextWatermarkTemplate[];
    marginRadiusX?: number | null;
    marginRadiusY?: number | null;
  }): VeoTextSearchCandidate[];
}

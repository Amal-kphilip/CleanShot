import {
  createWatermarkEngine,
  detectWatermarkConfig,
  calculateWatermarkPosition,
  removeRepeatedWatermarkLayers,
  removeWatermarkFromImageData,
  removeWatermarkFromImageDataSync,
  type WatermarkEngine,
  type WatermarkMeta,
  type WatermarkPosition,
} from '@pilio/gemini-watermark-remover/image-data';
import { stripImageMetadata } from '../engine/stripper';
import { StripResult } from '../engine/types';
import {
  decodeGif,
  encodeGif,
  type EncodedGifFrameInput,
  type GifFrame,
} from './gifCodec';

export type GifAdaptiveMode = 'auto' | 'always' | 'off';

export interface GifWatermarkProgress {
  currentFrame: number;
  totalFrames: number;
  progress: number;
  message: string;
}

export interface ProcessedGifWatermarkBufferResult {
  width: number;
  height: number;
  frameCount: number;
  animated: boolean;
  meta: WatermarkMeta | null;
  unchanged?: boolean;
  result: StripResult;
}

/**
 * Checks whether a filename or MIME type represents a GIF image.
 */
export function isGifImage(sourceMimeType: string, filename = ''): boolean {
  if (sourceMimeType.trim().toLowerCase() === 'image/gif') return true;
  return /\.gif$/i.test(filename.trim());
}

function compositeFrameOntoCanvas(
  canvas: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  frame: {
    left: number;
    top: number;
    width: number;
    height: number;
    transparentIndex: number;
    indices: Uint8Array;
  },
  palette: Uint8Array,
): void {
  const maxPaletteIdx = Math.floor(palette.length / 3) - 1;
  for (let fy = 0; fy < frame.height; fy++) {
    const cy = frame.top + fy;
    if (cy < 0 || cy >= screenHeight) continue;
    const rowOff = fy * frame.width;
    const canvasRowOff = cy * screenWidth;

    for (let fx = 0; fx < frame.width; fx++) {
      const cx = frame.left + fx;
      if (cx < 0 || cx >= screenWidth) continue;
      const idx = frame.indices[rowOff + fx];
      if (idx === frame.transparentIndex) continue;

      const safeIdx = Math.min(idx, maxPaletteIdx);
      const pOff = safeIdx * 3;
      const cOff = (canvasRowOff + cx) * 4;
      canvas[cOff] = palette[pOff];
      canvas[cOff + 1] = palette[pOff + 1];
      canvas[cOff + 2] = palette[pOff + 2];
      canvas[cOff + 3] = 255;
    }
  }
}

function applyDisposalMethod(
  canvas: Uint8ClampedArray,
  previousCanvas: Uint8ClampedArray | null,
  screenWidth: number,
  screenHeight: number,
  disposalMethod: number,
  rect: { left: number; top: number; width: number; height: number },
): void {
  if (disposalMethod === 2) {
    // Restore to background/transparent
    const x0 = Math.max(0, rect.left);
    const y0 = Math.max(0, rect.top);
    const x1 = Math.min(screenWidth, rect.left + rect.width);
    const y1 = Math.min(screenHeight, rect.top + rect.height);
    for (let cy = y0; cy < y1; cy++) {
      const rowOff = cy * screenWidth;
      for (let cx = x0; cx < x1; cx++) {
        const cOff = (rowOff + cx) * 4;
        canvas[cOff] = 0;
        canvas[cOff + 1] = 0;
        canvas[cOff + 2] = 0;
        canvas[cOff + 3] = 0;
      }
    }
  } else if (disposalMethod === 3 && previousCanvas) {
    // Restore to previous state
    canvas.set(previousCanvas);
  }
}

const REFINER_PAD = 12;

interface RegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getPaddedRegion(
  pos: WatermarkPosition,
  screenWidth: number,
  screenHeight: number,
  pad = REFINER_PAD,
): RegionBox {
  const x = Math.max(0, pos.x - pad);
  const y = Math.max(0, pos.y - pad);
  const right = Math.min(screenWidth, pos.x + pos.width + pad);
  const bottom = Math.min(screenHeight, pos.y + pos.height + pad);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function extractPatchRgba(
  canvas: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  pos: RegionBox,
): Uint8ClampedArray {
  const patch = new Uint8ClampedArray(pos.width * pos.height * 4);
  for (let row = 0; row < pos.height; row++) {
    const cy = pos.y + row;
    if (cy < 0 || cy >= screenHeight) continue;
    for (let col = 0; col < pos.width; col++) {
      const cx = pos.x + col;
      if (cx < 0 || cx >= screenWidth) continue;
      const srcOff = (cy * screenWidth + cx) * 4;
      const dstOff = (row * pos.width + col) * 4;
      patch[dstOff] = canvas[srcOff];
      patch[dstOff + 1] = canvas[srcOff + 1];
      patch[dstOff + 2] = canvas[srcOff + 2];
      patch[dstOff + 3] = canvas[srcOff + 3];
    }
  }
  return patch;
}

function applyPatchRgba(
  canvas: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  pos: RegionBox,
  patch: Uint8ClampedArray,
): void {
  for (let row = 0; row < pos.height; row++) {
    const cy = pos.y + row;
    if (cy < 0 || cy >= screenHeight) continue;
    for (let col = 0; col < pos.width; col++) {
      const cx = pos.x + col;
      if (cx < 0 || cx >= screenWidth) continue;
      const dstOff = (cy * screenWidth + cx) * 4;
      // Preserve transparent pixels
      if (canvas[dstOff + 3] === 0) continue;
      const srcOff = (row * pos.width + col) * 4;
      canvas[dstOff] = patch[srcOff];
      canvas[dstOff + 1] = patch[srcOff + 1];
      canvas[dstOff + 2] = patch[srcOff + 2];
    }
  }
}

function patchesEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function hasOpaquePixelsInRegion(
  canvas: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  pos: WatermarkPosition,
): boolean {
  const x0 = Math.max(0, pos.x);
  const y0 = Math.max(0, pos.y);
  const x1 = Math.min(screenWidth, pos.x + pos.width);
  const y1 = Math.min(screenHeight, pos.y + pos.height);
  for (let cy = y0; cy < y1; cy++) {
    const rowOff = cy * screenWidth;
    for (let cx = x0; cx < x1; cx++) {
      if (canvas[(rowOff + cx) * 4 + 3] > 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Creates a copy of `canvas` where any transparent (`alpha === 0`) pixels have
 * their RGB filled with the mean RGB of nearby opaque pixels (in the bottom-right
 * region or full frame). This prevents invisible transparent-black `(0, 0, 0)`
 * pixels from distorting RGB-based watermark detection and alpha estimation.
 */
function prepareCanvasCopyForWatermarkEngine(
  canvas: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  hintRegion?: RegionBox,
): Uint8ClampedArray {
  const copy = new Uint8ClampedArray(canvas);
  let hasTransparent = false;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let opaqueCount = 0;

  if (hintRegion) {
    const x0 = Math.max(0, hintRegion.x);
    const y0 = Math.max(0, hintRegion.y);
    const x1 = Math.min(screenWidth, hintRegion.x + hintRegion.width);
    const y1 = Math.min(screenHeight, hintRegion.y + hintRegion.height);
    for (let cy = y0; cy < y1; cy++) {
      const rowOff = cy * screenWidth;
      for (let cx = x0; cx < x1; cx++) {
        const off = (rowOff + cx) * 4;
        if (copy[off + 3] === 0) {
          hasTransparent = true;
        } else {
          sumR += copy[off];
          sumG += copy[off + 1];
          sumB += copy[off + 2];
          opaqueCount++;
        }
      }
    }
  } else {
    for (let i = 0; i < copy.length; i += 4) {
      if (copy[i + 3] === 0) {
        hasTransparent = true;
      } else {
        sumR += copy[i];
        sumG += copy[i + 1];
        sumB += copy[i + 2];
        opaqueCount++;
      }
    }
  }

  if (!hasTransparent) return copy;

  // If hintRegion had no opaque pixels, compute global opaque mean
  if (opaqueCount === 0 && hintRegion) {
    for (let i = 0; i < copy.length; i += 4) {
      if (copy[i + 3] > 0) {
        sumR += copy[i];
        sumG += copy[i + 1];
        sumB += copy[i + 2];
        opaqueCount++;
      }
    }
  }

  if (opaqueCount === 0) return copy;

  const fillR = Math.round(sumR / opaqueCount);
  const fillG = Math.round(sumG / opaqueCount);
  const fillB = Math.round(sumB / opaqueCount);

  for (let i = 0; i < copy.length; i += 4) {
    if (copy[i + 3] === 0) {
      copy[i] = fillR;
      copy[i + 1] = fillG;
      copy[i + 2] = fillB;
      copy[i + 3] = 255;
    }
  }

  return copy;
}

function colorDistSq(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return 3 * dr * dr + 4 * dg * dg + 2 * db * db;
}

/**
 * Quantizes a modified frame while preserving the original palette entries for all
 * untouched pixels and allocating dedicated palette entries for the watermark-restored region.
 */
function quantizeModifiedFrame(params: {
  outLeft: number;
  outTop: number;
  outWidth: number;
  outHeight: number;
  screenWidth: number;
  origFrame: GifFrame;
  origPalette: Uint8Array;
  origCanvas: Uint8ClampedArray;
  cleanedCanvas: Uint8ClampedArray;
  outCanvasBefore: Uint8ClampedArray;
}): {
  palette: Uint8Array;
  indices: Uint8Array;
  transparentIndex: number;
} {
  const {
    outLeft,
    outTop,
    outWidth,
    outHeight,
    screenWidth,
    origFrame,
    origPalette,
    origCanvas,
    cleanedCanvas,
    outCanvasBefore,
  } = params;

  const pixelCount = outWidth * outHeight;
  const maxOrigPaletteEntries = Math.floor(origPalette.length / 3);

  // Per-pixel classification:
  // -2 = transparent
  // >= 0 = preserved original palette index `origIdx`
  // -1 = watermark-modified / newly exposed opaque pixel needing RGB from `cleanedCanvas`
  const pixelOrigIdx = new Int16Array(pixelCount);
  const origIdxCounts = new Uint32Array(256);
  const modifiedColorCounts = new Map<number, number>();
  let hasTransparency = false;

  const origRight = origFrame.left + origFrame.width;
  const origBottom = origFrame.top + origFrame.height;

  for (let fy = 0; fy < outHeight; fy++) {
    const cy = outTop + fy;
    const rowOff = fy * outWidth;
    const canvasRowOff = cy * screenWidth;
    const inOrigY = cy >= origFrame.top && cy < origBottom;

    for (let fx = 0; fx < outWidth; fx++) {
      const cx = outLeft + fx;
      const pIdx = rowOff + fx;
      const cOff = (canvasRowOff + cx) * 4;

      // Target pixel is transparent
      if (cleanedCanvas[cOff + 3] === 0) {
        pixelOrigIdx[pIdx] = -2;
        hasTransparency = true;
        continue;
      }

      const inOrig = inOrigY && cx >= origFrame.left && cx < origRight;
      const origFrameIdx = inOrig
        ? origFrame.indices[(cy - origFrame.top) * origFrame.width + (cx - origFrame.left)]
        : origFrame.transparentIndex;

      const targetR = cleanedCanvas[cOff];
      const targetG = cleanedCanvas[cOff + 1];
      const targetB = cleanedCanvas[cOff + 2];

      // If original frame left this pixel transparent and outCanvasBefore already has the target color
      // (within 1-2 LSB quantization tolerance of the already-cleaned previous frame),
      // keep it transparent so partial-frame transparency is preserved without shimmer.
      if (
        origFrameIdx === origFrame.transparentIndex &&
        outCanvasBefore[cOff + 3] === 255 &&
        colorDistSq(
          outCanvasBefore[cOff],
          outCanvasBefore[cOff + 1],
          outCanvasBefore[cOff + 2],
          targetR,
          targetG,
          targetB,
        ) <= 27
      ) {
        pixelOrigIdx[pIdx] = -2;
        hasTransparency = true;
        continue;
      }

      // If pixel was opaque in original frame and its RGB was not modified by watermark removal,
      // preserve its original palette index directly.
      if (
        inOrig &&
        origFrameIdx !== origFrame.transparentIndex &&
        origFrameIdx < maxOrigPaletteEntries &&
        targetR === origCanvas[cOff] &&
        targetG === origCanvas[cOff + 1] &&
        targetB === origCanvas[cOff + 2]
      ) {
        pixelOrigIdx[pIdx] = origFrameIdx;
        origIdxCounts[origFrameIdx]++;
        continue;
      }

      // Otherwise this pixel was modified by watermark removal
      pixelOrigIdx[pIdx] = -1;
      const rgb24 = (targetR << 16) | (targetG << 8) | targetB;
      modifiedColorCounts.set(rgb24, (modifiedColorCounts.get(rgb24) ?? 0) + 1);
    }
  }

  const usedOrigIndices: number[] = [];
  for (let idx = 0; idx < maxOrigPaletteEntries; idx++) {
    if (origIdxCounts[idx] > 0) {
      usedOrigIndices.push(idx);
    }
  }

  const maxOpaqueSlots = hasTransparency ? 255 : 256;

  // Filter out modified colors that already exist (within tiny distance <= 3) in usedOrigIndices
  const distinctModifiedColors: Array<{ rgb: number; r: number; g: number; b: number; count: number }> = [];
  for (const [rgb, count] of modifiedColorCounts.entries()) {
    const r = (rgb >>> 16) & 0xff;
    const g = (rgb >>> 8) & 0xff;
    const b = rgb & 0xff;
    let alreadyInOrig = false;
    for (const origIdx of usedOrigIndices) {
      const pOff = origIdx * 3;
      if (
        colorDistSq(r, g, b, origPalette[pOff], origPalette[pOff + 1], origPalette[pOff + 2]) <= 3
      ) {
        alreadyInOrig = true;
        break;
      }
    }
    if (!alreadyInOrig) {
      distinctModifiedColors.push({ rgb, r, g, b, count });
    }
  }

  // Decide how many slots go to preserved original colors vs new watermark-restored colors
  const wmSlotsNeeded =
    usedOrigIndices.length + distinctModifiedColors.length <= maxOpaqueSlots
      ? distinctModifiedColors.length
      : Math.min(
          distinctModifiedColors.length,
          Math.max(24, maxOpaqueSlots - Math.min(usedOrigIndices.length, maxOpaqueSlots - 24)),
        );

  const origSlotsBudget = maxOpaqueSlots - wmSlotsNeeded;
  let keptOrigIndices = usedOrigIndices;
  if (usedOrigIndices.length > origSlotsBudget) {
    keptOrigIndices = [...usedOrigIndices]
      .sort((a, b) => origIdxCounts[b] - origIdxCounts[a])
      .slice(0, origSlotsBudget)
      .sort((a, b) => a - b);
  }

  const outPaletteColors: Array<[number, number, number]> = [];
  const origToNewIndex = new Int16Array(256).fill(-1);

  for (const origIdx of keptOrigIndices) {
    const newIdx = outPaletteColors.length;
    const pOff = origIdx * 3;
    outPaletteColors.push([origPalette[pOff], origPalette[pOff + 1], origPalette[pOff + 2]]);
    origToNewIndex[origIdx] = newIdx;
  }

  // Add watermark-restored colors
  if (distinctModifiedColors.length <= wmSlotsNeeded) {
    for (const c of distinctModifiedColors) {
      outPaletteColors.push([c.r, c.g, c.b]);
    }
  } else if (wmSlotsNeeded > 0) {
    // Deterministic frequency-weighted furthest-point sampling + 2-round k-means refinement
    const sortedByFreq = [...distinctModifiedColors].sort(
      (a, b) => b.count - a.count || a.rgb - b.rgb,
    );
    const centroids: Array<[number, number, number]> = [
      [sortedByFreq[0].r, sortedByFreq[0].g, sortedByFreq[0].b],
    ];
    const minDists = new Float64Array(sortedByFreq.length).fill(Infinity);

    while (centroids.length < wmSlotsNeeded) {
      const last = centroids[centroids.length - 1];
      let bestCandidateIdx = 0;
      let bestScore = -1;

      for (let i = 0; i < sortedByFreq.length; i++) {
        const c = sortedByFreq[i];
        const d = colorDistSq(c.r, c.g, c.b, last[0], last[1], last[2]);
        if (d < minDists[i]) minDists[i] = d;
        const score = minDists[i] * Math.sqrt(c.count);
        if (score > bestScore) {
          bestScore = score;
          bestCandidateIdx = i;
        }
      }
      const chosen = sortedByFreq[bestCandidateIdx];
      centroids.push([chosen.r, chosen.g, chosen.b]);
      minDists[bestCandidateIdx] = 0;
    }

    // 2 rounds of weighted k-means refinement
    for (let round = 0; round < 2; round++) {
      const sumR = new Float64Array(centroids.length);
      const sumG = new Float64Array(centroids.length);
      const sumB = new Float64Array(centroids.length);
      const sumW = new Float64Array(centroids.length);

      for (const c of sortedByFreq) {
        let bestK = 0;
        let bestDist = Infinity;
        for (let k = 0; k < centroids.length; k++) {
          const d = colorDistSq(c.r, c.g, c.b, centroids[k][0], centroids[k][1], centroids[k][2]);
          if (d < bestDist) {
            bestDist = d;
            bestK = k;
          }
        }
        sumR[bestK] += c.r * c.count;
        sumG[bestK] += c.g * c.count;
        sumB[bestK] += c.b * c.count;
        sumW[bestK] += c.count;
      }

      for (let k = 0; k < centroids.length; k++) {
        if (sumW[k] > 0) {
          centroids[k] = [
            Math.round(sumR[k] / sumW[k]),
            Math.round(sumG[k] / sumW[k]),
            Math.round(sumB[k] / sumW[k]),
          ];
        }
      }
    }

    for (const centroid of centroids) {
      outPaletteColors.push(centroid);
    }
  }

  while (outPaletteColors.length < 2) {
    outPaletteColors.push([0, 0, 0]);
  }

  let outTransparentIndex = -1;
  if (hasTransparency) {
    outTransparentIndex = outPaletteColors.length;
    outPaletteColors.push([0, 0, 0]);
  }

  const opaqueEntryCount = hasTransparency
    ? outPaletteColors.length - 1
    : outPaletteColors.length;

  const paletteBytes = new Uint8Array(outPaletteColors.length * 3);
  for (let i = 0; i < outPaletteColors.length; i++) {
    paletteBytes[i * 3] = outPaletteColors[i][0];
    paletteBytes[i * 3 + 1] = outPaletteColors[i][1];
    paletteBytes[i * 3 + 2] = outPaletteColors[i][2];
  }

  const nearestColorCache = new Map<number, number>();
  const findNearestOpaqueIndex = (r: number, g: number, b: number): number => {
    const key = (r << 16) | (g << 8) | b;
    const cached = nearestColorCache.get(key);
    if (cached !== undefined) return cached;

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < opaqueEntryCount; i++) {
      const pOff = i * 3;
      const d = colorDistSq(r, g, b, paletteBytes[pOff], paletteBytes[pOff + 1], paletteBytes[pOff + 2]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
        if (d === 0) break;
      }
    }
    nearestColorCache.set(key, bestIdx);
    return bestIdx;
  };

  // Map any unkept original palette indices to their nearest opaque index
  for (const origIdx of usedOrigIndices) {
    if (origToNewIndex[origIdx] === -1) {
      const pOff = origIdx * 3;
      origToNewIndex[origIdx] = findNearestOpaqueIndex(
        origPalette[pOff],
        origPalette[pOff + 1],
        origPalette[pOff + 2],
      );
    }
  }

  const outIndices = new Uint8Array(pixelCount);
  for (let fy = 0; fy < outHeight; fy++) {
    const cy = outTop + fy;
    const rowOff = fy * outWidth;
    const canvasRowOff = cy * screenWidth;

    for (let fx = 0; fx < outWidth; fx++) {
      const cx = outLeft + fx;
      const pIdx = rowOff + fx;
      const cls = pixelOrigIdx[pIdx];

      if (cls === -2) {
        outIndices[pIdx] = outTransparentIndex;
      } else if (cls >= 0) {
        outIndices[pIdx] = origToNewIndex[cls];
      } else {
        const cOff = (canvasRowOff + cx) * 4;
        outIndices[pIdx] = findNearestOpaqueIndex(
          cleanedCanvas[cOff],
          cleanedCanvas[cOff + 1],
          cleanedCanvas[cOff + 2],
        );
      }
    }
  }

  return {
    palette: paletteBytes,
    indices: outIndices,
    transparentIndex: outTransparentIndex,
  };
}

/**
 * Processes a GIF image buffer (static or animated) to remove Gemini watermarks
 * consistently across all frames while preserving animation timing, looping,
 * transparency, disposal behavior, and frame layout, followed by CleanShot
 * canonical GIF metadata cleaning.
 */
export async function processGeminiGifBuffer(
  gifBytes: Uint8Array,
  outputName: string,
  options: {
    adaptiveMode?: GifAdaptiveMode;
    engine?: WatermarkEngine;
    signal?: AbortSignal;
    onProgress?: (progress: GifWatermarkProgress) => void;
  } = {},
): Promise<ProcessedGifWatermarkBufferResult> {
  const adaptiveMode = options.adaptiveMode ?? 'auto';
  options.signal?.throwIfAborted();

  const decoded = decodeGif(gifBytes);
  const { width, height, frames } = decoded;
  const totalFrames = frames.length;
  const animated = totalFrames > 1;

  options.onProgress?.({
    currentFrame: 0,
    totalFrames,
    progress: 0.05,
    message: animated
      ? `Analyzing ${totalFrames} GIF frames for Gemini watermark…`
      : 'Analyzing GIF for Gemini watermark…',
  });

  // Stage 1: Probe representative frames (0, 1/4, 1/2, 3/4, last).
  // Stage 2: If no watermark was detected on Stage 1 frames for a multi-frame GIF,
  // probe additional intermediate frames (e.g. 1/8, 3/8, 5/8, 7/8, etc.) before
  // concluding that no watermark is present.
  const primaryProbeSet = new Set<number>([0]);
  if (totalFrames > 1) {
    primaryProbeSet.add(Math.floor(totalFrames / 4));
    primaryProbeSet.add(Math.floor(totalFrames / 2));
    primaryProbeSet.add(Math.floor((3 * totalFrames) / 4));
    primaryProbeSet.add(totalFrames - 1);
  }

  const secondaryProbeSet = new Set<number>();
  if (totalFrames > 5) {
    for (let k = 1; k < 8; k += 2) {
      const idx = Math.min(totalFrames - 1, Math.floor((k * totalFrames) / 8));
      if (!primaryProbeSet.has(idx)) {
        secondaryProbeSet.add(idx);
      }
    }
  }

  interface ProbeCandidate {
    frameIndex: number;
    meta: WatermarkMeta;
    cleanedData: Uint8ClampedArray;
  }

  let firstProbeMeta: WatermarkMeta | null = null;
  let winningCandidate: ProbeCandidate | null = null;

  const runProbePass = async (targetSet: Set<number>) => {
    if (targetSet.size === 0) return;
    const indices = [...targetSet].sort((a, b) => a - b);
    const maxIdx = indices[indices.length - 1];
    const probeCanvas = new Uint8ClampedArray(width * height * 4);
    let probePrevCanvas: Uint8ClampedArray | null = null;

    for (let i = 0; i <= maxIdx; i++) {
      options.signal?.throwIfAborted();
      const frame = frames[i];
      const palette = frame.localColorTable ?? decoded.globalColorTable!;

      if (frame.disposalMethod === 3) {
        probePrevCanvas = probeCanvas.slice();
      }

      compositeFrameOntoCanvas(probeCanvas, width, height, frame, palette);

      if (targetSet.has(i)) {
        const testCopy = prepareCanvasCopyForWatermarkEngine(
          probeCanvas,
          width,
          height,
        );
        const removalRes = options.engine
          ? await removeWatermarkFromImageData(
              { width, height, data: testCopy },
              { engine: options.engine, adaptiveMode },
            )
          : removeWatermarkFromImageDataSync(
              { width, height, data: testCopy },
              { adaptiveMode },
            );

        if (!firstProbeMeta) {
          firstProbeMeta = removalRes.meta;
        }

        if (removalRes.meta.applied && removalRes.meta.position) {
          const currentGain = removalRes.meta.detection?.suppressionGain ?? 0;
          const currentBestEffort = Boolean(
            (removalRes.meta as { bestEffort?: boolean }).bestEffort,
          );
          const prevGain =
            winningCandidate?.meta.detection?.suppressionGain ?? -Infinity;
          const prevBestEffort = Boolean(
            (winningCandidate?.meta as { bestEffort?: boolean } | undefined)
              ?.bestEffort,
          );

          if (
            !winningCandidate ||
            (prevBestEffort && !currentBestEffort) ||
            (prevBestEffort === currentBestEffort && currentGain > prevGain)
          ) {
            winningCandidate = {
              frameIndex: i,
              meta: removalRes.meta,
              cleanedData: new Uint8ClampedArray(removalRes.imageData.data),
            };
          }

          // Stop probing early only when we have a clean, high-confidence match
          if (!currentBestEffort) {
            break;
          }
        }
      }

      applyDisposalMethod(
        probeCanvas,
        probePrevCanvas,
        width,
        height,
        frame.disposalMethod,
        frame,
      );
    }
  };

  await runProbePass(primaryProbeSet);
  if (!winningCandidate && secondaryProbeSet.size > 0) {
    await runProbePass(secondaryProbeSet);
  }

  // Honest no-detection result: return metadata-cleaned original GIF with explicit applied=false / unchanged=true
  if (!winningCandidate) {
    options.signal?.throwIfAborted();
    const result = await stripImageMetadata(gifBytes, outputName);
    if (result.error) {
      throw new Error(result.error);
    }
    const resolvedFirstMeta = firstProbeMeta as WatermarkMeta | null;
    const noMatchMeta: WatermarkMeta = resolvedFirstMeta
      ? { ...resolvedFirstMeta, applied: false }
      : {
          applied: false,
          skipReason: 'no-watermark-detected',
          size: null,
          position: null,
          config: null,
          detection: {
            adaptiveConfidence: null,
            originalSpatialScore: null,
            originalGradientScore: null,
            processedSpatialScore: null,
            processedGradientScore: null,
            suppressionGain: null,
          },
          source: 'gif-probe',
          decisionTier: null,
          alphaGain: 1,
          passCount: 0,
          attemptedPassCount: 0,
          passStopReason: 'no-watermark-detected',
        };
    return {
      width,
      height,
      frameCount: totalFrames,
      animated,
      meta: noMatchMeta,
      unchanged: true,
      result,
    };
  }

  const confirmedCandidate: ProbeCandidate = winningCandidate;

  const wmPos = confirmedCandidate.meta.position!;
  const paddedRegion = getPaddedRegion(wmPos, width, height, REFINER_PAD);

  const standardConfig = detectWatermarkConfig(width, height);
  const standardPos = calculateWatermarkPosition(width, height, standardConfig);
  const isStandardCatalogPos =
    wmPos.x === standardPos.x &&
    wmPos.y === standardPos.y &&
    wmPos.width === standardPos.width &&
    wmPos.height === standardPos.height;

  const engine = options.engine ?? (await createWatermarkEngine());
  let fallbackAlphaMap: Float32Array | null = null;
  try {
    const requestedSize =
      confirmedCandidate.meta.config?.alphaVariant ?? wmPos.width;
    fallbackAlphaMap = await engine.getAlphaMap(
      requestedSize as number,
    );
  } catch {
    try {
      fallbackAlphaMap = await engine.getAlphaMap(wmPos.width);
    } catch {
      fallbackAlphaMap = null;
    }
  }

  // Pass 2: Stream through all frames in lockstep (origCanvas & outCanvas)
  const origCanvas = new Uint8ClampedArray(width * height * 4);
  const outCanvas = new Uint8ClampedArray(width * height * 4);
  const cleanedCanvas = new Uint8ClampedArray(width * height * 4);
  let origPrevCanvas: Uint8ClampedArray | null = null;
  let outPrevCanvas: Uint8ClampedArray | null = null;

  let lastOrigWmRegion: Uint8ClampedArray | null = null;
  let lastCleanedWmRegion: Uint8ClampedArray | null = null;

  const encodedFrames: EncodedGifFrameInput[] = [];
  let outGlobalColorTable = decoded.globalColorTable;

  for (let i = 0; i < totalFrames; i++) {
    options.signal?.throwIfAborted();
    const frame = frames[i];
    const origPalette = frame.localColorTable ?? decoded.globalColorTable!;

    if (frame.disposalMethod === 3) {
      origPrevCanvas = origCanvas.slice();
      outPrevCanvas = outCanvas.slice();
    }
    const outCanvasBefore = outCanvas.slice();

    compositeFrameOntoCanvas(origCanvas, width, height, frame, origPalette);

    cleanedCanvas.set(origCanvas);
    let modifiedWatermarkInCanvas = false;

    if (hasOpaquePixelsInRegion(origCanvas, width, height, wmPos)) {
      const currentOrigRegion = extractPatchRgba(
        origCanvas,
        width,
        height,
        paddedRegion,
      );

      if (
        lastOrigWmRegion &&
        lastCleanedWmRegion &&
        patchesEqual(currentOrigRegion, lastOrigWmRegion)
      ) {
        applyPatchRgba(
          cleanedCanvas,
          width,
          height,
          paddedRegion,
          lastCleanedWmRegion,
        );
        modifiedWatermarkInCanvas = true;
      } else if (i === confirmedCandidate.frameIndex) {
        const cleanedRegion = extractPatchRgba(
          confirmedCandidate.cleanedData,
          width,
          height,
          paddedRegion,
        );
        applyPatchRgba(cleanedCanvas, width, height, paddedRegion, cleanedRegion);
        lastOrigWmRegion = currentOrigRegion;
        lastCleanedWmRegion = cleanedRegion;
        modifiedWatermarkInCanvas = true;
      } else {
        // Run the actual @pilio/gemini-watermark-remover engine on this frame's full composited canvas
        const frameDataCopy = prepareCanvasCopyForWatermarkEngine(
          origCanvas,
          width,
          height,
          paddedRegion,
        );
        const perFrameAdaptiveMode: GifAdaptiveMode =
          adaptiveMode === 'always'
            ? 'always'
            : isStandardCatalogPos
              ? 'off'
              : adaptiveMode;
        const frameRes = await removeWatermarkFromImageData(
          { width, height, data: frameDataCopy },
          { engine, adaptiveMode: perFrameAdaptiveMode },
        );

        const posMatches =
          frameRes.meta.applied &&
          frameRes.meta.position &&
          ((Math.abs(frameRes.meta.position.x - wmPos.x) <= 4 &&
            Math.abs(frameRes.meta.position.y - wmPos.y) <= 4) ||
            !(frameRes.meta as { bestEffort?: boolean }).bestEffort);

        const hasWatermarkEvidenceOnFrame =
          i >= confirmedCandidate.frameIndex &&
          (frameRes.meta.detection?.originalSpatialScore == null ||
            frameRes.meta.detection.originalSpatialScore > 0.1);

        let cleanedRegion: Uint8ClampedArray;
        if (posMatches) {
          cleanedRegion = extractPatchRgba(
            new Uint8ClampedArray(frameRes.imageData.data),
            width,
            height,
            paddedRegion,
          );
        } else if (
          hasWatermarkEvidenceOnFrame &&
          fallbackAlphaMap &&
          fallbackAlphaMap.length === wmPos.width * wmPos.height
        ) {
          // Consistent multi-pass fallback at the exact consensus watermark position
          // when a single frame's moving content triggers an adaptive skip.
          const fallbackCopy = prepareCanvasCopyForWatermarkEngine(
            origCanvas,
            width,
            height,
            paddedRegion,
          );
          const layerRes = removeRepeatedWatermarkLayers(
            { width, height, data: fallbackCopy },
            fallbackAlphaMap,
            wmPos,
            {
              alphaGain: confirmedCandidate.meta.alphaGain,
              maxPasses: Math.max(1, confirmedCandidate.meta.passCount || 1),
            },
          ) as { imageData: { data: Uint8ClampedArray } };
          cleanedRegion = extractPatchRgba(
            new Uint8ClampedArray(layerRes.imageData.data),
            width,
            height,
            paddedRegion,
          );
        } else {
          cleanedRegion = currentOrigRegion;
        }

        applyPatchRgba(cleanedCanvas, width, height, paddedRegion, cleanedRegion);
        lastOrigWmRegion = currentOrigRegion;
        lastCleanedWmRegion = cleanedRegion;
        modifiedWatermarkInCanvas = !patchesEqual(cleanedRegion, currentOrigRegion);
      }
    }

    let minX = Math.max(0, frame.left);
    let minY = Math.max(0, frame.top);
    let maxX = Math.min(width, frame.left + frame.width);
    let maxY = Math.min(height, frame.top + frame.height);

    // Check if any pixel in paddedRegion changed relative to outCanvasBefore or origCanvas.
    // Never expand a disposalMethod === 2 frame beyond its original rect so its disposal
    // pass in subsequent frames never erases additional canvas pixels.
    let needsRequantize = false;
    const canExpandFrame = frame.disposalMethod !== 2;
    const wmX0 = paddedRegion.x;
    const wmY0 = paddedRegion.y;
    const wmX1 = paddedRegion.x + paddedRegion.width;
    const wmY1 = paddedRegion.y + paddedRegion.height;

    for (let cy = wmY0; cy < wmY1; cy++) {
      const rowOff = cy * width;
      for (let cx = wmX0; cx < wmX1; cx++) {
        const cOff = (rowOff + cx) * 4;
        const inFrameRect = cx >= minX && cx < maxX && cy >= minY && cy < maxY;

        if (inFrameRect) {
          if (
            cleanedCanvas[cOff] !== origCanvas[cOff] ||
            cleanedCanvas[cOff + 1] !== origCanvas[cOff + 1] ||
            cleanedCanvas[cOff + 2] !== origCanvas[cOff + 2]
          ) {
            needsRequantize = true;
          }
        } else if (canExpandFrame) {
          // Outside original partial frame rect: check if outCanvasBefore differs from cleanedCanvas
          if (
            outCanvasBefore[cOff] !== cleanedCanvas[cOff] ||
            outCanvasBefore[cOff + 1] !== cleanedCanvas[cOff + 1] ||
            outCanvasBefore[cOff + 2] !== cleanedCanvas[cOff + 2] ||
            outCanvasBefore[cOff + 3] !== cleanedCanvas[cOff + 3]
          ) {
            needsRequantize = true;
            if (cx < minX) minX = cx;
            if (cx + 1 > maxX) maxX = cx + 1;
            if (cy < minY) minY = cy;
            if (cy + 1 > maxY) maxY = cy + 1;
          }
        }
      }
    }

    if (!needsRequantize) {
      // Frame is completely unaffected by watermark removal: preserve verbatim
      encodedFrames.push({
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
        delayCs: frame.delayCs,
        disposalMethod: frame.disposalMethod,
        userInputFlag: frame.userInputFlag,
        transparentIndex: frame.transparentIndex,
        localColorTable: frame.localColorTable,
        indices: frame.indices,
      });

      compositeFrameOntoCanvas(outCanvas, width, height, frame, origPalette);
      applyDisposalMethod(origCanvas, origPrevCanvas, width, height, frame.disposalMethod, frame);
      applyDisposalMethod(outCanvas, outPrevCanvas, width, height, frame.disposalMethod, frame);
    } else {
      void modifiedWatermarkInCanvas;
      const outLeft = minX;
      const outTop = minY;
      const outWidth = Math.max(1, maxX - minX);
      const outHeight = Math.max(1, maxY - minY);

      const quantized = quantizeModifiedFrame({
        outLeft,
        outTop,
        outWidth,
        outHeight,
        screenWidth: width,
        origFrame: frame,
        origPalette,
        origCanvas,
        cleanedCanvas,
        outCanvasBefore,
      });

      // For a single-frame static GIF that originally used a Global Color Table without a Local Color Table,
      // store the updated palette in the Global Color Table to preserve static GIF structure.
      const useGlobalPaletteOnly =
        totalFrames === 1 && frame.localColorTable === null && decoded.globalColorTable !== null;
      if (useGlobalPaletteOnly) {
        outGlobalColorTable = quantized.palette;
      }

      const emittedFrame: EncodedGifFrameInput = {
        left: outLeft,
        top: outTop,
        width: outWidth,
        height: outHeight,
        delayCs: frame.delayCs,
        disposalMethod: frame.disposalMethod,
        userInputFlag: frame.userInputFlag,
        transparentIndex: quantized.transparentIndex,
        localColorTable: useGlobalPaletteOnly ? null : quantized.palette,
        indices: quantized.indices,
      };
      encodedFrames.push(emittedFrame);

      compositeFrameOntoCanvas(outCanvas, width, height, emittedFrame, quantized.palette);
      applyDisposalMethod(origCanvas, origPrevCanvas, width, height, frame.disposalMethod, frame);
      applyDisposalMethod(
        outCanvas,
        outPrevCanvas,
        width,
        height,
        frame.disposalMethod,
        emittedFrame,
      );
    }

    if (
      options.onProgress &&
      (i === totalFrames - 1 || i % Math.max(1, Math.floor(totalFrames / 20)) === 0)
    ) {
      const frameNum = i + 1;
      options.onProgress({
        currentFrame: frameNum,
        totalFrames,
        progress: Math.min(0.95, 0.1 + (frameNum / totalFrames) * 0.82),
        message: animated
          ? `Removing Gemini watermark from GIF frame ${frameNum} / ${totalFrames}…`
          : 'Removing Gemini watermark from GIF…',
      });
    }
  }

  options.signal?.throwIfAborted();
  const encodedGifBytes = encodeGif({
    width,
    height,
    lsdPacked: decoded.lsdPacked,
    backgroundColorIndex: decoded.backgroundColorIndex,
    pixelAspectRatio: decoded.pixelAspectRatio,
    globalColorTable: outGlobalColorTable,
    // Static 1-frame GIFs never emit a NETSCAPE2.0 loop block; animated GIFs preserve original loopCount (defaulting to 0 = infinite loop if multi-frame)
    loopCount: animated ? (decoded.loopCount ?? 0) : null,
    frames: encodedFrames,
  });

  options.signal?.throwIfAborted();
  const result = await stripImageMetadata(encodedGifBytes, outputName);
  if (result.error) {
    throw new Error(result.error);
  }

  options.onProgress?.({
    currentFrame: totalFrames,
    totalFrames,
    progress: 1,
    message: 'Completed GIF watermark & metadata removal.',
  });

  return {
    width,
    height,
    frameCount: totalFrames,
    animated,
    meta: confirmedCandidate.meta,
    unchanged: false,
    result,
  };
}

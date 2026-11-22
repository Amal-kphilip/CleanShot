import {
  createWatermarkEngine,
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

function extractPatchRgba(
  canvas: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  pos: WatermarkPosition,
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

/**
 * Calibrates a per-pixel effective alpha mask from the winning probe frame's
 * before/after patches, falling back to the engine's embedded alpha map on
 * near-saturated white pixels where `(255 - after)` is small.
 *
 * This guarantees 100% temporal consistency across all animated GIF frames:
 * - Stationary pixels under the watermark reproduce the probe frame's exact cleaned RGB.
 * - Moving pixels under the watermark use the exact same calibrated alpha mask and position,
 *   eliminating frame-to-frame flicker or missed frames.
 */
function buildCalibratedAlphaMask(
  beforePatch: Uint8ClampedArray,
  afterPatch: Uint8ClampedArray,
  fallbackAlphaMap: Float32Array | null,
  alphaGain: number,
  pixelCount: number,
): Float32Array {
  const calibrated = new Float32Array(pixelCount);
  const gain = Number.isFinite(alphaGain) && alphaGain > 0 ? alphaGain : 1;

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const bR = beforePatch[off];
    const bG = beforePatch[off + 1];
    const bB = beforePatch[off + 2];
    const aR = afterPatch[off];
    const aG = afterPatch[off + 1];
    const aB = afterPatch[off + 2];

    const diffR = bR - aR;
    const diffG = bG - aG;
    const diffB = bB - aB;
    const maxAbsDiff = Math.max(Math.abs(diffR), Math.abs(diffG), Math.abs(diffB));

    if (maxAbsDiff === 0) {
      if (fallbackAlphaMap && i < fallbackAlphaMap.length) {
        // If pixel was already saturated white (255), keep fallback alpha in case later frames are darker
        if (bR >= 250 && bG >= 250 && bB >= 250) {
          calibrated[i] = Math.min(0.99, Math.max(-0.99, fallbackAlphaMap[i] * gain));
        } else {
          calibrated[i] = 0;
        }
      }
      continue;
    }

    // White-logo reverse alpha: alpha = (before - after) / (255 - after)
    let alphaSum = 0;
    let alphaWeight = 0;
    const channels: Array<[number, number]> = [
      [bR, aR],
      [bG, aG],
      [bB, aB],
    ];

    for (const [bVal, aVal] of channels) {
      if (bVal >= aVal) {
        const denom = 255 - aVal;
        if (denom >= 8) {
          const est = (bVal - aVal) / denom;
          if (est > 0 && est <= 0.99) {
            alphaSum += est * denom;
            alphaWeight += denom;
          }
        }
      } else {
        // Dark-polarity logo (logo = 0): alpha = -(after - before) / after
        if (aVal >= 8) {
          const est = -(aVal - bVal) / aVal;
          if (est < 0 && est >= -0.99) {
            alphaSum += est * aVal;
            alphaWeight += aVal;
          }
        }
      }
    }

    if (alphaWeight > 0) {
      calibrated[i] = Math.max(-0.99, Math.min(0.99, alphaSum / alphaWeight));
    } else if (fallbackAlphaMap && i < fallbackAlphaMap.length) {
      calibrated[i] = Math.max(-0.99, Math.min(0.99, fallbackAlphaMap[i] * gain));
    }
  }

  return calibrated;
}

function applyCalibratedWatermarkRemovalToCanvas(
  canvas: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  pos: WatermarkPosition,
  probeBeforePatch: Uint8ClampedArray,
  probeAfterPatch: Uint8ClampedArray,
  calibratedAlpha: Float32Array,
): boolean {
  let modifiedAny = false;

  for (let row = 0; row < pos.height; row++) {
    const cy = pos.y + row;
    if (cy < 0 || cy >= screenHeight) continue;
    for (let col = 0; col < pos.width; col++) {
      const cx = pos.x + col;
      if (cx < 0 || cx >= screenWidth) continue;

      const cOff = (cy * screenWidth + cx) * 4;
      // Never modify transparent pixels
      if (canvas[cOff + 3] === 0) continue;

      const pIdx = row * pos.width + col;
      const pOff = pIdx * 4;

      const r = canvas[cOff];
      const g = canvas[cOff + 1];
      const b = canvas[cOff + 2];

      // If pixel matches the probe frame's input pixel, use the probe frame's exact output pixel
      if (
        probeBeforePatch[pOff + 3] === 255 &&
        Math.abs(r - probeBeforePatch[pOff]) <= 1 &&
        Math.abs(g - probeBeforePatch[pOff + 1]) <= 1 &&
        Math.abs(b - probeBeforePatch[pOff + 2]) <= 1
      ) {
        const nextR = probeAfterPatch[pOff];
        const nextG = probeAfterPatch[pOff + 1];
        const nextB = probeAfterPatch[pOff + 2];
        if (nextR !== r || nextG !== g || nextB !== b) {
          canvas[cOff] = nextR;
          canvas[cOff + 1] = nextG;
          canvas[cOff + 2] = nextB;
          modifiedAny = true;
        }
        continue;
      }

      const rawAlpha = calibratedAlpha[pIdx];
      const absAlpha = Math.abs(rawAlpha);
      if (absAlpha < 0.002) continue;

      const logoVal = rawAlpha < 0 ? 0 : 255;
      const oneMinusAlpha = 1.0 - Math.min(absAlpha, 0.99);
      const nextR = Math.max(0, Math.min(255, Math.round((r - absAlpha * logoVal) / oneMinusAlpha)));
      const nextG = Math.max(0, Math.min(255, Math.round((g - absAlpha * logoVal) / oneMinusAlpha)));
      const nextB = Math.max(0, Math.min(255, Math.round((b - absAlpha * logoVal) / oneMinusAlpha)));

      if (nextR !== r || nextG !== g || nextB !== b) {
        canvas[cOff] = nextR;
        canvas[cOff + 1] = nextG;
        canvas[cOff + 2] = nextB;
        modifiedAny = true;
      }
    }
  }

  return modifiedAny;
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

      // If original frame left this pixel transparent and outCanvasBefore already has the target color,
      // keep it transparent so partial-frame transparency is preserved.
      if (
        origFrameIdx === origFrame.transparentIndex &&
        outCanvasBefore[cOff + 3] === 255 &&
        outCanvasBefore[cOff] === targetR &&
        outCanvasBefore[cOff + 1] === targetG &&
        outCanvasBefore[cOff + 2] === targetB
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

  if (outPaletteColors.length === 0) {
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

  // Probe frame 0 first; only probe midpoint and final frame if frame 0 has no watermark
  // (e.g. an animated GIF whose opening frame is a blank/intro card).
  const probeIndexSet = new Set<number>([0]);
  if (totalFrames > 1) {
    probeIndexSet.add(Math.floor(totalFrames / 2));
    probeIndexSet.add(totalFrames - 1);
  }
  const probeIndices = [...probeIndexSet].sort((a, b) => a - b);
  const maxProbeIndex = probeIndices[probeIndices.length - 1];

  interface ProbeCandidate {
    frameIndex: number;
    meta: WatermarkMeta;
    beforePatch: Uint8ClampedArray;
    afterPatch: Uint8ClampedArray;
  }

  const probeCanvas = new Uint8ClampedArray(width * height * 4);
  let probePrevCanvas: Uint8ClampedArray | null = null;
  let firstProbeMeta: WatermarkMeta | null = null;
  const appliedCandidates: ProbeCandidate[] = [];

  for (let i = 0; i <= maxProbeIndex; i++) {
    options.signal?.throwIfAborted();
    const frame = frames[i];
    const palette = frame.localColorTable ?? decoded.globalColorTable!;

    if (frame.disposalMethod === 3) {
      probePrevCanvas = probeCanvas.slice();
    }

    compositeFrameOntoCanvas(probeCanvas, width, height, frame, palette);

    if (probeIndexSet.has(i)) {
      const testCopy = new Uint8ClampedArray(probeCanvas);
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
        const pos = removalRes.meta.position;
        appliedCandidates.push({
          frameIndex: i,
          meta: removalRes.meta,
          beforePatch: extractPatchRgba(probeCanvas, width, height, pos),
          afterPatch: extractPatchRgba(
            new Uint8ClampedArray(removalRes.imageData.data),
            width,
            height,
            pos,
          ),
        });
        // Stop probing once watermark is confirmed so multi-frame GIFs process rapidly
        break;
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

  // Fast lossless path: if no watermark was detected on any probe frame, clean GIF metadata directly
  if (appliedCandidates.length === 0) {
    options.signal?.throwIfAborted();
    const result = await stripImageMetadata(gifBytes, outputName);
    if (result.error) {
      throw new Error(result.error);
    }
    return {
      width,
      height,
      frameCount: totalFrames,
      animated,
      meta: firstProbeMeta,
      result,
    };
  }

  // Pick consensus candidate across applied probe frames (most frequent position, then highest suppressionGain)
  const posCounts = new Map<string, number>();
  for (const c of appliedCandidates) {
    const p = c.meta.position!;
    const key = `${p.x},${p.y},${p.width},${p.height}`;
    posCounts.set(key, (posCounts.get(key) ?? 0) + 1);
  }

  const winningCandidate = [...appliedCandidates].sort((a, b) => {
    const pa = a.meta.position!;
    const pb = b.meta.position!;
    const countDiff =
      (posCounts.get(`${pb.x},${pb.y},${pb.width},${pb.height}`) ?? 0) -
      (posCounts.get(`${pa.x},${pa.y},${pa.width},${pa.height}`) ?? 0);
    if (countDiff !== 0) return countDiff;
    const gainA = a.meta.detection?.suppressionGain ?? 0;
    const gainB = b.meta.detection?.suppressionGain ?? 0;
    if (gainB !== gainA) return gainB - gainA;
    return a.frameIndex - b.frameIndex;
  })[0];

  const wmPos = winningCandidate.meta.position!;
  let fallbackAlphaMap: Float32Array | null = null;
  try {
    const engine = options.engine ?? (await createWatermarkEngine());
    if (wmPos.width === wmPos.height && wmPos.width > 0) {
      fallbackAlphaMap = await engine.getAlphaMap(wmPos.width);
    }
  } catch {
    fallbackAlphaMap = null;
  }

  const calibratedAlpha = buildCalibratedAlphaMask(
    winningCandidate.beforePatch,
    winningCandidate.afterPatch,
    fallbackAlphaMap,
    winningCandidate.meta.alphaGain,
    wmPos.width * wmPos.height,
  );

  // Pass 2: Stream through all frames in lockstep (origCanvas & outCanvas)
  const origCanvas = new Uint8ClampedArray(width * height * 4);
  const outCanvas = new Uint8ClampedArray(width * height * 4);
  const cleanedCanvas = new Uint8ClampedArray(width * height * 4);
  let origPrevCanvas: Uint8ClampedArray | null = null;
  let outPrevCanvas: Uint8ClampedArray | null = null;

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
    const modifiedWatermarkInCanvas = applyCalibratedWatermarkRemovalToCanvas(
      cleanedCanvas,
      width,
      height,
      wmPos,
      winningCandidate.beforePatch,
      winningCandidate.afterPatch,
      calibratedAlpha,
    );

    let minX = Math.max(0, frame.left);
    let minY = Math.max(0, frame.top);
    let maxX = Math.min(width, frame.left + frame.width);
    let maxY = Math.min(height, frame.top + frame.height);

    // Check if any pixel in wmPos changed relative to outCanvasBefore or origCanvas
    let needsRequantize = false;
    const wmX0 = Math.max(0, wmPos.x);
    const wmY0 = Math.max(0, wmPos.y);
    const wmX1 = Math.min(width, wmPos.x + wmPos.width);
    const wmY1 = Math.min(height, wmPos.y + wmPos.height);

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
        } else {
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

    if (!needsRequantize && !modifiedWatermarkInCanvas) {
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
    meta: winningCandidate.meta,
    result,
  };
}

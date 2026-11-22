/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

import { inspectPngAnimation, reencodeStaticRasterInBrowser } from './imageAnimation';
import { StripOptions } from './types';

function calculatePngCrc(buffer: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Structural PNG chunk filter used as a deterministic fallback only in headless Node
 * test environments where browser canvas raster decoding is unavailable.
 * Validates animation status via `inspectPngAnimation()` first.
 */
export function stripPng(
  buffer: Uint8Array,
  options: StripOptions = {},
): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  void options;
  const animationStatus = inspectPngAnimation(buffer);
  if (animationStatus === 'animated') {
    throw new Error('Animated PNG/WebP files are rejected to avoid flattening their frames.');
  }
  if (animationStatus === 'invalid') {
    throw new Error('Invalid PNG/WebP container rejected.');
  }

  const removedSegments: string[] = [];
  const chunks: Uint8Array[] = [buffer.slice(0, 8)];
  let offset = 8;
  const len = buffer.length;
  let seenIHDR = false;
  let seenIDAT = false;
  let seenIEND = false;

  while (offset < len) {
    if (offset + 12 > len) throw new Error('Invalid PNG/WebP container rejected.');
    const dataLength =
      ((buffer[offset] << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8) |
        buffer[offset + 3]) >>>
      0;
    const typeBytes = buffer.slice(offset + 4, offset + 8);
    const chunkType = String.fromCharCode(
      typeBytes[0],
      typeBytes[1],
      typeBytes[2],
      typeBytes[3],
    );
    const totalChunkLength = 12 + dataLength;
    if (offset + totalChunkLength > len) {
      throw new Error('Invalid PNG/WebP container rejected.');
    }
    if (!/^[A-Za-z]{4}$/.test(chunkType)) {
      throw new Error('Invalid PNG/WebP container rejected.');
    }
    const crcOffset = offset + 8 + dataLength;
    const storedCrc = new DataView(
      buffer.buffer,
      buffer.byteOffset + crcOffset,
      4,
    ).getUint32(0, false);
    const computedCrc = calculatePngCrc(buffer, offset + 4, crcOffset);
    if (storedCrc !== computedCrc) {
      throw new Error(`Malformed PNG: checksum mismatch in ${chunkType} chunk`);
    }

    if (chunkType === 'IHDR') seenIHDR = true;
    if (chunkType === 'IDAT') seenIDAT = true;
    if (chunkType === 'IEND') seenIEND = true;

    let shouldKeep = false;
    switch (chunkType) {
      case 'IHDR':
      case 'PLTE':
      case 'IDAT':
      case 'IEND':
      case 'tRNS':
        shouldKeep = true;
        break;
      default: {
        const isAncillary = (typeBytes[0] & 0x20) !== 0;
        if (!isAncillary) {
          throw new Error(
            `PNG contains an unrecognized critical chunk (${chunkType}); safe cleaning is not available for this variant.`,
          );
        }
        removedSegments.push(`PNG ${chunkType} chunk`);
        break;
      }
    }

    if (shouldKeep) {
      chunks.push(buffer.slice(offset, offset + totalChunkLength));
    }
    offset += totalChunkLength;
    if (chunkType === 'IEND') break;
  }

  if (!seenIHDR || !seenIDAT || !seenIEND) {
    throw new Error('Invalid PNG/WebP container rejected.');
  }

  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;
  const cleaned = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    cleaned.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: buffer.length - cleaned.length,
  };
}

/**
 * CleanShot PNG metadata cleaner:
 * 1. Inspects PNG structure via `inspectPngAnimation(bytes)` and rejects invalid or APNG files.
 * 2. Decodes static PNG raster in the browser/worker and draws onto a fresh canvas to export a clean PNG.
 */
export async function stripPngAsync(
  buffer: Uint8Array,
  options: StripOptions = {},
): Promise<{
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
}> {
  void options;
  const animationStatus = inspectPngAnimation(buffer);
  if (animationStatus === 'animated') {
    throw new Error('Animated PNG/WebP files are rejected to avoid flattening their frames.');
  }
  if (animationStatus === 'invalid') {
    throw new Error('Invalid PNG/WebP container rejected.');
  }

  const reencoded = await reencodeStaticRasterInBrowser(buffer, 'image/png');
  if (reencoded) {
    return {
      cleanedBuffer: reencoded,
      removedSegments: ['PNG raster re-encoded via canvas'],
      bytesSaved: buffer.length - reencoded.length,
    };
  }

  // Fallback for headless Node.js unit test environments where browser Canvas APIs are absent
  return stripPng(buffer, options);
}

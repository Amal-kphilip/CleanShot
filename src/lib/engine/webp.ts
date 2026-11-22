/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

import { matchesAscii, readUint32LE, writeUint32LE } from './binary';
import { inspectWebpAnimation, reencodeStaticRasterInBrowser } from './imageAnimation';
import { StripOptions } from './types';

/**
 * Removes metadata chunks that Chromium may add while encoding WebP. If the
 * extended header has no remaining alpha/animation features, it is redundant
 * and is removed too, yielding a normal simple WebP container.
 */
export function stripWebpMetadataChunks(
  bytes: Uint8Array,
  removedSegments?: string[],
): Uint8Array | null {
  if (
    bytes.length < 12 ||
    !matchesAscii(bytes, 0, 'RIFF') ||
    !matchesAscii(bytes, 8, 'WEBP')
  ) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = readUint32LE(bytes, offset + 4);
    const paddedSize = size + (size & 1);
    const end = offset + 8 + paddedSize;
    if (end > bytes.length) return null;

    const fourCC = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const isMetadata =
      matchesAscii(bytes, offset, 'ICCP') ||
      matchesAscii(bytes, offset, 'EXIF') ||
      matchesAscii(bytes, offset, 'XMP ');
    const isKnownBitstream =
      matchesAscii(bytes, offset, 'VP8X') ||
      matchesAscii(bytes, offset, 'VP8 ') ||
      matchesAscii(bytes, offset, 'VP8L') ||
      matchesAscii(bytes, offset, 'ALPH') ||
      matchesAscii(bytes, offset, 'ANIM') ||
      matchesAscii(bytes, offset, 'ANMF');

    if (isMetadata) {
      removedSegments?.push(`${fourCC.trim()} Metadata chunk`);
    } else if (!isKnownBitstream) {
      removedSegments?.push(`Unrecognized WebP chunk (${fourCC}) removed`);
    } else if (matchesAscii(bytes, offset, 'VP8X') && size >= 10) {
      const chunk = bytes.slice(offset, end);
      // ICC, EXIF and XMP flags respectively. Leave alpha and animation.
      chunk[8] &= ~(0x20 | 0x08 | 0x04);
      if ((chunk[8] & (0x10 | 0x02)) !== 0) chunks.push(chunk);
    } else {
      chunks.push(bytes.slice(offset, end));
    }
    offset = end;
  }
  if (offset !== bytes.length) return null;

  const totalSize = 12 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalSize);
  output.set(bytes.subarray(0, 12), 0);
  writeUint32LE(output, 4, totalSize - 8);
  let outputOffset = 12;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
}

export function stripWebp(
  buffer: Uint8Array,
  options: StripOptions = {},
): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  void options;
  const animationStatus = inspectWebpAnimation(buffer);
  if (animationStatus === 'animated') {
    throw new Error('Animated PNG/WebP files are rejected to avoid flattening their frames.');
  }
  if (animationStatus === 'invalid') {
    throw new Error('Invalid PNG/WebP container rejected.');
  }

  const removedSegments: string[] = [];
  const cleaned = stripWebpMetadataChunks(buffer, removedSegments);
  if (!cleaned) {
    throw new Error('Invalid PNG/WebP container rejected.');
  }
  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: buffer.length - cleaned.length,
  };
}

/**
 * CleanShot two-stage WebP cleaning process:
 * 1. Inspects RIFF/WebP structure via `inspectWebpAnimation(bytes)` and rejects invalid or animated WebP files.
 * 2. Decodes static WebP onto a fresh canvas and encodes a new WebP image.
 * 3. Runs `stripWebpMetadataChunks()` on the encoded WebP to remove ICCP, EXIF, and XMP chunks and update VP8X flags.
 */
export async function stripWebpAsync(
  buffer: Uint8Array,
  options: StripOptions = {},
): Promise<{
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
}> {
  void options;
  const animationStatus = inspectWebpAnimation(buffer);
  if (animationStatus === 'animated') {
    throw new Error('Animated PNG/WebP files are rejected to avoid flattening their frames.');
  }
  if (animationStatus === 'invalid') {
    throw new Error('Invalid PNG/WebP container rejected.');
  }

  const removedSegments: string[] = [];
  const reencoded = await reencodeStaticRasterInBrowser(buffer, 'image/webp');
  if (reencoded) {
    removedSegments.push('WebP raster re-encoded via canvas');
    const stripped = stripWebpMetadataChunks(reencoded, removedSegments);
    if (!stripped) {
      throw new Error('Failed to strip metadata chunks from re-encoded WebP.');
    }
    return {
      cleanedBuffer: stripped,
      removedSegments,
      bytesSaved: buffer.length - stripped.length,
    };
  }

  // Fallback for headless Node.js unit test environments where browser Canvas APIs are absent
  return stripWebp(buffer, options);
}

/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

import { concatBytes } from './binary';
import { reencodeStaticRasterInBrowser } from './imageAnimation';
import { StripOptions } from './types';

// JPEG markers whose segments carry metadata rather than image data:
// APP1 (0xE1) = EXIF and XMP, APP13 (0xED) = IPTC/Photoshop IRB, COM (0xFE) = comments.
// APP0 (JFIF), APP2 (ICC color profile) and APP14 (Adobe color transform) are kept
// because removing them can change how the image is decoded or displayed.
const STRIPPED_JPEG_MARKERS = new Set([0xe1, 0xed, 0xfe]);

/**
 * Removes metadata segments from a JPEG by walking its segment structure and
 * dropping EXIF/XMP/IPTC/comment segments, copying everything else verbatim.
 * Lossless - the compressed image data is untouched. Returns null if the bytes
 * don't parse as a JPEG (caller falls back to a canvas re-encode).
 */
export function stripJpegSegments(
  bytes: Uint8Array,
  removedSegments?: string[],
): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const kept: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  let offset = 2;

  while (offset + 2 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];

    // Padding: fill bytes of 0xFF may precede a marker
    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    // SOS: entropy-coded image data follows - copy the remainder verbatim
    if (marker === 0xda) {
      kept.push(bytes.subarray(offset));
      return concatBytes(kept);
    }

    // Standalone markers without a length field (TEM, RST0-RST7)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (offset + 4 > bytes.length) return null;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return null;

    if (!STRIPPED_JPEG_MARKERS.has(marker)) {
      kept.push(bytes.subarray(offset, offset + 2 + length));
    } else if (removedSegments) {
      if (marker === 0xe1) removedSegments.push('APP1 (EXIF / XMP metadata)');
      else if (marker === 0xed) removedSegments.push('APP13 (IPTC / Photoshop IRB metadata)');
      else if (marker === 0xfe) removedSegments.push('JPEG Comment (COM)');
    }
    offset += 2 + length;
  }
  return null;
}

export function stripJpeg(
  buffer: Uint8Array,
  options: StripOptions = {},
): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  void options;
  const removedSegments: string[] = [];
  const cleaned = stripJpegSegments(buffer, removedSegments);
  if (!cleaned) {
    throw new Error('Malformed JPEG: unable to parse JPEG segment structure');
  }
  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: buffer.length - cleaned.length,
  };
}

/**
 * CleanShot JPEG metadata cleaner: attempts lossless `stripJpegSegments()`
 * first, and falls back to browser raster decode + canvas re-encode if segment
 * parsing returns null.
 */
export async function stripJpegAsync(
  buffer: Uint8Array,
  options: StripOptions = {},
): Promise<{
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
}> {
  void options;
  const removedSegments: string[] = [];
  const cleaned = stripJpegSegments(buffer, removedSegments);
  if (cleaned) {
    return {
      cleanedBuffer: cleaned,
      removedSegments,
      bytesSaved: buffer.length - cleaned.length,
    };
  }

  const reencoded = await reencodeStaticRasterInBrowser(buffer, 'image/jpeg');
  if (!reencoded) {
    throw new Error('Malformed JPEG: segment parsing failed and raster fallback is unavailable');
  }
  removedSegments.push('JPEG canvas re-encode fallback');
  return {
    cleanedBuffer: reencoded,
    removedSegments,
    bytesSaved: buffer.length - reencoded.length,
  };
}

/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

import { concatBytes } from './binary';
import { StripOptions } from './types';

/**
 * Removes metadata blocks from a GIF by walking its block structure and dropping
 * comment, plain-text and non-animation application extensions (XMP travels as an
 * application extension). Frames, palettes and pixel data are copied byte-for-byte,
 * so the image is untouched - no re-encode, no palette/dither artifacts.
 * Returns null if the bytes don't parse as a GIF.
 */
export function stripGifBlocks(
  bytes: Uint8Array,
  removedSegments?: string[],
): Uint8Array | null {
  if (bytes.length < 13) return null;
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;

  const kept: Uint8Array[] = [];

  // Header + Logical Screen Descriptor (+ Global Color Table if flagged)
  const lsdPacked = bytes[10];
  let offset =
    13 + (lsdPacked & 0x80 ? 3 * (1 << ((lsdPacked & 0x07) + 1)) : 0);
  if (offset > bytes.length) return null;
  kept.push(bytes.subarray(0, offset));

  // Advances past a chain of data sub-blocks, returning the position after the terminator
  const skipSubBlocks = (pos: number): number | null => {
    while (pos < bytes.length) {
      const size = bytes[pos];
      pos += 1 + size;
      if (size === 0) return pos;
    }
    return null;
  };

  while (offset < bytes.length) {
    const block = bytes[offset];

    if (block === 0x3b) {
      // Trailer
      kept.push(bytes.subarray(offset, offset + 1));
      return concatBytes(kept);
    }

    if (block === 0x21) {
      // Extension block. Keep only what rendering needs: the Graphic Control
      // Extension (frame timing/transparency) and the NETSCAPE/ANIMEXTS
      // application extension (loop count). Comments, plain text, XMP and any
      // other application data are metadata - drop them.
      if (offset + 3 > bytes.length) return null;
      const label = bytes[offset + 1];
      let keep = false;
      let removedLabel = `GIF Extension 0x${label.toString(16).toUpperCase()}`;
      if (label === 0xf9) {
        keep = true;
      } else if (label === 0xff) {
        const identSize = bytes[offset + 2];
        const ident = String.fromCharCode(
          ...bytes.subarray(offset + 3, offset + 3 + identSize),
        );
        keep = ident.startsWith('NETSCAPE') || ident.startsWith('ANIMEXTS');
        if (!keep) {
          removedLabel = `GIF Application Extension (${ident.trim() || 'unknown'})`;
        }
      } else if (label === 0xfe) {
        removedLabel = 'GIF Comment Extension';
      } else if (label === 0x01) {
        removedLabel = 'GIF Plain Text Extension';
      }
      const endPos = skipSubBlocks(offset + 2);
      if (endPos === null || endPos > bytes.length) return null;
      if (keep) kept.push(bytes.subarray(offset, endPos));
      else removedSegments?.push(removedLabel);
      offset = endPos;
      continue;
    }

    if (block === 0x2c) {
      // Image descriptor (+ Local Color Table) + LZW-compressed frame data
      if (offset + 11 > bytes.length) return null;
      const imgPacked = bytes[offset + 9];
      let pos =
        offset +
        10 +
        (imgPacked & 0x80 ? 3 * (1 << ((imgPacked & 0x07) + 1)) : 0);
      pos += 1; // LZW minimum code size byte
      const endPos = skipSubBlocks(pos);
      if (endPos === null || endPos > bytes.length) return null;
      kept.push(bytes.subarray(offset, endPos));
      offset = endPos;
      continue;
    }

    return null; // unknown top-level block: bail out rather than guess
  }

  // Tolerate a missing trailer - decoders do too
  return concatBytes(kept);
}

export function stripGif(
  buffer: Uint8Array,
  options: StripOptions = {},
): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  void options;
  const removedSegments: string[] = [];
  const cleaned = stripGifBlocks(buffer, removedSegments);
  if (!cleaned) {
    throw new Error('Malformed GIF file: failed to parse GIF block structure');
  }
  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: buffer.length - cleaned.length,
  };
}

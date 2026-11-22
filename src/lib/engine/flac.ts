/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

import { concatBytes } from './binary';

const BLOCK_STREAMINFO = 0;
const BLOCK_SEEKTABLE = 3;
const BLOCK_CUESHEET = 5;

const BLOCK_NAMES: Record<number, string> = {
  1: 'PADDING',
  2: 'APPLICATION',
  4: 'VORBIS_COMMENT',
  6: 'PICTURE (Cover Art)',
};

/**
 * Strips metadata blocks from a FLAC file: keeps STREAMINFO (mandatory, must
 * stay first), SEEKTABLE and CUESHEET (needed for seeking), and any reserved/unknown
 * block type (kept conservatively). Drops PADDING, APPLICATION, VORBIS_COMMENT and PICTURE.
 * Audio frames after the metadata block chain are copied verbatim.
 */
export function stripFlacBlocks(
  bytes: Uint8Array,
  removedSegments?: string[],
): Uint8Array | null {
  if (
    bytes.length < 4 ||
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'fLaC'
  ) {
    return null;
  }

  const kept: Uint8Array[] = [bytes.subarray(0, 4)];
  const keptHeaderOffsets: number[] = [];
  let outputLength = 4;

  let offset = 4;
  let isFirstBlock = true;

  while (true) {
    if (offset + 4 > bytes.length) return null;
    const headerByte = bytes[offset];
    const isLast = (headerByte & 0x80) !== 0;
    const blockType = headerByte & 0x7f;
    const length =
      (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const blockEnd = offset + 4 + length;
    if (blockEnd > bytes.length) return null;

    if (isFirstBlock) {
      if (blockType !== BLOCK_STREAMINFO) return null;
      isFirstBlock = false;
    }
    if (blockType === 127) return null;

    const keep =
      blockType === BLOCK_STREAMINFO ||
      blockType === BLOCK_SEEKTABLE ||
      blockType === BLOCK_CUESHEET ||
      blockType >= 7;

    if (keep) {
      keptHeaderOffsets.push(outputLength);
      kept.push(bytes.subarray(offset, blockEnd));
      outputLength += blockEnd - offset;
    } else {
      removedSegments?.push(
        `FLAC ${BLOCK_NAMES[blockType] || `Block ${blockType}`}`,
      );
    }

    offset = blockEnd;
    if (isLast) break;
  }

  kept.push(bytes.subarray(offset));

  const result = concatBytes(kept);

  for (let i = 0; i < keptHeaderOffsets.length; i++) {
    const headerOffset = keptHeaderOffsets[i];
    if (i === keptHeaderOffsets.length - 1) {
      result[headerOffset] |= 0x80;
    } else {
      result[headerOffset] &= 0x7f;
    }
  }

  return result;
}

export function stripFlac(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const removedSegments: string[] = [];
  const result = stripFlacBlocks(bytes, removedSegments);
  if (!result) {
    throw new Error('Malformed or invalid FLAC stream');
  }
  return {
    cleanedBuffer: result,
    removedSegments,
    bytesSaved: bytes.length - result.length,
  };
}

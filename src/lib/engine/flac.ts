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
export function stripFlac(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  if (bytes.length < 4 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'fLaC') {
    throw new Error('Invalid FLAC stream: missing fLaC signature');
  }

  const removedSegments: string[] = [];
  const kept: Uint8Array[] = [bytes.subarray(0, 4)];
  const keptHeaderOffsets: number[] = [];
  let outputLength = 4;

  let offset = 4;
  let isFirstBlock = true;

  while (true) {
    if (offset + 4 > bytes.length) {
      throw new Error('Malformed FLAC stream: truncated metadata block header');
    }
    const headerByte = bytes[offset];
    const isLast = (headerByte & 0x80) !== 0;
    const blockType = headerByte & 0x7f;
    const length = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const blockEnd = offset + 4 + length;
    if (blockEnd > bytes.length) {
      throw new Error('Malformed FLAC stream: metadata block exceeds file length');
    }

    if (isFirstBlock) {
      if (blockType !== BLOCK_STREAMINFO) {
        throw new Error('Malformed FLAC stream: STREAMINFO must be the first metadata block');
      }
      isFirstBlock = false;
    }
    if (blockType === 127) {
      throw new Error('Malformed FLAC stream: invalid block type 127');
    }

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
      removedSegments.push(`FLAC ${BLOCK_NAMES[blockType] || `Block ${blockType}`}`);
    }

    offset = blockEnd;
    if (isLast) break;
  }

  kept.push(bytes.subarray(offset)); // audio frames

  const result = concatBytes(kept);

  for (let i = 0; i < keptHeaderOffsets.length; i++) {
    const headerOffset = keptHeaderOffsets[i];
    if (i === keptHeaderOffsets.length - 1) {
      result[headerOffset] |= 0x80;
    } else {
      result[headerOffset] &= 0x7f;
    }
  }

  return {
    cleanedBuffer: result,
    removedSegments,
    bytesSaved: bytes.length - result.length,
  };
}

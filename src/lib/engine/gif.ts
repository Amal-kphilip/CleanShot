import { StripOptions } from './types';

/**
 * Lossless GIF block stream parser and metadata stripper.
 * Strips Comment Extensions (0x21 0xFE), Plain Text Extensions (0x21 0x01),
 * and XMP Application Extensions, while strictly preserving Graphic Control Extensions (0x21 0xF9),
 * Netscape Animation Loop Extensions (0x21 0xFF NETSCAPE2.0), Global/Local Color Tables,
 * and LZW compressed image raster blocks.
 */
export function stripGif(buffer: Uint8Array, options: StripOptions = {}): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const removedSegments: string[] = [];

  // Check GIF header (GIF87a / GIF89a)
  if (
    buffer.length < 13 ||
    buffer[0] !== 0x47 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x38 ||
    (buffer[4] !== 0x37 && buffer[4] !== 0x39) || buffer[5] !== 0x61
  ) {
    throw new Error('Invalid GIF file: Missing GIF87a or GIF89a header');
  }

  const chunks: Uint8Array[] = [];

  // Header (6 bytes) + Logical Screen Descriptor (7 bytes) = 13 bytes
  let offset = 0;
  const lsdStart = 6;
  const packedField = buffer[lsdStart + 4];
  const hasGct = (packedField & 0x80) !== 0;
  const gctSize = 3 * Math.pow(2, (packedField & 0x07) + 1);

  const headerLength = 13 + (hasGct ? gctSize : 0);
  if (buffer.length < headerLength) {
    throw new Error('Malformed GIF file: Truncated header/GCT');
  }

  chunks.push(buffer.slice(0, headerLength));
  offset = headerLength;
  const len = buffer.length;
  const skipSubBlocks = (start: number): number => {
    let cursor = start;
    while (cursor < len) {
      const subLength = buffer[cursor++];
      if (subLength === 0) return cursor;
      if (cursor + subLength > len) throw new Error('Malformed GIF: truncated extension sub-block');
      cursor += subLength;
    }
    throw new Error('Malformed GIF: missing extension terminator');
  };

  let seenTrailer = false;
  while (offset < len) {
    const intro = buffer[offset];

    if (intro === 0x3B) {
      // Trailer (End of GIF)
      chunks.push(new Uint8Array([0x3B]));
      seenTrailer = true;
      break;
    }

    if (intro === 0x21) {
      // Extension block
      if (offset + 2 > len) throw new Error('Malformed GIF: truncated extension introducer');
      const label = buffer[offset + 1];
      const extStart = offset;

      if (label === 0xFE) {
        // Comment Extension is metadata.
        offset = skipSubBlocks(offset + 2);
        removedSegments.push('GIF Comment Extension');
        continue;
      } else if (label === 0x01) {
        // Plain-text extensions contribute visible content; retain them byte-for-byte.
        const headerLengthOffset = offset + 2;
        if (headerLengthOffset >= len) throw new Error('Malformed GIF: truncated plain-text extension');
        const headerLength = buffer[headerLengthOffset];
        const subBlocksStart = headerLengthOffset + 1 + headerLength;
        if (subBlocksStart > len) throw new Error('Malformed GIF: truncated plain-text header');
        offset = skipSubBlocks(subBlocksStart);
        chunks.push(buffer.slice(extStart, offset));
        continue;
      } else if (label === 0xFF) {
        // Preserve common animation-loop extensions; strip known metadata, but reject unknown apps
        // because they may carry private fields or alter animation behavior.
        if (offset + 3 > len) throw new Error('Malformed GIF: truncated application extension');
        const appBlockLen = buffer[offset + 2];
        const appBlockStart = offset + 3;
        const blockEnd = appBlockStart + appBlockLen;
        if (blockEnd > len) throw new Error('Malformed GIF: truncated application identifier');
        const appId = String.fromCharCode(...buffer.slice(appBlockStart, appBlockStart + Math.min(appBlockLen, 11))).trim();
        offset = skipSubBlocks(blockEnd);
        if (/^(NETSCAPE2\.0|ANIMEXTS1\.0)$/i.test(appId)) {
          chunks.push(buffer.slice(extStart, offset));
        } else if (/^(XMP DataXMP|C2PA|C2PA Data)/i.test(appId)) {
          removedSegments.push(`GIF Application Metadata (${appId || 'Vendor'})`);
        } else {
          throw new Error(`GIF contains an unrecognized application extension (${appId || 'unknown'}); safe cleaning is not available for this variant.`);
        }
        continue;
      } else {
        // Graphic-control and other extension blocks can affect display; preserve them.
        if (offset + 3 > len) throw new Error('Malformed GIF: truncated extension block');
        const fixedBlockLength = buffer[offset + 2];
        const subBlocksStart = offset + 3 + fixedBlockLength;
        if (subBlocksStart > len) throw new Error('Malformed GIF: truncated extension header');
        offset = skipSubBlocks(subBlocksStart);
        chunks.push(buffer.slice(extStart, offset));
        continue;
      }
    }

    if (intro === 0x2C) {
      // Image Descriptor (0x2C)
      const imgStart = offset;
      if (offset + 10 > len) throw new Error('Malformed GIF: truncated image descriptor');
      const imgPacked = buffer[offset + 9];
      const hasLct = (imgPacked & 0x80) !== 0;
      const lctSize = hasLct ? 3 * Math.pow(2, (imgPacked & 0x07) + 1) : 0;

      offset += 10 + lctSize; // Image descriptor + LCT
      if (offset >= len) throw new Error('Malformed GIF: missing LZW code size');

      const lzwMinCodeSize = buffer[offset];
      offset++; // LZW min code size byte

      // Skip raster data sub-blocks
      offset = skipSubBlocks(offset);
      chunks.push(buffer.slice(imgStart, offset));
      continue;
    }

    throw new Error(`Malformed GIF: unexpected block introducer 0x${intro.toString(16)}`);
  }

  if (!seenTrailer) throw new Error('Malformed GIF: missing trailer');

  let totalLength = 0;
  for (let i = 0; i < chunks.length; i++) {
    totalLength += chunks[i].length;
  }

  const cleaned = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (let i = 0; i < chunks.length; i++) {
    cleaned.set(chunks[i], writeOffset);
    writeOffset += chunks[i].length;
  }

  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: buffer.length - cleaned.length,
  };
}

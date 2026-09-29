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

  while (offset < len) {
    const intro = buffer[offset];

    if (intro === 0x3B) {
      // Trailer (End of GIF)
      chunks.push(new Uint8Array([0x3B]));
      break;
    }

    if (intro === 0x21) {
      // Extension block
      if (offset + 2 > len) break;
      const label = buffer[offset + 1];
      const extStart = offset;

      if (label === 0xFE) {
        // Comment Extension (0x21, 0xFE)
        offset += 2;
        // Skip sub-blocks
        while (offset < len) {
          const subLen = buffer[offset];
          offset++;
          if (subLen === 0) break;
          offset += subLen;
        }
        removedSegments.push('GIF Comment Extension');
        continue;
      } else if (label === 0x01) {
        // Plain Text Extension (0x21, 0x01)
        offset += 2;
        while (offset < len) {
          const subLen = buffer[offset];
          offset++;
          if (subLen === 0) break;
          offset += subLen;
        }
        removedSegments.push('GIF Plain Text Extension');
        continue;
      } else if (label === 0xFF) {
        // Application Extension
        const appBlockLen = buffer[offset + 2];
        const appId = String.fromCharCode(...buffer.slice(offset + 3, offset + 3 + Math.min(appBlockLen, 11)));
        
        offset += 3 + appBlockLen;
        // Check sub-blocks
        const subBlocksStart = offset;
        while (offset < len) {
          const subLen = buffer[offset];
          offset++;
          if (subLen === 0) break;
          offset += subLen;
        }

        if (appId.startsWith('NETSCAPE') || appId.startsWith('ANIMEXTS')) {
          // Animation control: KEEP
          chunks.push(buffer.slice(extStart, offset));
        } else {
          // XMP or third party vendor metadata: DROP
          removedSegments.push(`GIF Application Metadata (${appId.trim() || 'Vendor'})`);
        }
        continue;
      } else {
        // Graphic Control Extension (0xF9) or other extension -> KEEP
        offset += 2;
        while (offset < len) {
          const subLen = buffer[offset];
          offset++;
          if (subLen === 0) break;
          offset += subLen;
        }
        chunks.push(buffer.slice(extStart, offset));
        continue;
      }
    }

    if (intro === 0x2C) {
      // Image Descriptor (0x2C)
      const imgStart = offset;
      if (offset + 10 > len) break;
      const imgPacked = buffer[offset + 9];
      const hasLct = (imgPacked & 0x80) !== 0;
      const lctSize = hasLct ? 3 * Math.pow(2, (imgPacked & 0x07) + 1) : 0;

      offset += 10 + lctSize; // Image descriptor + LCT
      if (offset >= len) break;

      const lzwMinCodeSize = buffer[offset];
      offset++; // LZW min code size byte

      // Skip raster data sub-blocks
      while (offset < len) {
        const subLen = buffer[offset];
        offset++;
        if (subLen === 0) break;
        offset += subLen;
      }

      chunks.push(buffer.slice(imgStart, offset));
      continue;
    }

    // Unknown byte / padding, advance safely
    offset++;
  }

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

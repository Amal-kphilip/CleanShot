import { StripOptions } from './types';

/**
 * Lossless PNG chunk filter.
 * Drops ancillary metadata chunks (tEXt, zTXt, iTXt, eXIf, tIME, dSIG)
 * while strictly preserving critical image raster data (IHDR, PLTE, IDAT, IEND, tRNS).
 */
export function stripPng(buffer: Uint8Array, options: StripOptions = {}): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const keepIcc = options.keepIccProfile !== false; // Default true
  const removedSegments: string[] = [];

  // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length < 8 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4E ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0D ||
    buffer[5] !== 0x0A ||
    buffer[6] !== 0x1A ||
    buffer[7] !== 0x0A
  ) {
    throw new Error('Invalid PNG stream: Missing 8-byte PNG signature');
  }

  const chunks: Uint8Array[] = [];
  // Keep PNG 8-byte header
  chunks.push(buffer.slice(0, 8));

  let offset = 8;
  const len = buffer.length;

  while (offset < len) {
    if (offset + 8 > len) {
      // Malformed end; break safely
      break;
    }

    const dataLength =
      (buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3];

    const typeBytes = buffer.slice(offset + 4, offset + 8);
    const chunkType = String.fromCharCode(
      typeBytes[0],
      typeBytes[1],
      typeBytes[2],
      typeBytes[3]
    );

    const totalChunkLength = 12 + dataLength; // 4 len + 4 type + data + 4 crc
    if (offset + totalChunkLength > len) {
      // Chunk exceeds stream bounds
      break;
    }

    let shouldKeep = true;
    let segName = `PNG ${chunkType} chunk`;

    switch (chunkType) {
      // Metadata Chunks (ALWAYS STRIP)
      case 'tEXt':
        shouldKeep = false;
        segName = 'tEXt (Uncompressed text metadata)';
        removedSegments.push(segName);
        break;
      case 'zTXt':
        shouldKeep = false;
        segName = 'zTXt (Compressed text metadata)';
        removedSegments.push(segName);
        break;
      case 'iTXt':
        shouldKeep = false;
        segName = 'iTXt (International UTF-8 / XMP / XML metadata)';
        removedSegments.push(segName);
        break;
      case 'eXIf':
        shouldKeep = false;
        segName = 'eXIf (Embedded EXIF data)';
        removedSegments.push(segName);
        break;
      case 'tIME':
        shouldKeep = false;
        segName = 'tIME (Last modification timestamp)';
        removedSegments.push(segName);
        break;
      case 'dSIG':
        shouldKeep = false;
        segName = 'dSIG (Digital Signature / C2PA credentials)';
        removedSegments.push(segName);
        break;
      case 'prPt':
        shouldKeep = false;
        segName = 'prPt (Private property chunks)';
        removedSegments.push(segName);
        break;

      // Color Profile Chunks (Configurable)
      case 'iCCP':
        if (!keepIcc) {
          shouldKeep = false;
          removedSegments.push('iCCP (Embedded ICC Color Profile)');
        }
        break;
      case 'sRGB':
      case 'cHRM':
      case 'gAMA':
        if (!keepIcc) {
          shouldKeep = false;
          removedSegments.push(`${chunkType} (Color space calibration)`);
        }
        break;

      // Critical and Render Chunks (ALWAYS KEEP)
      case 'IHDR':
      case 'PLTE':
      case 'IDAT':
      case 'IEND':
      case 'tRNS':
      case 'pHYs': // Physical pixel dimensions (dpi)
      case 'acTL': // APNG Animation Control
      case 'fcTL': // APNG Frame Control
      case 'fdAT': // APNG Frame Data
      default:
        // By PNG specification:
        // Chunks with 5th bit set in 1st byte (lowercase first char) are ancillary
        shouldKeep = true;
        break;
    }

    if (shouldKeep) {
      chunks.push(buffer.slice(offset, offset + totalChunkLength));
    }

    offset += totalChunkLength;

    if (chunkType === 'IEND') {
      break;
    }
  }

  // Calculate clean length
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

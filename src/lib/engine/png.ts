import { StripOptions } from './types';
import { createOrientationOnlyExifPayload } from './orientation';

function calculatePngCrc(buffer: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk.set([...type].map((char) => char.charCodeAt(0)), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, calculatePngCrc(chunk, 4, 8 + data.length), false);
  return chunk;
}

/**
 * Lossless PNG chunk filter.
 * Drops all textual metadata (tEXt, zTXt, iTXt containing AI prompts/C2PA/XMP),
 * eXIf, tIME, dSIG, c2pa, and any non-critical vendor/AI chunks while strictly preserving
 * critical image raster data and allowlisted rendering chunks. Rejects unknown chunks rather than risk silently retaining private data.
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
  let seenIHDR = false;
  let seenIDAT = false;
  let seenIEND = false;

  while (offset < len) {
    if (offset + 8 > len) throw new Error('Malformed PNG: truncated chunk header');

    const dataLength = (
      (buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3]
    ) >>> 0;

    const typeBytes = buffer.slice(offset + 4, offset + 8);
    const chunkType = String.fromCharCode(
      typeBytes[0],
      typeBytes[1],
      typeBytes[2],
      typeBytes[3]
    );

    const totalChunkLength = 12 + dataLength; // 4 len + 4 type + data + 4 crc
    if (offset + totalChunkLength > len) {
      throw new Error(`Malformed PNG: truncated ${chunkType} chunk`);
    }
    if (!/^[A-Za-z]{4}$/.test(chunkType)) throw new Error('Malformed PNG: invalid chunk type');
    const crcOffset = offset + 8 + dataLength;
    const storedCrc = new DataView(buffer.buffer, buffer.byteOffset + crcOffset, 4).getUint32(0, false);
    const computedCrc = calculatePngCrc(buffer, offset + 4, crcOffset);
    if (storedCrc !== computedCrc) throw new Error(`Malformed PNG: checksum mismatch in ${chunkType} chunk`);
    if (offset === 8 && chunkType !== 'IHDR') throw new Error('Malformed PNG: IHDR must be the first chunk');
    if (chunkType === 'IHDR') {
      if (seenIHDR || dataLength !== 13) throw new Error('Malformed PNG: invalid IHDR chunk');
      seenIHDR = true;
    }
    if (chunkType === 'IDAT') seenIDAT = true;
    if (chunkType === 'IEND') {
      if (dataLength !== 0) throw new Error('Malformed PNG: IEND must be empty');
      seenIEND = true;
    }

    let shouldKeep = false;
    let replacementChunk: Uint8Array | undefined;
    let segName = `PNG ${chunkType} chunk`;

    switch (chunkType) {
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
      case 'bKGD': // Background color used by viewers
      case 'sBIT': // Significant bits affecting interpretation
      case 'hIST': // Palette histogram
      case 'sPLT': // Suggested palette
      case 'oFFs': // Pixel offset metadata used by image software
      case 'sCAL': // Physical scale
      case 'cICP': // Color space / transfer characteristics
      case 'mDCv': // Mastering display color volume
      case 'cLLi': // Content light level
        shouldKeep = true;
        break;

      // Color Profile Chunks (Configurable)
      case 'iCCP':
      case 'sRGB':
      case 'cHRM':
      case 'gAMA':
        if (keepIcc) {
          shouldKeep = true;
        } else {
          shouldKeep = false;
          removedSegments.push(`${chunkType} (Color calibration chunk)`);
        }
        break;

      // Metadata & AI Chunks (ALWAYS STRIP)
      case 'tEXt':
        shouldKeep = false;
        segName = 'tEXt (Text metadata / AI generation parameters)';
        removedSegments.push(segName);
        break;
      case 'zTXt':
        shouldKeep = false;
        segName = 'zTXt (Compressed text metadata / AI parameters)';
        removedSegments.push(segName);
        break;
      case 'iTXt':
        shouldKeep = false;
        segName = 'iTXt (UTF-8 metadata / XMP / C2PA manifest)';
        removedSegments.push(segName);
        break;
      case 'eXIf': {
        const orientationPayload = options.keepOrientation !== false
          ? createOrientationOnlyExifPayload(buffer.slice(offset + 8, offset + 8 + dataLength))
          : undefined;
        if (orientationPayload) {
          shouldKeep = true;
          replacementChunk = createPngChunk('eXIf', orientationPayload);
          segName = 'eXIf (EXIF removed; orientation tag preserved)';
        } else {
          shouldKeep = false;
          segName = 'eXIf (Embedded EXIF data)';
        }
        removedSegments.push(segName);
        break;
      }
      case 'tIME':
        shouldKeep = false;
        segName = 'tIME (Timestamp metadata)';
        removedSegments.push(segName);
        break;
      case 'dSIG':
      case 'c2pa':
        shouldKeep = false;
        segName = 'C2PA / Digital Signature Credential';
        removedSegments.push(segName);
        break;
      default: {
        // Unknown chunks may contain private metadata or affect rendering. Do not
        // pass them through or silently change the image: refuse to clean safely.
        const isAncillary = (typeBytes[0] & 0x20) !== 0;
        throw new Error(`PNG contains an unrecognized ${isAncillary ? 'ancillary' : 'critical'} chunk (${chunkType}); safe cleaning is not available for this variant.`);
      }
    }

    if (shouldKeep) {
      chunks.push(replacementChunk || buffer.slice(offset, offset + totalChunkLength));
    }

    offset += totalChunkLength;

    if (chunkType === 'IEND') {
      // Stop strictly at IEND, dropping any trailing payload/watermarks
      break;
    }
  }

  if (!seenIHDR || !seenIDAT || !seenIEND) throw new Error('Malformed PNG: required IHDR, IDAT, or IEND chunk is missing');

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

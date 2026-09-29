import { StripOptions } from './types';

/**
 * Lossless JPEG metadata stripper.
 * Operates purely on the JFIF/JPEG byte stream.
 * Strips APPn (EXIF, XMP, IPTC, Photoshop 8BIM) and COM (Comment) segments
 * without touching Quantization Tables (DQT), Huffman Tables (DHT), Frame Headers (SOF),
 * or entropy-coded DCT scan data (SOS -> EOI).
 */
export function stripJpeg(buffer: Uint8Array, options: StripOptions = {}): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const keepIcc = options.keepIccProfile !== false; // Default true
  const removedSegments: string[] = [];

  // Minimum JPEG size is 4 bytes (SOI + EOI)
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    throw new Error('Invalid JPEG stream: Missing Start of Image (SOI) marker');
  }

  // Pre-allocate output buffer array chunks
  const chunks: Uint8Array[] = [];
  
  // Write SOI (0xFF, 0xD8)
  chunks.push(new Uint8Array([0xFF, 0xD8]));

  let offset = 2;
  const len = buffer.length;

  while (offset < len) {
    // Scan for next marker (0xFF)
    if (buffer[offset] !== 0xFF) {
      // Corrupt or non-aligned marker; advance
      offset++;
      continue;
    }

    // Skip filler 0xFF bytes
    while (offset < len && buffer[offset] === 0xFF) {
      offset++;
    }

    if (offset >= len) break;

    const marker = buffer[offset];
    offset++;

    // Check for EOI (End of Image) or stand-alone markers without payload length
    if (marker === 0xD9) {
      // EOI
      chunks.push(new Uint8Array([0xFF, 0xD9]));
      break;
    }

    // RST0-RST7 (0xD0-0xD7) or TEM (0x01) - no length field
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      chunks.push(new Uint8Array([0xFF, marker]));
      continue;
    }

    // SOS (Start of Scan - 0xDA): contains length, followed by entropy-coded DCT stream up to EOI
    if (marker === 0xDA) {
      if (offset + 2 > len) break;
      const sosLen = (buffer[offset] << 8) | buffer[offset + 1];
      const scanStart = offset - 2; // includes 0xFF, 0xDA
      
      // The rest of the file from SOS until the end is the bitstream + EOI
      // Simply copy the entire remaining payload losslessly!
      chunks.push(buffer.slice(scanStart));
      break;
    }

    // Read segment length (16-bit big endian, includes the 2 length bytes)
    if (offset + 2 > len) break;
    const segLen = (buffer[offset] << 8) | buffer[offset + 1];
    if (segLen < 2 || offset + segLen > len) {
      // Malformed segment, copy remainder safely and break
      chunks.push(buffer.slice(offset - 2));
      break;
    }

    const segDataStart = offset + 2;
    const segDataLen = segLen - 2;
    const nextOffset = offset + segLen;

    let shouldKeep = true;
    let segName = `Marker 0x${marker.toString(16).toUpperCase()}`;

    // Evaluate segment type
    if (marker === 0xFE) {
      // COM (Comment)
      shouldKeep = false;
      segName = 'JPEG Comment (COM)';
      removedSegments.push(segName);
    } else if (marker === 0xE1) {
      // APP1: EXIF, XMP, C2PA
      shouldKeep = false;
      segName = 'APP1 (EXIF/XMP/C2PA)';
      removedSegments.push(segName);
    } else if (marker === 0xE2) {
      // APP2: ICC Profile or FlashPix / MPF
      const isIcc = segDataLen >= 12 &&
        buffer[segDataStart] === 0x49 &&     // 'I'
        buffer[segDataStart + 1] === 0x43 && // 'C'
        buffer[segDataStart + 2] === 0x43 && // 'C'
        buffer[segDataStart + 3] === 0x5F && // '_'
        buffer[segDataStart + 4] === 0x50 && // 'P'
        buffer[segDataStart + 5] === 0x52 && // 'R'
        buffer[segDataStart + 6] === 0x4F && // 'O'
        buffer[segDataStart + 7] === 0x46 && // 'F'
        buffer[segDataStart + 8] === 0x49 && // 'I'
        buffer[segDataStart + 9] === 0x4C && // 'L'
        buffer[segDataStart + 10] === 0x45 &&// 'E'
        buffer[segDataStart + 11] === 0x00;  // '\0'

      if (isIcc && keepIcc) {
        shouldKeep = true;
      } else {
        shouldKeep = false;
        segName = isIcc ? 'APP2 (ICC Profile stripped per setting)' : 'APP2 (FlashPix/MPF Preview)';
        removedSegments.push(segName);
      }
    } else if (marker === 0xED) {
      // APP13: Photoshop 8BIM / IPTC
      shouldKeep = false;
      segName = 'APP13 (Photoshop 8BIM / IPTC)';
      removedSegments.push(segName);
    } else if (marker === 0xEE) {
      // APP14: Adobe segment (color transform flag)
      const isAdobe = segDataLen >= 5 &&
        buffer[segDataStart] === 0x41 && // 'A'
        buffer[segDataStart + 1] === 0x64 && // 'd'
        buffer[segDataStart + 2] === 0x6F && // 'o'
        buffer[segDataStart + 3] === 0x62 && // 'b'
        buffer[segDataStart + 4] === 0x65;   // 'e'
      // Keep APP14 Adobe to prevent CMYK / YCCK color inversions
      shouldKeep = isAdobe;
      if (!shouldKeep) {
        segName = 'APP14 (Auxiliary Adobe Data)';
        removedSegments.push(segName);
      }
    } else if (marker >= 0xE3 && marker <= 0xEF) {
      // APP3 - APP15 (other vendor metadata segments)
      shouldKeep = false;
      segName = `APP${marker - 0xE0} (Vendor Metadata)`;
      removedSegments.push(segName);
    } else if (marker === 0xE0) {
      // APP0: JFIF standard header.
      // Keep standard JFIF to ensure broad compatibility with image decoders
      shouldKeep = true;
    } else {
      // Structural markers (DQT, DHT, SOF0..SOF15, DRI, etc.) -> ALWAYS KEEP
      shouldKeep = true;
    }

    if (shouldKeep) {
      // Copy marker (0xFF, marker) + 2 length bytes + segment data
      chunks.push(buffer.slice(offset - 2, nextOffset));
    }

    offset = nextOffset;
  }

  // Combine chunks into single clean Uint8Array
  let totalCleanLength = 0;
  for (let i = 0; i < chunks.length; i++) {
    totalCleanLength += chunks[i].length;
  }

  const cleaned = new Uint8Array(totalCleanLength);
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

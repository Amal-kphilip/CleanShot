import { StripOptions } from './types';

/**
 * Robust Lossless JPEG metadata stripper.
 * Strips all APPn segments (APP1 EXIF/XMP/C2PA, APP2 FlashPix/MPF, APP3-APP12, APP13 Photoshop 8BIM/IPTC,
 * APP14 non-essential tags, APP15), COM (comments), and any trailing data/watermarks appended after EOI (0xFFD9).
 * Preserves 100% untouched DCT entropy bitstream (SOF, DQT, DHT, DRI, SOS -> EOI).
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

  const chunks: Uint8Array[] = [];
  
  // Write SOI (0xFF, 0xD8)
  chunks.push(new Uint8Array([0xFF, 0xD8]));

  let offset = 2;
  const len = buffer.length;

  while (offset < len) {
    // Scan for marker prefix 0xFF
    if (buffer[offset] !== 0xFF) {
      offset++;
      continue;
    }

    // Skip consecutive fill bytes 0xFF
    while (offset < len && buffer[offset] === 0xFF) {
      offset++;
    }

    if (offset >= len) break;

    const marker = buffer[offset];
    offset++;

    // Check for EOI (End of Image - 0xD9)
    if (marker === 0xD9) {
      chunks.push(new Uint8Array([0xFF, 0xD9]));
      break;
    }

    // Stand-alone restart markers RST0-RST7 (0xD0-0xD7) or TEM (0x01)
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      chunks.push(new Uint8Array([0xFF, marker]));
      continue;
    }

    // SOS (Start of Scan - 0xDA)
    if (marker === 0xDA) {
      if (offset + 2 > len) break;
      const sosLen = (buffer[offset] << 8) | buffer[offset + 1];
      const scanStart = offset - 2; // includes 0xFF, 0xDA

      // Locate the true EOI (0xFF, 0xD9) marker within the entropy scan stream
      // ignoring escaped 0xFF 0x00 and RST markers (0xFF 0xD0..0xD7)
      let eoiPos = -1;
      let i = offset + sosLen;
      while (i < len - 1) {
        if (buffer[i] === 0xFF) {
          const nextB = buffer[i + 1];
          if (nextB === 0xD9) {
            // Found true EOI
            eoiPos = i + 2;
            break;
          } else if (nextB === 0x00 || (nextB >= 0xD0 && nextB <= 0xD7)) {
            // Escaped 0xFF byte or Restart marker, continue
            i += 2;
            continue;
          }
        }
        i++;
      }

      if (eoiPos !== -1) {
        // Copy strictly from SOS to EOI, dropping any trailing AI metadata or payload after EOI!
        chunks.push(buffer.slice(scanStart, eoiPos));
        if (eoiPos < len) {
          removedSegments.push(`Trailing AI/Metadata payload (${len - eoiPos} bytes) after EOI`);
        }
      } else {
        // Fallback: Copy to end if no explicit EOI found
        chunks.push(buffer.slice(scanStart));
      }
      break;
    }

    // Read 16-bit segment length (Big Endian)
    if (offset + 2 > len) break;
    const segLen = (buffer[offset] << 8) | buffer[offset + 1];
    if (segLen < 2 || offset + segLen > len) {
      // Corrupt length, break safely
      break;
    }

    const segDataStart = offset + 2;
    const segDataLen = segLen - 2;
    const nextOffset = offset + segLen;

    let shouldKeep = false;
    let segName = `Marker 0x${marker.toString(16).toUpperCase()}`;

    // Evaluate segment type
    if (marker === 0xFE) {
      // COM (Comment) - ALWAYS STRIP
      shouldKeep = false;
      segName = 'JPEG Comment (COM)';
      removedSegments.push(segName);
    } else if (marker === 0xE1) {
      // APP1: EXIF, XMP, ExtendedXMP, C2PA Manifests - ALWAYS STRIP
      shouldKeep = false;
      segName = 'APP1 (EXIF / XMP / C2PA / AI metadata)';
      removedSegments.push(segName);
    } else if (marker === 0xEB) {
      // APP11: C2PA / JUMBF (Content Authenticity / AI Generator Claims) - ALWAYS STRIP
      shouldKeep = false;
      segName = 'APP11 (C2PA / Content Credentials Manifest)';
      removedSegments.push(segName);
    } else if (marker === 0xED) {
      // APP13: Photoshop 8BIM / IPTC / SpecialInstructions - ALWAYS STRIP
      shouldKeep = false;
      segName = 'APP13 (Photoshop 8BIM / IPTC / AI Tags)';
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
        segName = isIcc ? 'APP2 (ICC Color Profile)' : 'APP2 (FlashPix/MPF Preview/C2PA)';
        removedSegments.push(segName);
      }
    } else if (marker === 0xEE) {
      // APP14: Adobe segment (color transform flag)
      const isAdobe = segDataLen >= 5 &&
        buffer[segDataStart] === 0x41 && // 'A'
        buffer[segDataStart + 1] === 0x64 && // 'd'
        buffer[segDataStart + 2] === 0x6F && // 'o'
        buffer[segDataStart + 3] === 0x62 && // 'b'
        buffer[segDataStart + 4] === 0x65;   // 'e'
      shouldKeep = isAdobe;
      if (!shouldKeep) {
        segName = 'APP14 (Auxiliary Adobe Data)';
        removedSegments.push(segName);
      }
    } else if (marker === 0xE0) {
      // APP0: JFIF standard header.
      // Keep basic 16-byte JFIF header, strip JFXX auxiliary extensions
      const isJfif = segDataLen >= 5 &&
        buffer[segDataStart] === 0x4A && // 'J'
        buffer[segDataStart + 1] === 0x46 && // 'F'
        buffer[segDataStart + 2] === 0x49 && // 'I'
        buffer[segDataStart + 3] === 0x46 && // 'F'
        buffer[segDataStart + 4] === 0x00;   // '\0'
      shouldKeep = isJfif;
      if (!shouldKeep) {
        segName = 'APP0 (Non-standard / JFXX extension)';
        removedSegments.push(segName);
      }
    } else if (marker >= 0xE3 && marker <= 0xEF) {
      // APP3 - APP15 (all other vendor metadata segments) - ALWAYS STRIP
      shouldKeep = false;
      segName = `APP${marker - 0xE0} (Vendor Metadata)`;
      removedSegments.push(segName);
    } else {
      // Critical structural frame markers: DQT, DHT, SOF0..SOF15, DRI, etc. - ALWAYS KEEP
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

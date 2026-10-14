import { StripOptions } from './types';
import { createOrientationOnlyJpegSegment } from './orientation';

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
  const keepIcc = options.keepIccProfile !== false;
  const removedSegments: string[] = [];
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Invalid JPEG stream: Missing Start of Image (SOI) marker');
  }

  const chunks: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
  const len = buffer.length;
  let offset = 2;
  let seenScan = false;
  let seenEoi = false;

  while (offset < len) {
    const markerStart = offset;
    if (buffer[offset] !== 0xff) {
      throw new Error('Malformed JPEG: expected a marker outside scan data');
    }
    while (offset < len && buffer[offset] === 0xff) offset++;
    if (offset >= len) throw new Error('Malformed JPEG: truncated marker');
    const marker = buffer[offset++];
    const markerBytes = buffer.slice(markerStart, offset);

    if (marker === 0xd9) {
      chunks.push(markerBytes);
      seenEoi = true;
      if (offset < len) removedSegments.push(`Trailing payload (${len - offset} bytes) after EOI`);
      break;
    }
    if (marker === 0xd8) throw new Error('Malformed JPEG: unexpected nested SOI marker');
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      chunks.push(markerBytes);
      continue;
    }
    if (offset + 2 > len) throw new Error('Malformed JPEG: truncated segment length');
    const segmentLength = (buffer[offset] << 8) | buffer[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > len) {
      throw new Error('Malformed JPEG: invalid or truncated segment');
    }

    const segmentDataStart = offset + 2;
    const segmentDataLength = segmentLength - 2;
    const segmentEnd = offset + segmentLength;
    let shouldKeep = true;

    if (marker === 0xda) {
      // SOS starts a compressed scan. Walk entropy data carefully so marker segments
      // between progressive scans are parsed too; otherwise an APP1/APP13 inserted
      // between scans could survive cleaning.
      chunks.push(buffer.slice(markerStart, segmentEnd));
      seenScan = true;
      let scanOffset = segmentEnd;
      let nextMarkerFound = false;
      while (scanOffset < len) {
        if (buffer[scanOffset] !== 0xff) {
          scanOffset++;
          continue;
        }
        let codeOffset = scanOffset + 1;
        while (codeOffset < len && buffer[codeOffset] === 0xff) codeOffset++;
        if (codeOffset >= len) throw new Error('Malformed JPEG: truncated marker in scan data');
        const code = buffer[codeOffset];
        // 0xFF00 is a stuffed data byte; restart markers may also appear in a scan.
        if (code === 0x00 || (code >= 0xd0 && code <= 0xd7)) {
          scanOffset = codeOffset + 1;
          continue;
        }
        // A structural marker ends this scan. Let the outer loop process it normally.
        chunks.push(buffer.slice(segmentEnd, scanOffset));
        offset = scanOffset;
        nextMarkerFound = true;
        break;
      }
      if (!nextMarkerFound) throw new Error('Malformed JPEG: scan ended without an EOI marker');
      continue;
    }

    let segmentLabel = `JPEG marker 0x${marker.toString(16).toUpperCase()}`;
    if (marker === 0xfe) {
      shouldKeep = false;
      segmentLabel = 'JPEG Comment (COM)';
    } else if (marker === 0xe1) {
      shouldKeep = false;
      const orientationOnly = options.keepOrientation !== false
        ? createOrientationOnlyJpegSegment(buffer.slice(segmentDataStart, segmentDataStart + segmentDataLength))
        : undefined;
      if (orientationOnly) chunks.push(orientationOnly);
      segmentLabel = orientationOnly
        ? 'APP1 (EXIF removed; orientation tag preserved)'
        : 'APP1 (EXIF / XMP / C2PA metadata)';
    } else if (marker === 0xe2) {
      const isIcc = segmentDataLength >= 12 &&
        buffer[segmentDataStart] === 0x49 && buffer[segmentDataStart + 1] === 0x43 &&
        buffer[segmentDataStart + 2] === 0x43 && buffer[segmentDataStart + 3] === 0x5f &&
        buffer[segmentDataStart + 4] === 0x50 && buffer[segmentDataStart + 5] === 0x52 &&
        buffer[segmentDataStart + 6] === 0x4f && buffer[segmentDataStart + 7] === 0x46 &&
        buffer[segmentDataStart + 8] === 0x49 && buffer[segmentDataStart + 9] === 0x4c &&
        buffer[segmentDataStart + 10] === 0x45 && buffer[segmentDataStart + 11] === 0x00;
      if (!isIcc || !keepIcc) {
        shouldKeep = false;
        segmentLabel = isIcc ? 'APP2 (ICC Color Profile)' : 'APP2 (FlashPix/MPF preview or vendor metadata)';
      }
    } else if (marker === 0xee) {
      const isAdobe = segmentDataLength >= 5 &&
        buffer[segmentDataStart] === 0x41 && buffer[segmentDataStart + 1] === 0x64 &&
        buffer[segmentDataStart + 2] === 0x6f && buffer[segmentDataStart + 3] === 0x62 &&
        buffer[segmentDataStart + 4] === 0x65;
      shouldKeep = isAdobe;
      if (!isAdobe) segmentLabel = 'APP14 (unknown auxiliary data)';
    } else if (marker === 0xe0) {
      const isJfif = segmentDataLength >= 5 &&
        buffer[segmentDataStart] === 0x4a && buffer[segmentDataStart + 1] === 0x46 &&
        buffer[segmentDataStart + 2] === 0x49 && buffer[segmentDataStart + 3] === 0x46 &&
        buffer[segmentDataStart + 4] === 0x00;
      shouldKeep = isJfif;
      if (!isJfif) segmentLabel = 'APP0 (non-JFIF auxiliary data)';
    } else if (marker >= 0xe0 && marker <= 0xef) {
      shouldKeep = false;
      segmentLabel = `APP${marker - 0xe0} (vendor metadata)`;
    }

    if (shouldKeep) chunks.push(buffer.slice(markerStart, segmentEnd));
    else removedSegments.push(segmentLabel);
    offset = segmentEnd;
  }

  if (!seenScan || !seenEoi) throw new Error('Malformed JPEG: missing scan data or EOI marker');

  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const cleaned = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    cleaned.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return { cleanedBuffer: cleaned, removedSegments, bytesSaved: buffer.length - cleaned.length };
}

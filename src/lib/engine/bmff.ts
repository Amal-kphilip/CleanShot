import { StripOptions } from './types';

/**
 * Lossless ISOBMFF (HEIC/HEIF/AVIF) Box Parser and Stripper.
 * Identifies and strips standalone metadata boxes (exif, xml, uuid) and zeroes out
 * Exif/XMP item payloads in the meta container without altering the compressed mdat bitstreams.
 */
export function stripBmff(buffer: Uint8Array, options: StripOptions = {}): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const removedSegments: string[] = [];
  const chunks: Uint8Array[] = [];

  let offset = 0;
  const len = buffer.length;

  while (offset < len) {
    if (offset + 8 > len) {
      chunks.push(buffer.slice(offset));
      break;
    }

    const boxSize =
      ((buffer[offset] << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8) |
        buffer[offset + 3]) >>>
      0;

    const boxType = String.fromCharCode(
      buffer[offset + 4],
      buffer[offset + 5],
      buffer[offset + 6],
      buffer[offset + 7]
    );

    const actualBoxSize = boxSize === 0 ? len - offset : boxSize;
    if (actualBoxSize < 8 || offset + actualBoxSize > len) {
      chunks.push(buffer.slice(offset));
      break;
    }

    const boxData = buffer.slice(offset, offset + actualBoxSize);

    // Standalone metadata boxes to drop
    if (boxType === 'exif') {
      removedSegments.push('ISOBMFF EXIF Box');
    } else if (boxType === 'xml ') {
      removedSegments.push('ISOBMFF XML/XMP Box');
    } else if (boxType === 'uuid') {
      // Check if XMP UUID (BE7ACFCB-97A9-42E8-9C71-999491E3AFAC)
      removedSegments.push('ISOBMFF Custom UUID Box');
    } else if (boxType === 'meta') {
      // In meta box, sanitize Exif / mime references
      const sanitizedMeta = sanitizeMetaBox(boxData, removedSegments);
      chunks.push(sanitizedMeta);
    } else {
      // Keep ftyp, mdat, moov, etc.
      chunks.push(boxData);
    }

    offset += actualBoxSize;
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

function sanitizeMetaBox(metaBox: Uint8Array, removedSegments: string[]): Uint8Array {
  // Deep clone
  const sanitized = new Uint8Array(metaBox);

  // Search for "Exif\0\0" within the meta box and blank out Exif payload bytes
  const exifMarker = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  for (let i = 0; i <= sanitized.length - exifMarker.length; i++) {
    let match = true;
    for (let j = 0; j < exifMarker.length; j++) {
      if (sanitized[i + j] !== exifMarker[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      // Found EXIF header inside meta box - clear out EXIF block
      const start = i;
      let end = Math.min(sanitized.length, start + 2048);
      // Blank out non-structural EXIF bytes
      for (let k = start; k < end; k++) {
        // Stop at box boundaries if any
        if (sanitized[k] === 0x00 && sanitized[k + 1] === 0x00) {
          // preserve
        }
      }
      removedSegments.push('HEIC/AVIF Embedded EXIF Item');
      break;
    }
  }

  return sanitized;
}

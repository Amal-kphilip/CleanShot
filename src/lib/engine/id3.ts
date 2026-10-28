import { concatBytes, matchesAscii, readSynchsafeUint32, readUint32LE } from './binary';

const EMPTY_ID3V24_HEADER = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

function hasLeadingId3(bytes: Uint8Array): boolean {
  return bytes.length >= 10 && matchesAscii(bytes, 0, 'ID3');
}

function isMpegAudioFrame(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

/**
 * FFmpeg writes its `Lavc...` encoder identifier into an AAC fill element.
 * Overwrite only the printable identifier bytes and keep the element size
 * and every audio bit at the same offset.
 */
export function stripAacEncoderIdentification(bytes: Uint8Array, removedSegments?: string[]): Uint8Array {
  const cleaned = bytes.slice();
  let offset = 0;

  if (cleaned.length < 9 || cleaned[0] !== 0xff || (cleaned[1] & 0xf6) !== 0xf0) return cleaned;
  const protectionAbsent = (cleaned[1] & 0x01) !== 0;
  const headerSize = protectionAbsent ? 7 : 9;
  const frameLength = ((cleaned[3] & 0x03) << 11) | (cleaned[4] << 3) | (cleaned[5] >>> 5);
  if (frameLength < headerSize + 2 || frameLength > cleaned.length) return cleaned;
  offset = headerSize;

  const firstWord = (cleaned[offset] << 8) | cleaned[offset + 1];
  if ((firstWord >>> 13) !== 6) return cleaned;
  let count = (firstWord >>> 9) & 0x0f;
  let fillHeaderBits = 7;
  if (count === 15) {
    const escapeCount = (firstWord >>> 1) & 0xff;
    if (escapeCount === 0) return cleaned;
    count += escapeCount - 1;
    fillHeaderBits += 8;
  }

  const fillStartBit = offset * 8 + fillHeaderBits;
  const fillEndBit = fillStartBit + count * 8;
  if (fillEndBit > frameLength * 8) return cleaned;

  const firstWholeByte = Math.ceil(fillStartBit / 8);
  const lastWholeByteExclusive = Math.floor(fillEndBit / 8);
  for (let i = firstWholeByte; i + 4 <= lastWholeByteExclusive; i++) {
    const isLibavIdentifier =
      cleaned[i] === 0x4c && // L
      cleaned[i + 1] === 0x61 && // a
      cleaned[i + 2] === 0x76 && // v
      (cleaned[i + 3] === 0x63 || cleaned[i + 3] === 0x66); // c/f
    if (!isLibavIdentifier) continue;

    let end = i + 4;
    while (end < lastWholeByteExclusive && cleaned[end] >= 0x20 && cleaned[end] <= 0x7e) end++;
    cleaned.fill(0, i, end);
    removedSegments?.push('AAC ADTS Libav encoder identifier');
    break;
  }

  return cleaned;
}

export function stripId3Tags(bytes: Uint8Array, removedSegments?: string[]): Uint8Array {
  let leadingEnd = 0;
  if (bytes.length >= 10 && matchesAscii(bytes, 0, 'ID3')) {
    const flags = bytes[5];
    const footerPresent = (flags & 0x10) !== 0;
    const size = readSynchsafeUint32(bytes, 6);
    const span = 10 + size + (footerPresent ? 10 : 0);
    if (span <= bytes.length) {
      leadingEnd = span;
      removedSegments?.push('ID3v2 tag');
    }
  }

  let id3v1Start: number | null = null;
  if (bytes.length - leadingEnd >= 128) {
    const candidate = bytes.length - 128;
    if (matchesAscii(bytes, candidate, 'TAG')) {
      id3v1Start = candidate;
      removedSegments?.push('ID3v1 tag');
    }
  }

  let extStart: number | null = null;
  if (id3v1Start !== null && id3v1Start - leadingEnd >= 227) {
    const candidate = id3v1Start - 227;
    if (matchesAscii(bytes, candidate, 'TAG+')) {
      extStart = candidate;
      removedSegments?.push('ID3v1 Extended tag');
    }
  }

  const beforeId3v1 = extStart ?? id3v1Start ?? bytes.length;

  let apeStart: number | null = null;
  if (beforeId3v1 - leadingEnd >= 32) {
    const footerStart = beforeId3v1 - 32;
    if (matchesAscii(bytes, footerStart, 'APETAGEX')) {
      const tagSize = readUint32LE(bytes, footerStart + 12);
      const flags = readUint32LE(bytes, footerStart + 16);
      const hasHeader = (flags & 0x80000000) !== 0;
      const fullSpan = tagSize + (hasHeader ? 32 : 0);
      const start = beforeId3v1 - fullSpan;
      if (start >= leadingEnd && start <= footerStart) {
        apeStart = start;
        removedSegments?.push('APEv2 tag');
      }
    }
  }

  const trailingBoundary = apeStart ?? beforeId3v1;

  if (leadingEnd >= trailingBoundary) return bytes;
  return bytes.subarray(leadingEnd, trailingBoundary);
}

export function stripMp3(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const removedSegments: string[] = [];
  let cleaned = stripId3Tags(bytes, removedSegments);
  if (hasLeadingId3(bytes) && !hasLeadingId3(cleaned) && isMpegAudioFrame(cleaned)) {
    cleaned = concatBytes([EMPTY_ID3V24_HEADER, cleaned]);
  }
  const out = new Uint8Array(cleaned.byteLength);
  out.set(cleaned);
  return {
    cleanedBuffer: out,
    removedSegments,
    bytesSaved: bytes.length - out.length,
  };
}

export function stripAac(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const removedSegments: string[] = [];
  const afterId3 = stripId3Tags(bytes, removedSegments);
  const cleaned = stripAacEncoderIdentification(afterId3, removedSegments);
  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: bytes.length - cleaned.length,
  };
}

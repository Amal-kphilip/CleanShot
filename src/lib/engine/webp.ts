import { StripOptions } from './types';

/**
 * Lossless WebP RIFF container stripper.
 * Strips EXIF and XMP metadata chunks, adjusts VP8X extended header feature flags,
 * and updates RIFF container payload length without decoding or altering VP8/VP8L/ALPH bitstreams.
 */
export function stripWebp(buffer: Uint8Array, options: StripOptions = {}): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const keepIcc = options.keepIccProfile !== false; // Default true
  const removedSegments: string[] = [];

  // Check RIFF header: "RIFF" (0-3) and "WEBP" (8-11)
  if (
    buffer.length < 12 ||
    buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46 ||
    buffer[8] !== 0x57 || buffer[9] !== 0x45 || buffer[10] !== 0x42 || buffer[11] !== 0x50
  ) {
    throw new Error('Invalid WebP file: Missing RIFF/WEBP signature');
  }

  interface WebpChunk {
    fourCC: string;
    rawHeaderAndData: Uint8Array;
    isVp8x?: boolean;
    vp8xFlags?: number;
  }

  const keptChunks: WebpChunk[] = [];
  let vp8xIndex = -1;
  let offset = 12;
  const len = buffer.length;

  let hadExif = false;
  let hadXmp = false;
  let hadIccp = false;

  while (offset < len) {
    if (offset + 8 > len) break;

    const fourCC = String.fromCharCode(
      buffer[offset],
      buffer[offset + 1],
      buffer[offset + 2],
      buffer[offset + 3]
    );

    const chunkSize =
      buffer[offset + 4] |
      (buffer[offset + 5] << 8) |
      (buffer[offset + 6] << 16) |
      (buffer[offset + 7] << 24);

    const paddedSize = chunkSize + (chunkSize % 2); // RIFF 2-byte chunk padding
    const totalChunkBytes = 8 + paddedSize;

    if (offset + 8 + chunkSize > len) {
      // Out of bounds chunk, copy remainder safely and break
      keptChunks.push({
        fourCC: 'RAW',
        rawHeaderAndData: buffer.slice(offset),
      });
      break;
    }

    const chunkDataStart = offset + 8;

    if (fourCC === 'VP8X') {
      // VP8X header (10 bytes payload: flags byte at index 0)
      const flags = buffer[chunkDataStart];
      vp8xIndex = keptChunks.length;
      keptChunks.push({
        fourCC: 'VP8X',
        rawHeaderAndData: buffer.slice(offset, offset + totalChunkBytes),
        isVp8x: true,
        vp8xFlags: flags,
      });
    } else if (fourCC === 'EXIF') {
      hadExif = true;
      removedSegments.push('EXIF Metadata chunk');
    } else if (fourCC === 'XMP ') {
      hadXmp = true;
      removedSegments.push('XMP Metadata chunk');
    } else if (fourCC === 'ICCP') {
      if (!keepIcc) {
        hadIccp = true;
        removedSegments.push('ICCP (ICC Color Profile chunk)');
      } else {
        keptChunks.push({
          fourCC,
          rawHeaderAndData: buffer.slice(offset, offset + totalChunkBytes),
        });
      }
    } else {
      // Critical visual data: 'VP8 ', 'VP8L', 'ALPH', 'ANIM', 'ANMF'
      keptChunks.push({
        fourCC,
        rawHeaderAndData: buffer.slice(offset, offset + totalChunkBytes),
      });
    }

    offset += totalChunkBytes;
  }

  // If we had a VP8X chunk and removed EXIF/XMP/ICCP, update VP8X flags
  if (vp8xIndex !== -1 && keptChunks[vp8xIndex]) {
    const vp8x = keptChunks[vp8xIndex];
    let flags = vp8x.vp8xFlags ?? 0;

    // Bitmask: ICCP(0x20), Alpha(0x10), EXIF(0x08), XMP(0x04), ANIM(0x02)
    if (hadExif) flags &= ~0x08;
    if (hadXmp) flags &= ~0x04;
    if (hadIccp && !keepIcc) flags &= ~0x20;

    // Clone header and update byte at offset 8 (flags)
    const updated = new Uint8Array(vp8x.rawHeaderAndData);
    updated[8] = flags;
    vp8x.rawHeaderAndData = updated;
  }

  // Calculate total payload size (RIFF header 12 bytes + sum of chunks)
  let totalChunksLength = 0;
  for (const c of keptChunks) {
    totalChunksLength += c.rawHeaderAndData.length;
  }

  const finalFileSize = 12 + totalChunksLength;
  const cleaned = new Uint8Array(finalFileSize);

  // Write "RIFF"
  cleaned[0] = 0x52; // 'R'
  cleaned[1] = 0x49; // 'I'
  cleaned[2] = 0x46; // 'F'
  cleaned[3] = 0x46; // 'F'

  // Write RIFF size (finalFileSize - 8) in 32-bit Little Endian
  const riffSize = finalFileSize - 8;
  cleaned[4] = riffSize & 0xFF;
  cleaned[5] = (riffSize >> 8) & 0xFF;
  cleaned[6] = (riffSize >> 16) & 0xFF;
  cleaned[7] = (riffSize >> 24) & 0xFF;

  // Write "WEBP"
  cleaned[8] = 0x57;  // 'W'
  cleaned[9] = 0x45;  // 'E'
  cleaned[10] = 0x42; // 'B'
  cleaned[11] = 0x50; // 'P'

  let writeOffset = 12;
  for (const c of keptChunks) {
    cleaned.set(c.rawHeaderAndData, writeOffset);
    writeOffset += c.rawHeaderAndData.length;
  }

  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: buffer.length - cleaned.length,
  };
}

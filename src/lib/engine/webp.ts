import { StripOptions } from './types';
import { createOrientationOnlyExifPayload } from './orientation';

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
  const declaredRiffSize = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(4, true);
  const riffEnd = declaredRiffSize + 8;
  if (riffEnd < 12 || riffEnd > buffer.length) throw new Error('Malformed WebP: RIFF size exceeds the available file data');
  let offset = 12;
  const len = riffEnd;

  let keptExifOrientation = false;

  while (offset < len) {
    if (offset + 8 > len) throw new Error('Malformed WebP: truncated chunk header');

    const fourCC = String.fromCharCode(
      buffer[offset],
      buffer[offset + 1],
      buffer[offset + 2],
      buffer[offset + 3]
    );

    const chunkSize = new DataView(buffer.buffer, buffer.byteOffset + offset + 4, 4).getUint32(0, true);

    const paddedSize = chunkSize + (chunkSize % 2); // RIFF 2-byte chunk padding
    const totalChunkBytes = 8 + paddedSize;

    if (offset + totalChunkBytes > len) throw new Error(`Malformed WebP: truncated ${fourCC} chunk`);

    const chunkDataStart = offset + 8;

    if (fourCC === 'VP8X') {
      // VP8X must be the first chunk and has a 10-byte payload.
      if (offset !== 12 || chunkSize !== 10 || vp8xIndex !== -1) throw new Error('Malformed WebP: invalid VP8X header position or size');
      const flags = buffer[chunkDataStart];
      vp8xIndex = keptChunks.length;
      keptChunks.push({
        fourCC: 'VP8X',
        rawHeaderAndData: buffer.slice(offset, offset + totalChunkBytes),
        isVp8x: true,
        vp8xFlags: flags,
      });
    } else if (fourCC === 'EXIF') {
      const orientationPayload = options.keepOrientation !== false
        ? createOrientationOnlyExifPayload(buffer.slice(chunkDataStart, chunkDataStart + chunkSize))
        : undefined;
      if (orientationPayload) {
        const paddedSize = orientationPayload.length + (orientationPayload.length % 2);
        const orientationChunk = new Uint8Array(8 + paddedSize);
        orientationChunk.set([0x45, 0x58, 0x49, 0x46], 0);
        new DataView(orientationChunk.buffer).setUint32(4, orientationPayload.length, true);
        orientationChunk.set(orientationPayload, 8);
        keptChunks.push({ fourCC: 'EXIF', rawHeaderAndData: orientationChunk });
        keptExifOrientation = true;
        removedSegments.push('EXIF metadata removed; orientation tag preserved');
      } else {
        removedSegments.push('EXIF Metadata chunk');
      }
    } else if (fourCC === 'XMP ') {
      removedSegments.push('XMP Metadata chunk');
    } else if (fourCC === 'ICCP') {
      if (!keepIcc) {
        removedSegments.push('ICCP (ICC Color Profile chunk)');
      } else {
        keptChunks.push({
          fourCC,
          rawHeaderAndData: buffer.slice(offset, offset + totalChunkBytes),
        });
      }
    } else if (['VP8 ', 'VP8L', 'ALPH', 'ANIM', 'ANMF'].includes(fourCC)) {
      keptChunks.push({
        fourCC,
        rawHeaderAndData: buffer.slice(offset, offset + totalChunkBytes),
      });
    } else {
      // Unknown chunks can contain private data or alter rendering. Avoid leaking
      // them or silently changing file semantics by refusing this variant.
      throw new Error(`WebP contains an unrecognized ${fourCC} chunk; safe cleaning is not available for this variant.`);
    }

    offset += totalChunkBytes;
  }

  if (offset !== len) throw new Error('Malformed WebP: chunks do not match the RIFF container size');

  // If we had a VP8X chunk and removed EXIF/XMP/ICCP, update VP8X flags
  if (vp8xIndex !== -1 && keptChunks[vp8xIndex]) {
    const vp8x = keptChunks[vp8xIndex];
    let flags = vp8x.vp8xFlags ?? 0;

    // Derive metadata feature bits from the chunks that actually remain.
    // This also repairs stale input flags when the corresponding chunk was absent.
    // Bitmask: ICCP(0x20), Alpha(0x10), EXIF(0x08), XMP(0x04), ANIM(0x02)
    const hasKeptIcc = keptChunks.some((chunk) => chunk.fourCC === 'ICCP');
    const hasKeptExif = keptChunks.some((chunk) => chunk.fourCC === 'EXIF');
    const hasKeptXmp = keptChunks.some((chunk) => chunk.fourCC === 'XMP ');
    flags = hasKeptIcc ? (flags | 0x20) : (flags & ~0x20);
    flags = hasKeptExif ? (flags | 0x08) : (flags & ~0x08);
    flags = hasKeptXmp ? (flags | 0x04) : (flags & ~0x04);

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

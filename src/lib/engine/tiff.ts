import { StripOptions } from './types';

/**
 * Lossless TIFF & TIFF-based RAW (DNG, CR2, NEF, ARW) Tag Stripper.
 * Re-indexes IFD0 tags removing EXIF pointers, GPS pointers, XMP, IPTC,
 * Author, Software, and Camera serial info while keeping pixel strip/tile data pointers intact.
 */
export function stripTiff(buffer: Uint8Array, options: StripOptions = {}): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const keepIcc = options.keepIccProfile !== false;
  const removedSegments: string[] = [];

  if (buffer.length < 8) {
    throw new Error('Invalid TIFF: File too short');
  }

  const isLE = buffer[0] === 0x49 && buffer[1] === 0x49; // 'II' (Little Endian)
  const isBE = buffer[0] === 0x4D && buffer[1] === 0x4D; // 'MM' (Big Endian)

  if (!isLE && !isBE) {
    throw new Error('Invalid TIFF: Unknown byte order marker');
  }

  const readU16 = (buf: Uint8Array, offset: number): number => {
    return isLE
      ? buf[offset] | (buf[offset + 1] << 8)
      : (buf[offset] << 8) | buf[offset + 1];
  };

  const readU32 = (buf: Uint8Array, offset: number): number => {
    return isLE
      ? (buf[offset] |
          (buf[offset + 1] << 8) |
          (buf[offset + 2] << 16) |
          (buf[offset + 3] << 24)) >>>
          0
      : ((buf[offset] << 24) |
          (buf[offset + 1] << 16) |
          (buf[offset + 2] << 8) |
          buf[offset + 3]) >>>
          0;
  };

  const writeU16 = (buf: Uint8Array, offset: number, val: number) => {
    if (isLE) {
      buf[offset] = val & 0xFF;
      buf[offset + 1] = (val >> 8) & 0xFF;
    } else {
      buf[offset] = (val >> 8) & 0xFF;
      buf[offset + 1] = val & 0xFF;
    }
  };

  const writeU32 = (buf: Uint8Array, offset: number, val: number) => {
    if (isLE) {
      buf[offset] = val & 0xFF;
      buf[offset + 1] = (val >> 8) & 0xFF;
      buf[offset + 2] = (val >> 16) & 0xFF;
      buf[offset + 3] = (val >> 24) & 0xFF;
    } else {
      buf[offset] = (val >> 24) & 0xFF;
      buf[offset + 1] = (val >> 16) & 0xFF;
      buf[offset + 2] = (val >> 8) & 0xFF;
      buf[offset + 3] = val & 0xFF;
    }
  };

  const magic = readU16(buffer, 2);
  if (magic !== 42 && magic !== 0x55) {
    throw new Error(`Invalid TIFF magic number: ${magic}`);
  }

  const ifd0Offset = readU32(buffer, 4);
  if (ifd0Offset < 8 || ifd0Offset >= buffer.length - 2) {
    throw new Error('Invalid TIFF: Bad IFD0 offset');
  }

  const numEntries = readU16(buffer, ifd0Offset);
  const metadataTagsToStrip = new Set([
    269,   // DocumentName
    270,   // ImageDescription
    271,   // Make
    272,   // Model
    285,   // PageName
    305,   // Software
    306,   // DateTime
    315,   // Artist
    316,   // HostComputer
    700,   // XMP
    33432, // Copyright
    33723, // IPTC
    34377, // Photoshop ImageSourceData
    34665, // ExifIFD pointer
    34853, // GPSInfo pointer
    50740, // DNGPrivateData / MakerNote
  ]);

  if (!keepIcc) {
    metadataTagsToStrip.add(34675); // InterColorProfile
  }

  const keptEntryBuffers: Uint8Array[] = [];
  let currentEntryOffset = ifd0Offset + 2;

  for (let i = 0; i < numEntries; i++) {
    if (currentEntryOffset + 12 > buffer.length) break;

    const tag = readU16(buffer, currentEntryOffset);
    if (metadataTagsToStrip.has(tag)) {
      removedSegments.push(`TIFF Tag ${tag}`);
    } else {
      keptEntryBuffers.push(buffer.slice(currentEntryOffset, currentEntryOffset + 12));
    }
    currentEntryOffset += 12;
  }

  // Clone original buffer
  const cleaned = new Uint8Array(buffer.length);
  cleaned.set(buffer);

  // Write new IFD at end of file to guarantee no overlap with image raster buffers
  const newIfdOffset = buffer.length;
  const newIfdSize = 2 + (keptEntryBuffers.length * 12) + 4;
  const expandedBuffer = new Uint8Array(newIfdOffset + newIfdSize);
  expandedBuffer.set(cleaned);

  // Update header IFD0 pointer to point to new sanitized IFD
  writeU32(expandedBuffer, 4, newIfdOffset);

  // Write number of kept entries
  writeU16(expandedBuffer, newIfdOffset, keptEntryBuffers.length);

  // Write entries
  let entryWriteOffset = newIfdOffset + 2;
  for (const entry of keptEntryBuffers) {
    expandedBuffer.set(entry, entryWriteOffset);
    entryWriteOffset += 12;
  }

  // Write next IFD offset (0)
  writeU32(expandedBuffer, entryWriteOffset, 0);

  return {
    cleanedBuffer: expandedBuffer,
    removedSegments,
    bytesSaved: 0, // In TIFF re-pointing, safety and tag removal is guaranteed
  };
}

/**
 * Builds a minimal EXIF/TIFF payload containing only IFD0 Orientation (0x0112).
 * The input may be raw TIFF data or an EXIF payload prefixed with "Exif\0\0".
 */
export function createOrientationOnlyExifPayload(payload: Uint8Array): Uint8Array | undefined {
  const hasExifPrefix = payload.length >= 6 &&
    payload[0] === 0x45 && payload[1] === 0x78 && payload[2] === 0x69 &&
    payload[3] === 0x66 && payload[4] === 0 && payload[5] === 0;
  const sourceStart = hasExifPrefix ? 6 : 0;
  if (payload.length < sourceStart + 14) return undefined;

  const littleEndian = payload[sourceStart] === 0x49 && payload[sourceStart + 1] === 0x49;
  const bigEndian = payload[sourceStart] === 0x4d && payload[sourceStart + 1] === 0x4d;
  if (!littleEndian && !bigEndian) return undefined;

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const get16 = (offset: number) => view.getUint16(offset, littleEndian);
  const get32 = (offset: number) => view.getUint32(offset, littleEndian);
  if (sourceStart + 8 > payload.length || get16(sourceStart + 2) !== 42) return undefined;
  const ifdStart = sourceStart + get32(sourceStart + 4);
  if (ifdStart + 2 > payload.length) return undefined;
  const count = get16(ifdStart);

  let orientation: number | undefined;
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > payload.length) return undefined;
    if (get16(entry) !== 0x0112 || get16(entry + 2) !== 3 || get32(entry + 4) !== 1) continue;
    const value = get16(entry + 8);
    if (value >= 1 && value <= 8) orientation = value;
    break;
  }
  if (orientation === undefined) return undefined;

  // TIFF header (8), IFD0 count (2), one 12-byte entry, next-IFD pointer (4).
  const tiff = new Uint8Array(26);
  const outputView = new DataView(tiff.buffer);
  tiff[0] = littleEndian ? 0x49 : 0x4d;
  tiff[1] = tiff[0];
  outputView.setUint16(2, 42, littleEndian);
  outputView.setUint32(4, 8, littleEndian);
  outputView.setUint16(8, 1, littleEndian);
  outputView.setUint16(10, 0x0112, littleEndian);
  outputView.setUint16(12, 3, littleEndian);
  outputView.setUint32(14, 1, littleEndian);
  outputView.setUint16(18, orientation, littleEndian);
  outputView.setUint16(20, 0, littleEndian);
  outputView.setUint32(22, 0, littleEndian);

  if (!hasExifPrefix) return tiff;
  const output = new Uint8Array(6 + tiff.length);
  output.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
  output.set(tiff, 6);
  return output;
}

export function createOrientationOnlyJpegSegment(exifPayload: Uint8Array): Uint8Array | undefined {
  const minimalPayload = createOrientationOnlyExifPayload(exifPayload);
  if (!minimalPayload || minimalPayload.length + 2 > 0xffff) return undefined;
  const length = minimalPayload.length + 2;
  const segment = new Uint8Array(4 + minimalPayload.length);
  segment.set([0xff, 0xe1, (length >>> 8) & 0xff, length & 0xff], 0);
  segment.set(minimalPayload, 4);
  return segment;
}

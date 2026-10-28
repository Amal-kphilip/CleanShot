import { readEbmlVint, isEbmlUnknownSize } from './binary';

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TAGS = 0x1254c367;
const ID_CHAPTERS = 0x1043a770;
const ID_ATTACHMENTS = 0x1941a469;
const ID_CLUSTER = 0x1f43b675;
const ID_SEEK_HEAD = 0x114d9b74;
const ID_CUES = 0x1c53bb6b;
const ID_VOID = 0xec;
const ID_CRC32 = 0xbf;
const ID_WRITING_APP = 0x5741;
const ID_MUXING_APP = 0x4d80;
const ID_TRACK_NAME = 0x536e;
const ID_TRACK_LANGUAGE = 0x22b59c;
const ID_EBML_HEADER = 0x1a45dfa3;

const SEGMENT_CHILD_IDS = new Set([
  ID_SEEK_HEAD,
  ID_INFO,
  ID_TRACKS,
  ID_CLUSTER,
  ID_CUES,
  ID_ATTACHMENTS,
  ID_CHAPTERS,
  ID_TAGS,
]);

const CLUSTER_CHILD_IDS = new Set([
  0xe7, // Timestamp
  0x5854, // SilentTracks
  0xa7, // Position
  0xab, // PrevSize
  0xa3, // SimpleBlock
  0xa0, // BlockGroup
  0xaf, // EncryptedBlock
  ID_VOID,
  ID_CRC32,
]);

type EbmlElement = { id: number; payloadStart: number; payloadEnd: number; unknownSize: boolean };

function readElement(bytes: Uint8Array, offset: number, rangeEnd: number): EbmlElement | null {
  const idVint = readEbmlVint(bytes, offset, true);
  if (!idVint) return null;
  const sizeVint = readEbmlVint(bytes, offset + idVint.length, false);
  if (!sizeVint) return null;

  const payloadStart = offset + idVint.length + sizeVint.length;
  const unknownSize = isEbmlUnknownSize(sizeVint.value, sizeVint.length);
  const payloadEnd = unknownSize ? rangeEnd : payloadStart + sizeVint.value;
  if (payloadEnd > rangeEnd || payloadEnd < payloadStart) return null;

  return { id: idVint.value, payloadStart, payloadEnd, unknownSize };
}

function neutralizeInfoStrings(bytes: Uint8Array, start: number, end: number, removedSegments: string[]): boolean {
  let offset = start;
  while (offset < end) {
    const el = readElement(bytes, offset, end);
    if (!el || el.unknownSize) return false;
    if (el.id === ID_WRITING_APP || el.id === ID_MUXING_APP) {
      for (let i = el.payloadStart; i < el.payloadEnd; i++) bytes[i] = 0;
      removedSegments.push(el.id === ID_WRITING_APP ? 'Matroska WritingApp' : 'Matroska MuxingApp');
    }
    offset = el.payloadEnd;
  }
  return true;
}

function neutralizeTrackEntry(bytes: Uint8Array, start: number, end: number, removedSegments: string[]): boolean {
  let offset = start;
  while (offset < end) {
    const el = readElement(bytes, offset, end);
    if (!el || el.unknownSize) return false;
    if (el.id === ID_TRACK_NAME || el.id === ID_TRACK_LANGUAGE) {
      for (let i = el.payloadStart; i < el.payloadEnd; i++) bytes[i] = 0;
      removedSegments.push(el.id === ID_TRACK_NAME ? 'Matroska TrackName' : 'Matroska TrackLanguage');
    }
    offset = el.payloadEnd;
  }
  return true;
}

function walkTracks(bytes: Uint8Array, start: number, end: number, removedSegments: string[]): boolean {
  let offset = start;
  while (offset < end) {
    const el = readElement(bytes, offset, end);
    if (!el || el.unknownSize) return false;
    if (el.id === ID_TRACK_ENTRY && !neutralizeTrackEntry(bytes, el.payloadStart, el.payloadEnd, removedSegments)) return false;
    offset = el.payloadEnd;
  }
  return true;
}

function findUnknownClusterEnd(bytes: Uint8Array, start: number, segmentEnd: number): number | null {
  let offset = start;
  while (offset < segmentEnd) {
    const child = readElement(bytes, offset, segmentEnd);
    if (!child) return null;
    if (SEGMENT_CHILD_IDS.has(child.id)) return offset;
    if (!CLUSTER_CHILD_IDS.has(child.id) || child.unknownSize) return null;
    offset = child.payloadEnd;
  }
  return segmentEnd;
}

function findVoidSizeVintLength(payloadLength: number): number | null {
  for (let n = 1; n <= 8; n++) {
    const remaining = payloadLength - 1 - n;
    if (remaining < 0) continue;
    if (remaining <= Math.pow(2, 7 * n) - 1) return n;
  }
  return null;
}

function neutralizeAsVoid(bytes: Uint8Array, start: number, end: number): boolean {
  const length = end - start;
  if (length === 0) return true;

  const n = findVoidSizeVintLength(length);
  if (n === null) return true;

  const remaining = length - 1 - n;
  bytes[start] = ID_VOID;

  const firstByteMarker = 0x80 >> (n - 1);
  let value = remaining;
  for (let i = n - 1; i >= 1; i--) {
    bytes[start + 1 + i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  bytes[start + 1] = (value & (firstByteMarker - 1)) | firstByteMarker;

  for (let i = start + 1 + n; i < end; i++) bytes[i] = 0;
  return true;
}

function walkAndNeutralize(
  bytes: Uint8Array,
  start: number,
  end: number,
  isTopLevel: boolean,
  removedSegments: string[],
): boolean {
  let offset = start;
  while (offset < end) {
    const el = readElement(bytes, offset, end);
    if (!el) return false;
    if (el.unknownSize && !(isTopLevel && el.id === ID_SEGMENT)) {
      if (el.id !== ID_CLUSTER) return false;
      const clusterEnd = findUnknownClusterEnd(bytes, el.payloadStart, end);
      if (clusterEnd === null || clusterEnd <= offset) return false;
      offset = clusterEnd;
      continue;
    }

    if (el.id === ID_SEGMENT) {
      if (!walkAndNeutralize(bytes, el.payloadStart, el.payloadEnd, false, removedSegments)) return false;
    } else if (el.id === ID_INFO) {
      if (!neutralizeInfoStrings(bytes, el.payloadStart, el.payloadEnd, removedSegments)) return false;
    } else if (el.id === ID_TRACKS) {
      if (!walkTracks(bytes, el.payloadStart, el.payloadEnd, removedSegments)) return false;
    } else if (el.id === ID_TAGS || el.id === ID_CHAPTERS || el.id === ID_ATTACHMENTS) {
      if (!neutralizeAsVoid(bytes, el.payloadStart, el.payloadEnd)) return false;
      const label = el.id === ID_TAGS ? 'Matroska Tags' : el.id === ID_CHAPTERS ? 'Matroska Chapters' : 'Matroska Attachments';
      removedSegments.push(label);
    }

    offset = el.payloadEnd;
  }
  return true;
}

export function stripMatroska(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const header = readEbmlVint(bytes, 0, true);
  if (!header || header.value !== ID_EBML_HEADER) {
    throw new Error('Malformed Matroska/WebM container: missing EBML header');
  }

  const removedSegments: string[] = [];
  const result = bytes.slice();
  if (!walkAndNeutralize(result, 0, result.length, true, removedSegments)) {
    throw new Error('Malformed or unsupported Matroska/WebM element structure');
  }

  return {
    cleanedBuffer: result,
    removedSegments,
    bytesSaved: bytes.length - result.length,
  };
}

import { concatBytes, readUint32LE, writeUint32LE } from './binary';

type RiffChunk = { id: string; payloadStart: number; payloadSize: number; end: number };

function readChunkHeader(bytes: Uint8Array, offset: number): RiffChunk | null {
  if (offset + 8 > bytes.length) return null;
  const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  const payloadSize = readUint32LE(bytes, offset + 4);
  const payloadStart = offset + 8;
  if (payloadStart + payloadSize > bytes.length) return null;
  const pad = payloadSize % 2 === 1 ? 1 : 0;
  return { id, payloadStart, payloadSize, end: payloadStart + payloadSize + pad };
}

/**
 * Strips metadata chunks from a WAV file by dropping LIST/INFO, `bext` and
 * `id3 ` chunks entirely and copying everything else byte-for-byte (`fmt `,
 * `data`, `fact` are never touched).
 */
export function stripRiffWav(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  if (bytes.length < 12) {
    throw new Error('Invalid WAV file: header is too short');
  }
  const riffId = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const formType = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riffId !== 'RIFF' || formType !== 'WAVE') {
    throw new Error('Invalid WAV file: missing RIFF/WAVE signature');
  }

  const removedSegments: string[] = [];
  const kept: Uint8Array[] = [];
  let offset = 12;

  while (offset < bytes.length) {
    const chunk = readChunkHeader(bytes, offset);
    if (!chunk) {
      throw new Error('Malformed WAV file: truncated or invalid RIFF chunk');
    }
    const { id, payloadStart, payloadSize, end } = chunk;

    if (id === 'LIST' && payloadSize >= 4) {
      const listType = String.fromCharCode(...bytes.subarray(payloadStart, payloadStart + 4));
      if (listType === 'INFO') {
        removedSegments.push('WAV LIST/INFO metadata chunk');
        offset = end;
        continue;
      }
      kept.push(bytes.subarray(offset, end));
      offset = end;
      continue;
    }

    if (id === 'bext' || id.toLowerCase() === 'id3 ') {
      removedSegments.push(id === 'bext' ? 'WAV Broadcast Wave (bext) chunk' : 'WAV ID3 metadata chunk');
      offset = end;
      continue;
    }

    kept.push(bytes.subarray(offset, end));
    offset = end;
  }

  const result = concatBytes([bytes.subarray(0, 12), ...kept]);
  writeUint32LE(result, 4, result.length - 8);
  return {
    cleanedBuffer: result,
    removedSegments,
    bytesSaved: bytes.length - result.length,
  };
}

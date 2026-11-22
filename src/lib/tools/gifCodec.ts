/**
 * Pure TypeScript GIF87a/GIF89a Decoder, Frame Compositor, Palette Quantizer, and LZW Encoder.
 * Works identically in browser main threads, Web Workers, and Node.js test environments.
 */

export interface GifFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  delayCs: number;
  disposalMethod: number;
  userInputFlag: boolean;
  transparentIndex: number;
  interlaced: boolean;
  sortFlag: boolean;
  localColorTable: Uint8Array | null;
  indices: Uint8Array;
}

export interface DecodedGif {
  version: 'GIF87a' | 'GIF89a';
  width: number;
  height: number;
  lsdPacked: number;
  backgroundColorIndex: number;
  pixelAspectRatio: number;
  globalColorTable: Uint8Array | null;
  loopCount: number | null;
  frames: GifFrame[];
}

export interface EncodedGifFrameInput {
  left: number;
  top: number;
  width: number;
  height: number;
  delayCs: number;
  disposalMethod: number;
  userInputFlag?: boolean;
  transparentIndex: number;
  localColorTable: Uint8Array | null;
  indices: Uint8Array;
}

export interface EncodeGifInput {
  width: number;
  height: number;
  lsdPacked?: number;
  backgroundColorIndex?: number;
  pixelAspectRatio?: number;
  globalColorTable: Uint8Array | null;
  loopCount: number | null;
  frames: EncodedGifFrameInput[];
}

function readSubBlocks(
  bytes: Uint8Array,
  startOffset: number,
): { data: Uint8Array; nextOffset: number } {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  let offset = startOffset;

  while (offset < bytes.length) {
    const blockSize = bytes[offset++];
    if (blockSize === 0) {
      const merged = new Uint8Array(totalLength);
      let pos = 0;
      for (const chunk of chunks) {
        merged.set(chunk, pos);
        pos += chunk.length;
      }
      return { data: merged, nextOffset: offset };
    }
    if (offset + blockSize > bytes.length) {
      throw new Error('Invalid or truncated GIF sub-block.');
    }
    chunks.push(bytes.subarray(offset, offset + blockSize));
    totalLength += blockSize;
    offset += blockSize;
  }

  throw new Error('Invalid or truncated GIF: missing sub-block terminator.');
}

function skipSubBlocks(bytes: Uint8Array, startOffset: number): number {
  let offset = startOffset;
  while (offset < bytes.length) {
    const size = bytes[offset++];
    if (size === 0) return offset;
    if (offset + size > bytes.length) {
      throw new Error('Invalid or truncated GIF extension sub-block.');
    }
    offset += size;
  }
  throw new Error('Invalid or truncated GIF extension.');
}

/**
 * Decodes GIF LZW-compressed index stream into `pixelCount` palette indices.
 */
export function lzwDecode(
  minCodeSize: number,
  compressed: Uint8Array,
  pixelCount: number,
  defaultIndex = 0,
): Uint8Array {
  if (minCodeSize < 2 || minCodeSize > 11) {
    throw new Error(`Invalid GIF LZW minimum code size: ${minCodeSize}`);
  }

  const MAX_DICT_SIZE = 4096;
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  const prefix = new Int32Array(MAX_DICT_SIZE);
  const suffix = new Uint8Array(MAX_DICT_SIZE);
  const pixelStack = new Uint8Array(MAX_DICT_SIZE + 1);

  const output = new Uint8Array(pixelCount);
  if (defaultIndex !== 0) {
    output.fill(defaultIndex);
  }

  let available = clearCode + 2;
  let oldCode = -1;
  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let firstByte = 0;

  for (let code = 0; code < clearCode; code++) {
    prefix[code] = -1;
    suffix[code] = code;
  }

  let datum = 0;
  let bits = 0;
  let bytePos = 0;
  let stackTop = 0;
  let outPos = 0;

  while (outPos < pixelCount) {
    if (stackTop > 0) {
      output[outPos++] = pixelStack[--stackTop];
      continue;
    }

    while (bits < codeSize) {
      if (bytePos >= compressed.length) {
        return output;
      }
      datum |= compressed[bytePos++] << bits;
      bits += 8;
    }

    let code = datum & codeMask;
    datum >>>= codeSize;
    bits -= codeSize;

    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      codeMask = (1 << codeSize) - 1;
      available = clearCode + 2;
      oldCode = -1;
      continue;
    }

    if (code === eoiCode || code > available) {
      break;
    }

    if (oldCode === -1) {
      output[outPos++] = suffix[code];
      oldCode = code;
      firstByte = code;
      continue;
    }

    const inCode = code;
    if (code === available) {
      pixelStack[stackTop++] = firstByte;
      code = oldCode;
    }

    let guard = 0;
    while (code >= clearCode) {
      if (guard++ > MAX_DICT_SIZE) {
        throw new Error('Corrupted GIF LZW dictionary cycle detected.');
      }
      pixelStack[stackTop++] = suffix[code];
      code = prefix[code];
    }

    firstByte = suffix[code];
    pixelStack[stackTop++] = firstByte;

    if (available < MAX_DICT_SIZE) {
      prefix[available] = oldCode;
      suffix[available] = firstByte;
      available++;
      if ((available & codeMask) === 0 && available < MAX_DICT_SIZE) {
        codeSize++;
        codeMask = (1 << codeSize) - 1;
      }
    }

    oldCode = inCode;
  }

  return output;
}

const sharedLzwHashTable = new Int32Array(4096 * 256);

/**
 * Encodes a flat `Uint8Array` of palette indices into GIF LZW sub-blocks
 * (prefixed with the LZW minimum code size byte and terminated with `0x00`).
 */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const safeMinCodeSize = Math.max(2, Math.min(8, minCodeSize));
  const clearCode = 1 << safeMinCodeSize;
  const eoiCode = clearCode + 1;
  const maxTableEntries = 4096 * 256;

  sharedLzwHashTable.fill(-1, 0, maxTableEntries);

  const rawBytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let codeSize = safeMinCodeSize + 1;
  let nextCode = clearCode + 2;

  const emitCode = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      rawBytes.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  emitCode(clearCode);

  if (indices.length > 0) {
    const mask = (1 << safeMinCodeSize) - 1;
    let ent = indices[0] & mask;

    for (let i = 1; i < indices.length; i++) {
      const k = indices[i] & mask;
      const tableKey = (ent << 8) | k;
      const existing = sharedLzwHashTable[tableKey];

      if (existing !== -1) {
        ent = existing;
      } else {
        emitCode(ent);
        if (nextCode < 4096) {
          sharedLzwHashTable[tableKey] = nextCode;
          if (nextCode > (1 << codeSize) - 1 && codeSize < 12) {
            codeSize++;
          }
          nextCode++;
        } else {
          emitCode(clearCode);
          sharedLzwHashTable.fill(-1, 0, maxTableEntries);
          codeSize = safeMinCodeSize + 1;
          nextCode = clearCode + 2;
        }
        ent = k;
      }
    }

    emitCode(ent);
  }

  emitCode(eoiCode);
  if (bitCount > 0) {
    rawBytes.push(bitBuffer & 0xff);
  }

  // Pack into 1-byte minCodeSize + sub-blocks of up to 255 bytes + 0x00 terminator
  const numFullBlocks = Math.floor(rawBytes.length / 255);
  const rem = rawBytes.length % 255;
  const totalOutLen = 1 + numFullBlocks * 256 + (rem > 0 ? 1 + rem : 0) + 1;
  const out = new Uint8Array(totalOutLen);

  let writePos = 0;
  out[writePos++] = safeMinCodeSize;

  let readPos = 0;
  while (readPos < rawBytes.length) {
    const chunkLen = Math.min(255, rawBytes.length - readPos);
    out[writePos++] = chunkLen;
    for (let j = 0; j < chunkLen; j++) {
      out[writePos++] = rawBytes[readPos++];
    }
  }
  out[writePos++] = 0x00;

  return out;
}

function deinterlaceIndices(
  raw: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(width * height);
  const starts = [0, 4, 2, 1];
  const steps = [8, 8, 4, 2];
  let srcRow = 0;

  for (let pass = 0; pass < 4; pass++) {
    for (let dstRow = starts[pass]; dstRow < height; dstRow += steps[pass]) {
      if (srcRow >= height) break;
      const srcOffset = srcRow * width;
      const dstOffset = dstRow * width;
      out.set(raw.subarray(srcOffset, srcOffset + width), dstOffset);
      srcRow++;
    }
  }
  return out;
}

/**
 * Decodes a GIF87a/GIF89a byte buffer into its screen header, loop count, and
 * decompressed frame descriptors.
 */
export function decodeGif(bytes: Uint8Array): DecodedGif {
  if (bytes.length < 13) {
    throw new Error('Invalid GIF file: buffer is too small.');
  }
  const sig = String.fromCharCode(
    bytes[0],
    bytes[1],
    bytes[2],
    bytes[3],
    bytes[4],
    bytes[5],
  );
  if (sig !== 'GIF87a' && sig !== 'GIF89a') {
    throw new Error('Invalid GIF file: missing GIF87a/GIF89a signature.');
  }

  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  if (width <= 0 || height <= 0) {
    throw new Error('Invalid GIF file: zero logical screen dimensions.');
  }

  const lsdPacked = bytes[10];
  const backgroundColorIndex = bytes[11];
  const pixelAspectRatio = bytes[12];
  let offset = 13;

  let globalColorTable: Uint8Array | null = null;
  if ((lsdPacked & 0x80) !== 0) {
    const gctEntries = 1 << ((lsdPacked & 0x07) + 1);
    const gctBytes = gctEntries * 3;
    if (offset + gctBytes > bytes.length) {
      throw new Error('Invalid GIF file: truncated Global Color Table.');
    }
    globalColorTable = bytes.slice(offset, offset + gctBytes);
    offset += gctBytes;
  }

  let loopCount: number | null = null;
  const frames: GifFrame[] = [];

  let pendingDisposal = 0;
  let pendingUserInput = false;
  let pendingDelayCs = 0;
  let pendingTransparentIndex = -1;

  while (offset < bytes.length) {
    const blockId = bytes[offset];

    if (blockId === 0x3b) {
      // GIF Trailer
      break;
    }

    if (blockId === 0x00) {
      // Tolerate stray 0x00 padding between blocks
      offset++;
      continue;
    }

    if (blockId === 0x21) {
      // Extension block
      if (offset + 2 >= bytes.length) {
        throw new Error('Invalid GIF file: truncated extension header.');
      }
      const label = bytes[offset + 1];

      if (label === 0xf9) {
        // Graphic Control Extension
        const blockSize = bytes[offset + 2];
        if (offset + 3 + blockSize >= bytes.length || blockSize < 4) {
          throw new Error('Invalid GIF file: malformed Graphic Control Extension.');
        }
        const packed = bytes[offset + 3];
        pendingDisposal = (packed >>> 2) & 0x07;
        pendingUserInput = (packed & 0x02) !== 0;
        const transparentFlag = (packed & 0x01) !== 0;
        pendingDelayCs = bytes[offset + 4] | (bytes[offset + 5] << 8);
        pendingTransparentIndex = transparentFlag ? bytes[offset + 6] : -1;
        offset = skipSubBlocks(bytes, offset + 2);
        continue;
      }

      if (label === 0xff) {
        // Application Extension
        const appHeaderSize = bytes[offset + 2];
        if (offset + 3 + appHeaderSize > bytes.length) {
          throw new Error('Invalid GIF file: truncated Application Extension.');
        }
        const appId = String.fromCharCode(
          ...bytes.subarray(offset + 3, offset + 3 + appHeaderSize),
        );
        const subBlocksStart = offset + 3 + appHeaderSize;
        if (appId === 'NETSCAPE2.0' || appId === 'ANIMEXTS1.0') {
          const { data, nextOffset } = readSubBlocks(bytes, subBlocksStart);
          if (data.length >= 3 && data[0] === 0x01) {
            loopCount = data[1] | (data[2] << 8);
          }
          offset = nextOffset;
          continue;
        }
        offset = skipSubBlocks(bytes, subBlocksStart);
        continue;
      }

      // Comment (0xFE), Plain Text (0x01), or other extension
      offset = skipSubBlocks(bytes, offset + 2);
      continue;
    }

    if (blockId === 0x2c) {
      // Image Descriptor
      if (offset + 10 > bytes.length) {
        throw new Error('Invalid GIF file: truncated Image Descriptor.');
      }
      const left = bytes[offset + 1] | (bytes[offset + 2] << 8);
      const top = bytes[offset + 3] | (bytes[offset + 4] << 8);
      const frameWidth = bytes[offset + 5] | (bytes[offset + 6] << 8);
      const frameHeight = bytes[offset + 7] | (bytes[offset + 8] << 8);
      const imgPacked = bytes[offset + 9];
      offset += 10;

      if (frameWidth <= 0 || frameHeight <= 0) {
        throw new Error('Invalid GIF file: frame has zero dimensions.');
      }

      const hasLct = (imgPacked & 0x80) !== 0;
      const interlaced = (imgPacked & 0x40) !== 0;
      const sortFlag = (imgPacked & 0x20) !== 0;
      let localColorTable: Uint8Array | null = null;

      if (hasLct) {
        const lctEntries = 1 << ((imgPacked & 0x07) + 1);
        const lctBytes = lctEntries * 3;
        if (offset + lctBytes > bytes.length) {
          throw new Error('Invalid GIF file: truncated Local Color Table.');
        }
        localColorTable = bytes.slice(offset, offset + lctBytes);
        offset += lctBytes;
      }

      if (!localColorTable && !globalColorTable) {
        throw new Error('Invalid GIF file: frame has neither Local nor Global Color Table.');
      }

      if (offset >= bytes.length) {
        throw new Error('Invalid GIF file: missing LZW minimum code size.');
      }
      const lzwMinCodeSize = bytes[offset++];
      const { data: compressedData, nextOffset } = readSubBlocks(bytes, offset);
      offset = nextOffset;

      const pixelCount = frameWidth * frameHeight;
      const defaultIdx = pendingTransparentIndex >= 0 ? pendingTransparentIndex : 0;
      const rawIndices = lzwDecode(lzwMinCodeSize, compressedData, pixelCount, defaultIdx);
      const indices = interlaced
        ? deinterlaceIndices(rawIndices, frameWidth, frameHeight)
        : rawIndices;

      frames.push({
        left,
        top,
        width: frameWidth,
        height: frameHeight,
        delayCs: pendingDelayCs,
        disposalMethod: pendingDisposal,
        userInputFlag: pendingUserInput,
        transparentIndex: pendingTransparentIndex,
        interlaced,
        sortFlag,
        localColorTable,
        indices,
      });

      pendingDisposal = 0;
      pendingUserInput = false;
      pendingDelayCs = 0;
      pendingTransparentIndex = -1;
      continue;
    }

    throw new Error(`Invalid GIF file: unexpected block marker 0x${blockId.toString(16)}.`);
  }

  if (frames.length === 0) {
    throw new Error('Invalid GIF file: contains no image frames.');
  }

  return {
    version: sig,
    width,
    height,
    lsdPacked,
    backgroundColorIndex,
    pixelAspectRatio,
    globalColorTable,
    loopCount,
    frames,
  };
}

function normalizePaletteTable(palette: Uint8Array): {
  padded: Uint8Array;
  sizeBits: number;
  entries: number;
} {
  const rawEntries = Math.max(2, Math.ceil(palette.length / 3));
  let sizeBits = 0;
  while (1 << (sizeBits + 1) < rawEntries && sizeBits < 7) {
    sizeBits++;
  }
  const entries = 1 << (sizeBits + 1);
  const padded = new Uint8Array(entries * 3);
  padded.set(palette.subarray(0, Math.min(palette.length, padded.length)));
  return { padded, sizeBits, entries };
}

/**
 * Encodes a complete GIF89a (or static GIF) stream from frame descriptors and palettes.
 * If `frames.length === 1` and `loopCount === null`, emits a static GIF without a loop block.
 */
export function encodeGif(input: EncodeGifInput): Uint8Array {
  const chunks: Uint8Array[] = [];

  // Always use GIF89a header so Graphic Control Extension (transparency/timing) is standard
  chunks.push(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])); // "GIF89a"

  let lsdPacked = input.lsdPacked ?? 0x70;
  let gctPadded: Uint8Array | null = null;
  if (input.globalColorTable && input.globalColorTable.length >= 6) {
    const norm = normalizePaletteTable(input.globalColorTable);
    gctPadded = norm.padded;
    lsdPacked = (lsdPacked & 0x78) | 0x80 | norm.sizeBits;
  } else {
    lsdPacked &= ~0x80;
  }

  const lsd = new Uint8Array(7);
  lsd[0] = input.width & 0xff;
  lsd[1] = (input.width >>> 8) & 0xff;
  lsd[2] = input.height & 0xff;
  lsd[3] = (input.height >>> 8) & 0xff;
  lsd[4] = lsdPacked;
  lsd[5] = input.backgroundColorIndex ?? 0;
  lsd[6] = input.pixelAspectRatio ?? 0;
  chunks.push(lsd);

  if (gctPadded) {
    chunks.push(gctPadded);
  }

  // Emit NETSCAPE2.0 loop extension only for animated GIFs (or if explicit loopCount is present on multi-frame GIF)
  if (input.frames.length > 1 && input.loopCount !== null) {
    const loop = Math.max(0, Math.min(0xffff, input.loopCount));
    chunks.push(
      new Uint8Array([
        0x21,
        0xff,
        0x0b,
        0x4e,
        0x45,
        0x54,
        0x53,
        0x43,
        0x41,
        0x50,
        0x45,
        0x32,
        0x2e,
        0x30, // "NETSCAPE2.0"
        0x03,
        0x01,
        loop & 0xff,
        (loop >>> 8) & 0xff,
        0x00,
      ]),
    );
  }

  for (const frame of input.frames) {
    const hasTransparency = frame.transparentIndex >= 0 && frame.transparentIndex <= 255;
    const needsGce =
      input.frames.length > 1 ||
      hasTransparency ||
      frame.delayCs > 0 ||
      frame.disposalMethod > 0 ||
      Boolean(frame.userInputFlag);

    if (needsGce) {
      const gcePacked =
        ((frame.disposalMethod & 0x07) << 2) |
        (frame.userInputFlag ? 0x02 : 0) |
        (hasTransparency ? 0x01 : 0);
      const delay = Math.max(0, Math.min(0xffff, frame.delayCs));
      chunks.push(
        new Uint8Array([
          0x21,
          0xf9,
          0x04,
          gcePacked,
          delay & 0xff,
          (delay >>> 8) & 0xff,
          hasTransparency ? frame.transparentIndex : 0,
          0x00,
        ]),
      );
    }

    let lctPadded: Uint8Array | null = null;
    let imgPacked = 0;
    let paletteEntries = gctPadded ? gctPadded.length / 3 : 256;

    if (frame.localColorTable && frame.localColorTable.length >= 6) {
      const norm = normalizePaletteTable(frame.localColorTable);
      lctPadded = norm.padded;
      imgPacked = 0x80 | norm.sizeBits;
      paletteEntries = norm.entries;
    }

    const imgDesc = new Uint8Array(10);
    imgDesc[0] = 0x2c;
    imgDesc[1] = frame.left & 0xff;
    imgDesc[2] = (frame.left >>> 8) & 0xff;
    imgDesc[3] = frame.top & 0xff;
    imgDesc[4] = (frame.top >>> 8) & 0xff;
    imgDesc[5] = frame.width & 0xff;
    imgDesc[6] = (frame.width >>> 8) & 0xff;
    imgDesc[7] = frame.height & 0xff;
    imgDesc[8] = (frame.height >>> 8) & 0xff;
    imgDesc[9] = imgPacked;
    chunks.push(imgDesc);

    if (lctPadded) {
      chunks.push(lctPadded);
    }

    const minCodeSize = Math.max(2, Math.min(8, Math.ceil(Math.log2(Math.max(4, paletteEntries)))));
    chunks.push(lzwEncode(frame.indices, minCodeSize));
  }

  // Trailer
  chunks.push(new Uint8Array([0x3b]));

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

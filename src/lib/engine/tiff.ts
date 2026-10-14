import { StripOptions } from './types';

/**
 * TIFF/RAW cleaning is deliberately disabled until the engine has a complete,
 * offset-aware IFD rebuild that safely handles nested directories, thumbnails,
 * SubIFDs, MakerNotes, and strip/tile data. Never return an unchanged or partial
 * TIFF buffer as a successful cleaned result.
 */
export function stripTiff(
  _buffer: Uint8Array,
  _options: StripOptions = {},
): never {
  throw new Error(
    'Safe lossless metadata removal is not currently supported for TIFF or TIFF-based RAW files. The original file has not been modified.',
  );
}

import { ImageFormat, StripOptions, StripResult } from './types';
import { detectImageFormat, buildCleanedFilename } from './magic';
import { stripJpeg } from './jpeg';
import { stripPng } from './png';
import { stripWebp } from './webp';
import { stripGif } from './gif';
import { stripSvg } from './svg';

/**
 * Main lossless metadata stripping engine entry point.
 * Works seamlessly in Browser (Web Workers/Main Thread) and Node.js backend.
 */
export async function stripImageMetadata(
  fileBuffer: Uint8Array,
  filename: string,
  options: StripOptions = {}
): Promise<StripResult> {
  const originalSize = fileBuffer.length;
  const formatInfo = detectImageFormat(fileBuffer);
  const format = formatInfo.format;
  const cleanedFilename = buildCleanedFilename(filename, options.filenameSuffix || '');

  if (format === 'unknown') {
    return {
      filename,
      cleanedFilename,
      format: 'unknown',
      originalSize,
      cleanedSize: originalSize,
      bytesSaved: 0,
      percentSaved: 0,
      removedFieldsCount: 0,
      removedSegments: [],
      pixelIdentical: false,
      cleanedBuffer: fileBuffer,
      mimeType: formatInfo.mimeType,
      error: 'Unsupported image format for metadata stripping',
    };
  }

  if (!formatInfo.isLosslessStrippable) {
    return {
      filename,
      cleanedFilename,
      format,
      originalSize,
      cleanedSize: originalSize,
      bytesSaved: 0,
      percentSaved: 0,
      removedFieldsCount: 0,
      removedSegments: [],
      pixelIdentical: false,
      cleanedBuffer: fileBuffer,
      mimeType: formatInfo.mimeType,
      error: `Safe lossless metadata removal is not currently supported for ${formatInfo.description}. The original file has not been modified.`,
    };
  }

  let cleanedBuffer: Uint8Array = fileBuffer;
  let removedSegments: string[] = [];

  try {
    switch (format) {
      case 'jpeg': {
        const res = stripJpeg(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'png': {
        const res = stripPng(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'webp': {
        const res = stripWebp(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'gif': {
        const res = stripGif(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'svg': {
        const res = stripSvg(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'tiff':
      case 'raw':
      case 'heic':
      case 'avif':
      case 'bmp':
      case 'jxl': {
        throw new Error(`Safe metadata removal is not implemented for ${formatInfo.description}`);
      }

      default:
        cleanedBuffer = fileBuffer;
        break;
    }

    if (cleanedBuffer.length < 4 || detectImageFormat(cleanedBuffer).format !== format) {
      throw new Error('Verification failed: the processed output no longer matches the input image format.');
    }

    const cleanedSize = cleanedBuffer.length;
    const bytesSaved = originalSize - cleanedSize; // Negative means the cleaned output grew.
    const percentSaved = originalSize > 0 ? (bytesSaved / originalSize) * 100 : 0;

    return {
      filename,
      cleanedFilename,
      format,
      originalSize,
      cleanedSize,
      bytesSaved,
      percentSaved: Number(percentSaved.toFixed(2)),
      removedFieldsCount: removedSegments.length,
      removedSegments,
      // Raster/container formats preserve their encoded image payload; SVG markup is
      // transformed, so do not claim pixel identity without raster comparison.
      pixelIdentical: format === 'gif' || (format !== 'svg' && options.keepIccProfile === true && options.keepOrientation === true),
      cleanedBuffer,
      mimeType: formatInfo.mimeType,
    };
  } catch (err: any) {
    return {
      filename,
      cleanedFilename,
      format,
      originalSize,
      cleanedSize: originalSize,
      bytesSaved: 0,
      percentSaved: 0,
      removedFieldsCount: 0,
      removedSegments: [],
      pixelIdentical: false,
      cleanedBuffer: fileBuffer,
      mimeType: formatInfo.mimeType,
      error: err?.message || 'Failed to strip metadata',
    };
  }
}

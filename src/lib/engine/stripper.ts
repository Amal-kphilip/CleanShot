import { ImageFormat, StripOptions, StripResult } from './types';
import { detectImageFormat, buildCleanedFilename } from './magic';
import { stripJpeg } from './jpeg';
import { stripPng } from './png';
import { stripWebp } from './webp';
import { stripGif } from './gif';
import { stripSvg } from './svg';
import { stripTiff } from './tiff';
import { stripBmff } from './bmff';

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
      pixelIdentical: true,
      cleanedBuffer: fileBuffer,
      mimeType: formatInfo.mimeType,
      error: 'Unsupported image format for metadata stripping',
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
      case 'raw': {
        const res = stripTiff(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'heic':
      case 'avif': {
        const res = stripBmff(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'bmp':
      case 'jxl': {
        // BMP / JXL basic passthrough with header preservation
        cleanedBuffer = fileBuffer;
        removedSegments = [];
        break;
      }

      default:
        cleanedBuffer = fileBuffer;
        break;
    }

    const cleanedSize = cleanedBuffer.length;
    const bytesSaved = Math.max(0, originalSize - cleanedSize);
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
      pixelIdentical: true,
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

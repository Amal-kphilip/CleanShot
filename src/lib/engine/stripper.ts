import { ImageFormat, StripOptions, StripResult } from './types';
import { detectImageFormat, buildCleanedFilename } from './magic';
import { stripJpeg } from './jpeg';
import { stripPng } from './png';
import { stripWebp } from './webp';
import { stripGif } from './gif';
import { stripSvg } from './svg';
import { stripPdf } from './pdf';
import { stripDocx } from './docx';
import { stripIsobmff } from './isobmff';
import { stripMatroska } from './matroska';
import { stripMp3, stripAac } from './id3';
import { stripFlac } from './flac';
import { stripRiffWav } from './riff';

/**
 * Main lossless metadata stripping engine entry point.
 * Supports Images (JPEG, PNG, WebP, GIF, SVG), Documents (PDF, DOCX),
 * Video (MP4, MOV, WebM, MKV), and Audio (MP3, WAV, FLAC, AAC, M4A).
 * Works seamlessly in Browser (Web Workers/Main Thread) and Node.js backend.
 */
export async function stripImageMetadata(
  fileBuffer: Uint8Array,
  filename: string,
  options: StripOptions = {}
): Promise<StripResult> {
  const originalSize = fileBuffer.length;
  const formatInfo = detectImageFormat(fileBuffer, filename);
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
      error: 'Unsupported format for metadata stripping',
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

      case 'pdf': {
        const res = stripPdf(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'docx': {
        const res = stripDocx(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'mp4':
      case 'mov':
      case 'm4a': {
        const res = stripIsobmff(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'webm':
      case 'mkv': {
        const res = stripMatroska(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'mp3': {
        const res = stripMp3(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'aac': {
        const res = stripAac(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'flac': {
        const res = stripFlac(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'wav': {
        const res = stripRiffWav(fileBuffer);
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

    if (cleanedBuffer.length < 4 || detectImageFormat(cleanedBuffer, filename).format !== format) {
      throw new Error('Verification failed: the processed output no longer matches the input file format.');
    }

    const cleanedSize = cleanedBuffer.length;
    const bytesSaved = originalSize - cleanedSize; // Negative means the cleaned output grew.
    const percentSaved = originalSize > 0 ? (bytesSaved / originalSize) * 100 : 0;

    const isMediaStreamIdentical = ['gif', 'mp4', 'mov', 'm4a', 'webm', 'mkv', 'mp3', 'aac', 'flac', 'wav'].includes(format);

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
      pixelIdentical:
        isMediaStreamIdentical ||
        (['jpeg', 'png', 'webp'].includes(format) && options.keepIccProfile === true && options.keepOrientation === true),
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

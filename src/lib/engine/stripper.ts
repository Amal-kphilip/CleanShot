import { StripOptions, StripResult } from './types';
import { detectImageFormat, buildCleanedFilename } from './magic';
import { stripJpegAsync } from './jpeg';
import { stripPngAsync } from './png';
import { stripWebpAsync } from './webp';
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
 * CleanShot canonical metadata-stripping engine entry point across all supported formats:
 * - Images: JPEG/JPG, PNG, WebP, GIF, SVG
 * - Documents: PDF (`pdf-lib`), DOCX (`jszip` + WordprocessingML sanitizer)
 * - Video: MP4, MOV, WebM, MKV
 * - Audio: MP3, AAC, FLAC, WAV, M4A
 */
export async function stripImageMetadata(
  fileBuffer: Uint8Array,
  filename: string,
  options: StripOptions = {},
): Promise<StripResult> {
  const originalSize = fileBuffer.length;
  const formatInfo = detectImageFormat(fileBuffer, filename);
  const format = formatInfo.format;
  const cleanedFilename = buildCleanedFilename(
    filename,
    options.filenameSuffix || '',
  );

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
        const res = await stripJpegAsync(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'png': {
        const res = await stripPngAsync(fileBuffer, options);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'webp': {
        const res = await stripWebpAsync(fileBuffer, options);
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
        const res = await stripPdf(fileBuffer);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'docx': {
        const res = await stripDocx(fileBuffer, filename);
        cleanedBuffer = res.cleanedBuffer;
        removedSegments = res.removedSegments;
        break;
      }

      case 'mp4':
      case 'mov':
      case 'm4a': {
        const res = stripIsobmff(fileBuffer, options);
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
        throw new Error(
          `Safe metadata removal is not implemented for ${formatInfo.description}`,
        );
      }

      default:
        cleanedBuffer = fileBuffer;
        break;
    }

    if (
      cleanedBuffer.length < 4 ||
      detectImageFormat(cleanedBuffer, filename).format !== format
    ) {
      throw new Error(
        'Verification failed: the processed output no longer matches the input file format.',
      );
    }

    const cleanedSize = cleanedBuffer.length;
    const bytesSaved = originalSize - cleanedSize;
    const percentSaved = originalSize > 0 ? (bytesSaved / originalSize) * 100 : 0;

    const isMediaStreamIdentical = [
      'gif',
      'mp4',
      'mov',
      'm4a',
      'webm',
      'mkv',
      'mp3',
      'aac',
      'flac',
      'wav',
    ].includes(format);

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
      pixelIdentical: isMediaStreamIdentical,
      cleanedBuffer,
      mimeType: formatInfo.mimeType,
    };
  } catch (err: unknown) {
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
      error: err instanceof Error ? err.message : 'Failed to strip metadata',
    };
  }
}

export const stripMetadataBuffer = stripImageMetadata;

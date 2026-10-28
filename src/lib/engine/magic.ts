import { ImageFormat } from './types';

export interface FormatInfo {
  format: ImageFormat;
  mimeType: string;
  extension: string;
  isLosslessStrippable: boolean;
  description: string;
}

/**
 * Detect file format using magic bytes from Uint8Array header (and optional filename fallback)
 */
export function detectImageFormat(buffer: Uint8Array, filename: string = ''): FormatInfo {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() : '';

  if (!buffer || buffer.length < 2) {
    return {
      format: 'unknown',
      mimeType: 'application/octet-stream',
      extension: '',
      isLosslessStrippable: false,
      description: 'Unknown binary file',
    };
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return {
      format: 'jpeg',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      isLosslessStrippable: true,
      description: 'JPEG Image',
    };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return {
      format: 'png',
      mimeType: 'image/png',
      extension: 'png',
      isLosslessStrippable: true,
      description: 'PNG Image',
    };
  }

  // RIFF: WebP or WAV
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
  ) {
    // WEBP
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return {
        format: 'webp',
        mimeType: 'image/webp',
        extension: 'webp',
        isLosslessStrippable: true,
        description: 'WebP Image',
      };
    }
    // WAVE
    if (buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
      return {
        format: 'wav',
        mimeType: 'audio/wav',
        extension: 'wav',
        isLosslessStrippable: true,
        description: 'WAV Audio',
      };
    }
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return {
      format: 'gif',
      mimeType: 'image/gif',
      extension: 'gif',
      isLosslessStrippable: true,
      description: 'GIF Image',
    };
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D
  ) {
    return {
      format: 'pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      isLosslessStrippable: true,
      description: 'PDF Document',
    };
  }

  // ZIP / DOCX: PK\x03\x04 (50 4B 03 04)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04
  ) {
    // Check if it's a DOCX by extension or internal path signature ("word/" or "[Content_Types].xml")
    const sample = new TextDecoder('latin1').decode(buffer.subarray(0, Math.min(buffer.length, 4096)));
    if (ext === 'docx' || sample.includes('word/') || sample.includes('docProps/')) {
      return {
        format: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
        isLosslessStrippable: true,
        description: 'Word Document (DOCX)',
      };
    }
  }

  // FLAC: fLaC (66 4C 61 43)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43
  ) {
    return {
      format: 'flac',
      mimeType: 'audio/flac',
      extension: 'flac',
      isLosslessStrippable: true,
      description: 'FLAC Lossless Audio',
    };
  }

  // EBML (Matroska MKV / WebM): 1A 45 DF A3
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3
  ) {
    const headerSample = new TextDecoder('latin1').decode(buffer.subarray(0, Math.min(buffer.length, 128))).toLowerCase();
    if (ext === 'webm' || (ext !== 'mkv' && headerSample.includes('webm'))) {
      return {
        format: 'webm',
        mimeType: 'video/webm',
        extension: 'webm',
        isLosslessStrippable: true,
        description: 'WebM Video',
      };
    }
    return {
      format: 'mkv',
      mimeType: 'video/x-matroska',
      extension: 'mkv',
      isLosslessStrippable: true,
      description: 'Matroska Video (MKV)',
    };
  }

  // ISOBMFF (ftyp / moov / wide / mdat / free at offset 4)
  if (buffer.length >= 12) {
    const boxType = String.fromCharCode(buffer[4], buffer[5], buffer[6], buffer[7]);
    if (boxType === 'ftyp') {
      const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]).toLowerCase();
      if (brand.includes('avif') || brand.includes('avis')) {
        return {
          format: 'avif',
          mimeType: 'image/avif',
          extension: 'avif',
          isLosslessStrippable: false,
          description: 'AVIF Image',
        };
      }
      if (
        brand.includes('heic') || brand.includes('heix') ||
        brand.includes('mif1') || brand.includes('msf1') ||
        brand.includes('hevc')
      ) {
        return {
          format: 'heic',
          mimeType: 'image/heic',
          extension: 'heic',
          isLosslessStrippable: false,
          description: 'HEIF/HEIC Image',
        };
      }
      if (ext === 'mov' || brand === 'qt  ') {
        return {
          format: 'mov',
          mimeType: 'video/quicktime',
          extension: 'mov',
          isLosslessStrippable: true,
          description: 'QuickTime Movie (MOV)',
        };
      }
      if (ext === 'm4a' || brand === 'm4a ' || brand === 'm4b ') {
        return {
          format: 'm4a',
          mimeType: 'audio/mp4',
          extension: 'm4a',
          isLosslessStrippable: true,
          description: 'M4A Audio',
        };
      }
      return {
        format: 'mp4',
        mimeType: 'video/mp4',
        extension: 'mp4',
        isLosslessStrippable: true,
        description: 'MP4 Video',
      };
    }
    if (boxType === 'moov' || boxType === 'wide' || boxType === 'mdat' || boxType === 'free') {
      if (ext === 'mov') {
        return {
          format: 'mov',
          mimeType: 'video/quicktime',
          extension: 'mov',
          isLosslessStrippable: true,
          description: 'QuickTime Movie (MOV)',
        };
      }
      if (ext === 'm4a') {
        return {
          format: 'm4a',
          mimeType: 'audio/mp4',
          extension: 'm4a',
          isLosslessStrippable: true,
          description: 'M4A Audio',
        };
      }
      if (ext === 'mp4') {
        return {
          format: 'mp4',
          mimeType: 'video/mp4',
          extension: 'mp4',
          isLosslessStrippable: true,
          description: 'MP4 Video',
        };
      }
    }
  }

  // MP3 / AAC (ID3v2 header "ID3" or ADTS / MPEG frame sync)
  if (
    buffer.length >= 3 &&
    buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33
  ) {
    if (ext === 'aac') {
      return {
        format: 'aac',
        mimeType: 'audio/aac',
        extension: 'aac',
        isLosslessStrippable: true,
        description: 'AAC Audio',
      };
    }
    return {
      format: 'mp3',
      mimeType: 'audio/mpeg',
      extension: 'mp3',
      isLosslessStrippable: true,
      description: 'MP3 Audio',
    };
  }

  // Raw ADTS AAC or MPEG audio sync word (0xFF followed by 0xE0..0xFF)
  if (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    // Note: JPEG (FF D8) and JPEG XL (FF 0A) are below 0xE0 or handled above
    if (ext === 'aac' || (ext !== 'mp3' && (buffer[1] & 0xF6) === 0xF0)) {
      return {
        format: 'aac',
        mimeType: 'audio/aac',
        extension: 'aac',
        isLosslessStrippable: true,
        description: 'AAC Audio',
      };
    }
    if (ext === 'mp3' || (buffer[1] & 0xE0) === 0xE0) {
      return {
        format: 'mp3',
        mimeType: 'audio/mpeg',
        extension: 'mp3',
        isLosslessStrippable: true,
        description: 'MP3 Audio',
      };
    }
  }

  // TIFF: Little Endian (49 49 2A 00) or Big Endian (4D 4D 00 2A)
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
     (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A))
  ) {
    // Check for Canon CR2 (CR at offset 8: 43 52)
    if (buffer.length >= 10 && buffer[8] === 0x43 && buffer[9] === 0x52) {
      return {
        format: 'raw',
        mimeType: 'image/x-canon-cr2',
        extension: 'cr2',
        isLosslessStrippable: false,
        description: 'Canon RAW (CR2)',
      };
    }

    return {
      format: 'tiff',
      mimeType: 'image/tiff',
      extension: 'tif',
      isLosslessStrippable: false,
      description: 'TIFF Image',
    };
  }

  // BMP: 42 4D (BM)
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return {
      format: 'bmp',
      mimeType: 'image/bmp',
      extension: 'bmp',
      isLosslessStrippable: false,
      description: 'Bitmap Image',
    };
  }

  // JPEG XL: FF 0A or 00 00 00 0C 4A 58 4C 20 0D 0A 87 0A
  if (
    (buffer[0] === 0xFF && buffer[1] === 0x0A) ||
    (buffer.length >= 12 &&
      buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x00 && buffer[3] === 0x0C &&
      buffer[4] === 0x4A && buffer[5] === 0x58 && buffer[6] === 0x4C && buffer[7] === 0x20)
  ) {
    return {
      format: 'jxl',
      mimeType: 'image/jxl',
      extension: 'jxl',
      isLosslessStrippable: false,
      description: 'JPEG XL Image',
    };
  }

  // SVG: Check first 512 bytes for <svg or <?xml
  const headerSample = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.length, 512))).trim().toLowerCase();
  if (headerSample.includes('<svg') || (headerSample.includes('<?xml') && headerSample.includes('<svg'))) {
    return {
      format: 'svg',
      mimeType: 'image/svg+xml',
      extension: 'svg',
      isLosslessStrippable: true,
      description: 'SVG Vector Graphic',
    };
  }

  return {
    format: 'unknown',
    mimeType: 'application/octet-stream',
    extension: '',
    isLosslessStrippable: false,
    description: 'Unsupported Format',
  };
}

/**
 * Sanitize filename to prevent directory traversal and zip-slip attacks
 */
export function sanitizeFilename(rawFilename: string): string {
  if (!rawFilename) return 'file_cleaned';

  // Strip null bytes and control chars
  let cleaned = rawFilename.replace(/[\0\x00-\x1F\x7F]/g, '');

  // Replace path separators and backslashes
  cleaned = cleaned.replace(/\\/g, '/');
  const basename = cleaned.split('/').pop() || 'file_cleaned';

  // Disallow dot-dot
  const safeName = basename.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '_').trim();

  return safeName.length > 0 ? safeName : 'file_cleaned';
}

/**
 * Build output filename with optional suffix (e.g. photo.jpg -> photo_clean.jpg)
 */
export function buildCleanedFilename(originalName: string, suffix: string = ''): string {
  const sanitized = sanitizeFilename(originalName);
  const safeSuffix = suffix.replace(/[\\/:*?"<>|\0-\x1f\x7f]/g, '').slice(0, 40);
  if (!safeSuffix) return sanitized;

  const lastDot = sanitized.lastIndexOf('.');
  if (lastDot === -1) {
    return `${sanitized}${safeSuffix}`;
  }

  const namePart = sanitized.substring(0, lastDot);
  const extPart = sanitized.substring(lastDot);
  return `${namePart}${safeSuffix}${extPart}`;
}

import { ImageFormat } from './types';

export interface FormatInfo {
  format: ImageFormat;
  mimeType: string;
  extension: string;
  isLosslessStrippable: boolean;
  description: string;
}

/**
 * Detect file format using magic bytes from Uint8Array header
 */
export function detectImageFormat(buffer: Uint8Array): FormatInfo {
  if (!buffer || buffer.length < 4) {
    return {
      format: 'unknown',
      mimeType: 'application/octet-stream',
      extension: '',
      isLosslessStrippable: false,
      description: 'Unknown binary file',
    };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
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

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return {
      format: 'webp',
      mimeType: 'image/webp',
      extension: 'webp',
      isLosslessStrippable: true,
      description: 'WebP Image',
    };
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
        isLosslessStrippable: true,
        description: 'Canon RAW (CR2)',
      };
    }

    return {
      format: 'tiff',
      mimeType: 'image/tiff',
      extension: 'tif',
      isLosslessStrippable: true,
      description: 'TIFF Image',
    };
  }

  // BMP: 42 4D (BM)
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return {
      format: 'bmp',
      mimeType: 'image/bmp',
      extension: 'bmp',
      isLosslessStrippable: true,
      description: 'Bitmap Image',
    };
  }

  // ISOBMFF: HEIC / AVIF (ftyp at offset 4)
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  ) {
    const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]).toLowerCase();
    if (brand.includes('avif') || brand.includes('avis')) {
      return {
        format: 'avif',
        mimeType: 'image/avif',
        extension: 'avif',
        isLosslessStrippable: true,
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
        isLosslessStrippable: true,
        description: 'HEIF/HEIC Image',
      };
    }
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
      isLosslessStrippable: true,
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
  if (!rawFilename) return 'image_cleaned';
  
  // Strip null bytes and control chars
  let cleaned = rawFilename.replace(/[\0\x00-\x1F\x7F]/g, '');
  
  // Replace path separators and backslashes
  cleaned = cleaned.replace(/\\/g, '/');
  const basename = cleaned.split('/').pop() || 'image_cleaned';
  
  // Disallow dot-dot
  const safeName = basename.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '_').trim();
  
  return safeName.length > 0 ? safeName : 'image_cleaned';
}

/**
 * Build output filename with optional suffix (e.g. photo.jpg -> photo_clean.jpg)
 */
export function buildCleanedFilename(originalName: string, suffix: string = ''): string {
  const sanitized = sanitizeFilename(originalName);
  if (!suffix) return sanitized;
  
  const lastDot = sanitized.lastIndexOf('.');
  if (lastDot === -1) {
    return `${sanitized}${suffix}`;
  }
  
  const namePart = sanitized.substring(0, lastDot);
  const extPart = sanitized.substring(lastDot);
  return `${namePart}${suffix}${extPart}`;
}

/**
 * Security utilities for validating image URLs and escaping HTML text.
 */
export { escapeHtml, decodeXmlEntities } from '../engine/sanitizer';

/**
 * Validates that an image URL is strictly an internal blob URL or a safe raster image data URI.
 * Rejects javascript:, data:text/html, data:image/svg+xml, or any external schemes.
 */
export function toSafeImageSrc(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

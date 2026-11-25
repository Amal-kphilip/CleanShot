/**
 * Engine sanitization utilities for safe escaping and entity decoding.
 */

/**
 * Safely escapes all five XML/HTML special characters (& < > " ') in a single pass.
 * Prevents double-escaping and XSS when processing or inspecting untrusted metadata.
 */
export function escapeHtml(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

/**
 * Safely decodes XML/HTML entities in a single pass without cascading or double-unescaping.
 */
export function decodeXmlEntities(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/g, (entity) => {
    switch (entity) {
      case '&amp;':
        return '&';
      case '&lt;':
        return '<';
      case '&gt;':
        return '>';
      case '&quot;':
        return '"';
      case '&apos;':
      case '&#39;':
      case '&#x27;':
        return "'";
      default:
        return entity;
    }
  });
}

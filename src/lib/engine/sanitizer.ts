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

/**
 * Strips XML/HTML markup tags and comments using a character-level state machine
 * (no regex replacement) so nested or malformed tags like `<scr<script>ipt>`
 * cannot survive into the extracted text.
 */
export function stripXmlMarkupToText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let out = '';
  let i = 0;
  let tagDepth = 0;

  while (i < input.length) {
    if (tagDepth === 0 && input.startsWith('<!--', i)) {
      const endComment = input.indexOf('-->', i + 4);
      if (endComment === -1) {
        break;
      }
      i = endComment + 3;
      continue;
    }

    const ch = input[i];
    if (ch === '<') {
      tagDepth++;
      i++;
      continue;
    }
    if (ch === '>' && tagDepth > 0) {
      tagDepth--;
      i++;
      continue;
    }
    if (tagDepth === 0) {
      out += ch;
    }
    i++;
  }

  return out;
}

/**
 * Extracts plain text for a given XMP tag using DOMParser when available,
 * falling back to state-machine markup stripping and single-pass entity decoding.
 */
export function extractXmpTagText(xmp: string, tag: string): string {
  if (!xmp || !tag) return '';
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(xmp, 'application/xml');
      const hasError =
        Boolean(doc.querySelector('parsererror')) ||
        doc.getElementsByTagName('parsererror').length > 0;
      if (!hasError) {
        const el = doc.getElementsByTagName(tag)[0] || doc.querySelector(tag);
        if (el) {
          return (el.textContent || '').trim();
        }
      }
    } catch {
      // Fallback to state-machine extraction
    }
  }

  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xmp.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`));
  if (!match) return '';
  const textOnly = stripXmlMarkupToText(match[1]).trim();
  return decodeXmlEntities(textOnly);
}

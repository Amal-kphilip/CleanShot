import { unzipSync, zipSync, Zippable } from 'fflate';

/**
 * Clears identity-bearing WordprocessingML attributes while preserving visible
 * document text, comments, and revision markup. Namespace prefixes are not
 * assumed: valid OOXML producers may choose prefixes other than `w`/`w15`.
 */
export function sanitizeWordprocessingXml(xml: string): string {
  let cleaned = xml;

  // Word's revision-session table is non-content metadata and can be removed wholesale.
  cleaned = cleaned.replace(
    /<([A-Za-z_][\w.-]*):rsids\b[^>]*>[\s\S]*?<\/\1:rsids\s*>/gi,
    '',
  );

  // These string attributes identify comment/revision authors or their Office account.
  cleaned = cleaned.replace(
    /(\s(?:[A-Za-z_][\w.-]*:)?(?:author|initials|providerId|userId|personId)\s*=\s*)(["'])[^"'<>]*\2/gi,
    (_match, prefix: string, quote: string) => `${prefix}${quote}${quote}`,
  );

  // Revision dates and identifiers carry editing history but are not needed to render the document.
  cleaned = cleaned.replace(
    /\s+(?:[A-Za-z_][\w.-]*:)?(?:date(?:Utc)?|durableId|rsid[A-Za-z0-9_.-]*)\s*=\s*(["'])[^"'<>]*\1/gi,
    '',
  );

  return cleaned;
}

/**
 * Strips metadata from a DOCX archive:
 * 1. Removes the entire `docProps/` directory (`core.xml`, `app.xml`, `custom.xml`, thumbnail)
 * 2. Cleans relationship references to `docProps/` in `_rels/.rels` and `[Content_Types].xml` if needed,
 *    performs exact `docProps` removal + Word XML sanitization.
 */
export function stripDocx(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('Malformed DOCX file: invalid ZIP container');
  }

  if (!entries['word/document.xml']) {
    throw new Error('Invalid DOCX file structure: missing word/document.xml');
  }

  const removedSegments: string[] = [];
  const outZip: Zippable = {};
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  let removedDocProps = false;
  let sanitizedXmlParts = 0;

  for (const [entryName, entryData] of Object.entries(entries)) {
    if (/^docProps\//i.test(entryName)) {
      removedDocProps = true;
      continue;
    }

    if (/^word\/.*\.xml$/i.test(entryName)) {
      const xml = decoder.decode(entryData);
      const cleanedXml = sanitizeWordprocessingXml(xml);
      if (cleanedXml !== xml) {
        sanitizedXmlParts++;
        outZip[entryName] = [encoder.encode(cleanedXml), { level: 6 }];
      } else {
        outZip[entryName] = [entryData, { level: 6 }];
      }
      continue;
    }

    outZip[entryName] = [entryData, { level: 6 }];
  }

  if (removedDocProps) {
    removedSegments.push('DOCX docProps (core.xml, app.xml, custom.xml)');
  }
  if (sanitizedXmlParts > 0) {
    removedSegments.push(`DOCX WordprocessingML author/revision attributes (${sanitizedXmlParts} XML parts)`);
  }

  const cleanedBuffer = new Uint8Array(zipSync(outZip));
  return {
    cleanedBuffer,
    removedSegments,
    bytesSaved: bytes.length - cleanedBuffer.length,
  };
}

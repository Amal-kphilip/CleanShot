/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

import JSZip from 'jszip';

/**
 * Clears identity-bearing WordprocessingML attributes while preserving visible
 * document text, comments, and revision markup. Namespace prefixes are not
 * assumed: valid OOXML producers may choose prefixes other than `w`/`w15`.
 */
export function sanitizeWordprocessingXml(xml: string): string {
  let cleaned = xml;

  // Word's revision-session table is non-content metadata and can be removed
  // wholesale. Individual rsid attributes are removed below as well.
  cleaned = cleaned.replace(
    /<([A-Za-z_][\w.-]*):rsids\b[^>]*>[\s\S]*?<\/\1:rsids\s*>/gi,
    '',
  );

  // These string attributes identify comment/revision authors or their Office
  // account. Keep an empty attribute where some OOXML versions require it.
  cleaned = cleaned.replace(
    /(\s(?:[A-Za-z_][\w.-]*:)?(?:author|initials|providerId|userId|personId)\s*=\s*)(["'])[^"'<>]*\2/gi,
    (_match, prefix: string, quote: string) => `${prefix}${quote}${quote}`,
  );

  // Revision dates and identifiers carry editing history but are not needed to
  // render the current document or its comment text.
  cleaned = cleaned.replace(
    /\s+(?:[A-Za-z_][\w.-]*:)?(?:date(?:Utc)?|durableId|rsid[A-Za-z0-9_.-]*)\s*=\s*(["'])[^"'<>]*\1/gi,
    '',
  );

  return cleaned;
}

/**
 * CleanShot canonical DOCX metadata cleaner using JSZip:
 * - Validates `.docx` extension and `word/document.xml` presence.
 * - Removes the complete `docProps/` folder.
 * - Sanitizes every `word/**\/*.xml` part via `sanitizeWordprocessingXml()`.
 * - Rebuilds the DOCX archive using DEFLATE compression at level 6.
 */
export async function stripDocx(
  bytes: Uint8Array,
  filename = 'document.docx',
): Promise<{
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
}> {
  if (filename && !filename.toLowerCase().endsWith('.docx')) {
    throw new Error('Unsupported file type. Only .docx files are allowed.');
  }

  const zip = await JSZip.loadAsync(bytes);

  if (!zip.file('word/document.xml')) {
    throw new Error('Invalid DOCX file structure.');
  }

  const removedSegments: string[] = [];
  if (Object.keys(zip.files).some((name) => /^docProps\//i.test(name))) {
    removedSegments.push('DOCX docProps (core.xml, app.xml, custom.xml)');
  }

  // The entire docProps folder is document metadata: core.xml (author, dates),
  // app.xml (application, edit time), custom.xml and the page-1 thumbnail
  zip.remove('docProps');

  let sanitizedXmlParts = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/^word\/.*\.xml$/i.test(entry.name)) continue;
    const xml = await entry.async('string');
    const cleanedXml = sanitizeWordprocessingXml(xml);
    if (cleanedXml !== xml) {
      zip.file(entry.name, cleanedXml);
      sanitizedXmlParts++;
    }
  }

  if (sanitizedXmlParts > 0) {
    removedSegments.push(
      `DOCX WordprocessingML author/revision attributes (${sanitizedXmlParts} XML parts)`,
    );
  }

  const cleanedBuffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    cleanedBuffer,
    removedSegments,
    bytesSaved: bytes.length - cleanedBuffer.length,
  };
}

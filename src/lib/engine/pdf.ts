/**
 * Offset-preserving binary PDF metadata sanitizer.
 *
 * Removes:
 * 1. Document Info dictionary objects referenced by `/Info N G R` in PDF trailers
 *    (Author, Title, Subject, Keywords, Creator, Producer, CreationDate, ModDate, Trapped, custom keys)
 * 2. Trailer `/Info N G R` and `/ID [ <...> <...> ]` identifiers
 * 3. Catalog `/Metadata N G R` references and XMP `<x:xmpmeta ...>...</x:xmpmeta>` / `<?xpacket ...?>` streams
 *
 * All in-place overwrites preserve exact byte offsets so existing `xref` tables
 * and compressed object streams remain 100% valid without re-serializing pages.
 */
export function stripPdf(bytes: Uint8Array): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  if (bytes.length < 8) {
    throw new Error('Invalid PDF file: file is too small');
  }
  const headerSample = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
  if (!headerSample.includes('%PDF-')) {
    throw new Error('Invalid PDF file: missing %PDF- header');
  }

  const cleaned = bytes.slice();
  const text = new TextDecoder('latin1').decode(cleaned);
  const removedSegments: string[] = [];

  const blankSpan = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      // Preserve line breaks for readability/structure, replace everything else with space (0x20)
      if (cleaned[i] !== 0x0a && cleaned[i] !== 0x0d) {
        cleaned[i] = 0x20;
      }
    }
  };

  // Helper to find matching `>>` for a dictionary starting at `<<`
  const findDictEnd = (str: string, dictStart: number): number => {
    let depth = 0;
    let inParens = 0;
    for (let i = dictStart; i < str.length - 1; i++) {
      const ch = str[i];
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '(') {
        inParens++;
        continue;
      }
      if (ch === ')' && inParens > 0) {
        inParens--;
        continue;
      }
      if (inParens > 0) continue;

      if (ch === '<' && str[i + 1] === '<') {
        depth++;
        i++;
      } else if (ch === '>' && str[i + 1] === '>') {
        depth--;
        i++;
        if (depth === 0) return i + 1;
      }
    }
    return -1;
  };

  const infoObjIds = new Set<string>();
  const metadataObjIds = new Set<string>();

  // 1. Collect `/Info N G R` and `/ID [...]` across the PDF (especially trailer dictionaries)
  const infoRefRegex = /\/Info\s+(\d+)\s+(\d+)\s+R\b/g;
  let match: RegExpExecArray | null;
  while ((match = infoRefRegex.exec(text)) !== null) {
    infoObjIds.add(`${match[1]} ${match[2]}`);
    blankSpan(match.index, match.index + match[0].length);
  }
  if (infoObjIds.size > 0) {
    removedSegments.push('PDF Trailer /Info reference');
  }

  // Remove `/ID [ <...> <...> ]` or `/ID[<...><...>]` in trailers
  const idArrayRegex = /\/ID\s*\[\s*<[0-9A-Fa-f\s]*>\s*<[0-9A-Fa-f\s]*>\s*\]/g;
  let removedIdCount = 0;
  while ((match = idArrayRegex.exec(text)) !== null) {
    blankSpan(match.index, match.index + match[0].length);
    removedIdCount++;
  }
  if (removedIdCount > 0) {
    removedSegments.push('PDF Trailer /ID document fingerprint');
  }

  // 2. Collect `/Metadata N G R` references (Catalog XMP stream pointers)
  const metaRefRegex = /\/Metadata\s+(\d+)\s+(\d+)\s+R\b/g;
  while ((match = metaRefRegex.exec(text)) !== null) {
    metadataObjIds.add(`${match[1]} ${match[2]}`);
    blankSpan(match.index, match.index + match[0].length);
  }
  if (metadataObjIds.size > 0) {
    removedSegments.push('PDF Catalog /Metadata XMP reference');
  }

  // 3. Blank out every instance of each Info dictionary object (`N G obj << ... >> endobj`)
  for (const objId of infoObjIds) {
    const [num, gen] = objId.split(' ');
    const objRegex = new RegExp(`\\b${num}\\s+${gen}\\s+obj\\b`, 'g');
    let objMatch: RegExpExecArray | null;
    while ((objMatch = objRegex.exec(text)) !== null) {
      const afterObjHeader = objMatch.index + objMatch[0].length;
      const endObjPos = text.indexOf('endobj', afterObjHeader);
      if (endObjPos === -1) continue;

      const dictStart = text.indexOf('<<', afterObjHeader);
      if (dictStart !== -1 && dictStart < endObjPos) {
        const dictEnd = findDictEnd(text, dictStart);
        if (dictEnd !== -1 && dictEnd <= endObjPos) {
          // Keep `<<` and `>>` so `N G obj << >> endobj` remains a valid empty PDF dictionary object
          blankSpan(dictStart + 2, dictEnd - 2);
        }
      }
    }
    removedSegments.push(`PDF Document Info dictionary (${objId} obj)`);
  }

  // 4. Blank out any standalone Info keys if written inline or in incremental updates
  const infoKeyRegex = /\/(?:Author|Title|Subject|Keywords|Creator|Producer|CreationDate|ModDate)\s*(?:\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>)/g;
  let inlineKeysRemoved = 0;
  while ((match = infoKeyRegex.exec(text)) !== null) {
    blankSpan(match.index, match.index + match[0].length);
    inlineKeysRemoved++;
  }
  if (inlineKeysRemoved > 0 && infoObjIds.size === 0) {
    removedSegments.push(`PDF Document Info fields (${inlineKeysRemoved})`);
  }

  // 5. Blank out XMP packets (`<?xpacket begin=...` ... `<?xpacket end=...?>` or `<x:xmpmeta` ... `</x:xmpmeta>`)
  const xpacketRegex = /<\?xpacket\s+begin=[\s\S]*?\<\?xpacket\s+end=['"][wr]['"]\?>/gi;
  let xmpRemoved = false;
  while ((match = xpacketRegex.exec(text)) !== null) {
    blankSpan(match.index, match.index + match[0].length);
    xmpRemoved = true;
  }
  const xmpMetaRegex = /<x:xmpmeta\b[\s\S]*?<\/x:xmpmeta>/gi;
  while ((match = xmpMetaRegex.exec(text)) !== null) {
    blankSpan(match.index, match.index + match[0].length);
    xmpRemoved = true;
  }
  if (xmpRemoved) {
    removedSegments.push('PDF Embedded XMP Metadata Packet');
  }

  return {
    cleanedBuffer: cleaned,
    removedSegments,
    bytesSaved: bytes.length - cleaned.length,
  };
}

const XMP_SIGNATURE = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
const XMP_EXT_SIGNATURE = new TextEncoder().encode('http://ns.adobe.com/xmp/extension/\0');
export type JpegXmpFields = { title: string; description: string; author: string; rights: string; creatorTool: string; createDate: string };

function startsWithBytes(bytes: Uint8Array, prefix: Uint8Array): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}
function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function createXmp(fields: JpegXmpFields): Uint8Array {
  const lines = [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">',
  ];
  if (fields.title.trim()) lines.push(`<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(fields.title.trim())}</rdf:li></rdf:Alt></dc:title>`);
  if (fields.description.trim()) lines.push(`<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(fields.description.trim())}</rdf:li></rdf:Alt></dc:description>`);
  if (fields.author.trim()) lines.push(`<dc:creator><rdf:Seq><rdf:li>${xmlEscape(fields.author.trim())}</rdf:li></rdf:Seq></dc:creator>`);
  if (fields.rights.trim()) lines.push(`<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(fields.rights.trim())}</rdf:li></rdf:Alt></dc:rights>`);
  if (fields.creatorTool.trim()) lines.push(`<xmp:CreatorTool>${xmlEscape(fields.creatorTool.trim())}</xmp:CreatorTool>`);
  if (fields.createDate.trim()) lines.push(`<xmp:CreateDate>${xmlEscape(fields.createDate.trim())}</xmp:CreateDate>`);
  lines.push('</rdf:Description>', '</rdf:RDF>', '</x:xmpmeta>', '<?xpacket end="w"?>');
  return new TextEncoder().encode(lines.join(''));
}

export function updateJpegXmp(source: Uint8Array, fields: JpegXmpFields): Uint8Array {
  if (source.length < 4 || source[0] !== 0xff || source[1] !== 0xd8) throw new Error('This is not a valid JPEG file.');
  const keptSegments: Uint8Array[] = [];
  let insertionIndex = 0;
  let offset = 2;
  let foundScan = false;
  while (offset < source.length) {
    if (source[offset] !== 0xff) throw new Error('Malformed JPEG marker sequence.');
    const markerStart = offset;
    while (offset < source.length && source[offset] === 0xff) offset++;
    if (offset >= source.length) break;
    const marker = source[offset++];
    if (marker === 0xda) { // Start of scan: preserve compressed image stream verbatim.
      const scanStart = markerStart;
      const segmentHeader = source.slice(scanStart, offset + 2);
      const segmentLength = (segmentHeader[segmentHeader.length - 2] << 8) | segmentHeader[segmentHeader.length - 1];
      const scanHeaderEnd = offset + segmentLength;
      if (segmentLength < 2 || scanHeaderEnd > source.length) throw new Error('Invalid JPEG scan header.');
      keptSegments.push(source.slice(scanStart, scanHeaderEnd));
      keptSegments.push(source.slice(scanHeaderEnd));
      foundScan = true;
      break;
    }
    if (marker === 0xd9) { keptSegments.push(source.slice(markerStart, offset)); foundScan = true; break; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      keptSegments.push(source.slice(markerStart, offset));
      continue;
    }
    if (offset + 2 > source.length) throw new Error('Truncated JPEG segment.');
    const length = (source[offset] << 8) | source[offset + 1];
    if (length < 2 || offset + length > source.length) throw new Error('Invalid JPEG segment length.');
    const segmentEnd = offset + length;
    const isApp1 = marker === 0xe1;
    const payload = source.slice(offset + 2, segmentEnd);
    const isStandardXmp = isApp1 && startsWithBytes(payload, XMP_SIGNATURE);
    const isExtendedXmp = isApp1 && startsWithBytes(payload, XMP_EXT_SIGNATURE);
    if (!isStandardXmp && !isExtendedXmp) {
      keptSegments.push(source.slice(markerStart, segmentEnd));
      // JFIF specifies APP0 immediately after SOI; keep it ahead of the new XMP segment.
      if (marker === 0xe0 && insertionIndex === 0) insertionIndex = keptSegments.length;
    }
    offset = segmentEnd;
  }
  if (!foundScan) throw new Error('Could not find a valid JPEG image scan.');

  const xmp = createXmp(fields);
  const payloadLength = XMP_SIGNATURE.length + xmp.length;
  const segmentLength = payloadLength + 2;
  if (segmentLength > 65535) throw new Error('Metadata is too large for a JPEG XMP segment. Shorten the fields and try again.');
  const segment = new Uint8Array(2 + 2 + payloadLength);
  segment[0] = 0xff; segment[1] = 0xe1;
  segment[2] = (segmentLength >> 8) & 0xff; segment[3] = segmentLength & 0xff;
  segment.set(XMP_SIGNATURE, 4);
  segment.set(xmp, 4 + XMP_SIGNATURE.length);

  // Keep SOI, insert the fresh XMP APP1 segment before all remaining JPEG segments.
  return concat([source.slice(0, 2), ...keptSegments.slice(0, insertionIndex), segment, ...keptSegments.slice(insertionIndex)]);
}
function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}


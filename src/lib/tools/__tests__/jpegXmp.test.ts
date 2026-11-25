import { describe, expect, it } from 'vitest';
import { updateJpegXmp, type JpegXmpFields } from '../jpegXmp';
import { escapeHtml, decodeXmlEntities, extractXmpTagText } from '@/lib/engine/sanitizer';

const xmpSignature = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
const fields: JpegXmpFields = {
  title: 'Public & safe <title>',
  description: 'Short test description',
  author: 'Test Creator',
  rights: '',
  creatorTool: '',
  createDate: '',
};
function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
function app1(payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  return concat([Uint8Array.of(0xff, 0xe1, (length >> 8) & 255, length & 255), payload]);
}
function minimalJpeg(oldXmp?: string): Uint8Array {
  const parts = [
    Uint8Array.of(0xff, 0xd8),
    // APP0 should remain immediately after SOI.
    Uint8Array.of(0xff, 0xe0, 0x00, 0x04, 0x12, 0x34),
  ];
  if (oldXmp) parts.push(Uint8Array.from(app1(concat([xmpSignature, new TextEncoder().encode(oldXmp)]))));
  parts.push(Uint8Array.of(0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9));
  return concat(parts);
}

function countStandardXmpSegments(jpeg: Uint8Array): number {
  let count = 0;
  let offset = 2;

  while (offset < jpeg.length) {
    if (jpeg[offset] !== 0xff) break;

    while (offset < jpeg.length && jpeg[offset] === 0xff) {
      offset++;
    }

    if (offset >= jpeg.length) break;

    const marker = jpeg[offset++];

    // The compressed image scan begins here.
    if (marker === 0xda || marker === 0xd9) break;

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > jpeg.length) break;

    const length = (jpeg[offset] << 8) | jpeg[offset + 1];

    if (length < 2 || offset + length > jpeg.length) break;

    const payloadStart = offset + 2;
    const payloadEnd = offset + length;

    const isStandardXmp =
      marker === 0xe1 &&
      payloadStart + xmpSignature.length <= payloadEnd &&
      xmpSignature.every(
        (byte, index) => jpeg[payloadStart + index] === byte
      );

    if (isStandardXmp) count++;

    offset += length;
  }

  return count;
}

describe('updateJpegXmp', () => {
  it('inserts escaped XMP while preserving the compressed image tail and APP0 order', () => {
    const input = minimalJpeg();
    const output = updateJpegXmp(input, fields);
    const text = new TextDecoder('latin1').decode(output);
    const scanIndex = output.findIndex((value, index) => value === 0xff && output[index + 1] === 0xda);
    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
    expect(output[2]).toBe(0xff);
    expect(output[3]).toBe(0xe0);
    expect(text).toContain('Public &amp; safe &lt;title&gt;');
    expect(scanIndex).toBeGreaterThan(10);
    expect([...output.slice(-4)]).toEqual([0x11, 0x22, 0xff, 0xd9]);
  });

  it('replaces existing standard XMP instead of accumulating duplicate packets', () => {
    const input = minimalJpeg('<x:xmpmeta>old-private-value</x:xmpmeta>');
    const output = updateJpegXmp(input, fields);
    const text = new TextDecoder('latin1').decode(output);
    expect(text).not.toContain('old-private-value');
expect(countStandardXmpSegments(output)).toBe(1);
expect(text).toContain('Test Creator');
  });

  it('rejects malformed JPEG headers', () => {
    expect(() => updateJpegXmp(Uint8Array.of(0x00, 0x01, 0x02), fields)).toThrow(/valid JPEG/i);
  });

  it('escapes all five HTML special characters in metadata values without double escaping', () => {
    const malicious = '<img src=x onerror=alert(1)> & "quotes" \'apostrophe\'';
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot; &#39;apostrophe&#39;');
    expect(escaped).toContain('&lt;img');
    expect(escaped).not.toContain('<img');

    // Test double-encoding resilience in entity decoding
    const doubleEncoded = '&amp;lt;script&gt;';
    const decoded = decodeXmlEntities(doubleEncoded);
    // &amp;lt; should decode to &lt;script>, NOT <script>
    expect(decoded).toBe('&lt;script>');
    expect(decoded).not.toBe('<script>');
    expect(decoded).not.toContain('<script');

    // Single-pass decoding decodes valid entities properly
    const normalEntities = '&lt;title&gt; &amp; &quot;rights&quot;';
    expect(decodeXmlEntities(normalEntities)).toBe('<title> & "rights"');
  });

  it('extracts XMP tag text safely for nested tags, double-encoded entities, and nested comments', () => {
    const nestedTagXmp = '<x:xmpmeta><dc:title><scr<script>ipt>Safe Title</script></dc:title></x:xmpmeta>';
    const extractedNested = extractXmpTagText(nestedTagXmp, 'dc:title');
    expect(extractedNested).not.toContain('<script');
    expect(extractedNested).toContain('Safe Title');

    const doubleEncodedXmp = '<x:xmpmeta><dc:title>&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;</dc:title></x:xmpmeta>';
    const extractedDouble = extractXmpTagText(doubleEncodedXmp, 'dc:title');
    expect(extractedDouble).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(extractedDouble).not.toContain('<script>');

    const nestedCommentXmp = '<x:xmpmeta><dc:description><!-- outer <!-- inner --> <script>alert(1)</script> -->Clean Desc</dc:description></x:xmpmeta>';
    const extractedComment = extractXmpTagText(nestedCommentXmp, 'dc:description');
    expect(extractedComment).not.toContain('<script');
    expect(extractedComment).toContain('Clean Desc');
  });
});

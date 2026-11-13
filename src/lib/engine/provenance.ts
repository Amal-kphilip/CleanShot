const PROVENANCE_ASCII_MARKERS = [
  'c2pa',
  'jumbf',
  'contentauth',
  'digitalsourcetype',
  'trainedalgorithmicmedia',
  'dcterms:provenance',
];

// Official C2PA JUMBF UUID: d8fec3d6-1b0e-483c-9297-5828877ec481
const C2PA_JUMBF_UUID = new Uint8Array([
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c,
  0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81,
]);

function includesBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0 || haystack.length < needle.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Checks whether a metadata segment, chunk, or container box contains
 * C2PA / Content Credentials / AI-disclosure provenance markers.
 */
export function containsProvenanceMarkers(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (includesBytes(bytes, C2PA_JUMBF_UUID)) return true;

  // Decode bounded metadata slice as latin1/ascii for case-insensitive marker matching.
  const limit = Math.min(bytes.length, 512 * 1024);
  let text = '';
  for (let i = 0; i < limit; i++) {
    const code = bytes[i];
    if (code >= 32 && code <= 126) {
      text += String.fromCharCode(code);
    } else if (text.length > 0 && text[text.length - 1] !== ' ') {
      text += ' ';
    }
  }
  const lower = text.toLowerCase();
  return PROVENANCE_ASCII_MARKERS.some((marker) => lower.includes(marker));
}

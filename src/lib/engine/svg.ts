import { StripOptions } from './types';

/**
 * Lossless SVG Metadata, Comment, and Editor Namespaces Stripper.
 * Sanitizes and strips metadata, RDF, XML comments, editor generator tags (Inkscape, Illustrator, Figma, CorelDraw),
 * and potential active scripting payloads while strictly preserving vector paths, gradients, shapes, styles, and viewbox.
 */
export function stripSvg(buffer: Uint8Array, options: StripOptions = {}): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  const removedSegments: string[] = [];
  const text = new TextDecoder('utf-8').decode(buffer);

  let cleanedText = text;

  // 1. Remove XML Comments (<!-- ... -->)
  if (/<!--[\s\S]*?-->/g.test(cleanedText)) {
    cleanedText = cleanedText.replace(/<!--[\s\S]*?-->/g, '');
    removedSegments.push('SVG Comments & Generator Tags');
  }

  // 2. Remove <metadata>...</metadata> blocks
  if (/<metadata[\s\S]*?<\/metadata>/gi.test(cleanedText)) {
    cleanedText = cleanedText.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
    removedSegments.push('SVG <metadata> Container');
  }

  // 3. Remove <rdf:RDF>...</rdf:RDF> blocks
  if (/<rdf:RDF[\s\S]*?<\/rdf:RDF>/gi.test(cleanedText)) {
    cleanedText = cleanedText.replace(/<rdf:RDF[\s\S]*?<\/rdf:RDF>/gi, '');
    removedSegments.push('RDF Metadata');
  }

  // 4. Remove Adobe / Illustrator / Photoshop XML packets <?xpacket ... ?>
  if (/<\?xpacket[\s\S]*?\?>/gi.test(cleanedText)) {
    cleanedText = cleanedText.replace(/<\?xpacket[\s\S]*?\?>/gi, '');
    removedSegments.push('XMP Packet in SVG');
  }

  // 5. Remove dangerous script tags and event handlers for strict security
  if (/<script[\s\S]*?<\/script>/gi.test(cleanedText)) {
    cleanedText = cleanedText.replace(/<script[\s\S]*?<\/script>/gi, '');
    removedSegments.push('Executable Script Tags');
  }

  // Remove on* inline event attributes (e.g. onload, onclick)
  cleanedText = cleanedText.replace(/\son\w+\s*=\s*(["']).*?\1/gi, '');

  // 6. Strip editor-specific namespace attributes (inkscape, sodipodi, adobe, sketch)
  const editorAttrs = [
    /xmlns:inkscape="[^"]*"/gi,
    /xmlns:sodipodi="[^"]*"/gi,
    /xmlns:adobe="[^"]*"/gi,
    /xmlns:i="[^"]*"/gi,
    /xmlns:x="[^"]*"/gi,
    /xmlns:sketch="[^"]*"/gi,
    /inkscape:[a-zA-Z0-9_-]+="[^"]*"/gi,
    /sodipodi:[a-zA-Z0-9_-]+="[^"]*"/gi,
    /sketch:[a-zA-Z0-9_-]+="[^"]*"/gi,
  ];

  let strippedEditorData = false;
  for (const pattern of editorAttrs) {
    if (pattern.test(cleanedText)) {
      cleanedText = cleanedText.replace(pattern, '');
      strippedEditorData = true;
    }
  }

  if (strippedEditorData) {
    removedSegments.push('Editor Specific Namespaces & Attributes (Inkscape/Illustrator)');
  }

  // Clean extra whitespace between attributes
  cleanedText = cleanedText.replace(/\s{2,}/g, ' ');

  const cleanedBuffer = new TextEncoder().encode(cleanedText);

  return {
    cleanedBuffer,
    removedSegments,
    bytesSaved: buffer.length - cleanedBuffer.length,
  };
}

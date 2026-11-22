/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

import { PDFDocument, PDFName } from 'pdf-lib';

/**
 * CleanShot canonical PDF metadata cleaner using `pdf-lib`:
 * - Loads with `updateMetadata: false`.
 * - Removes the catalog `/Metadata` reference.
 * - Clears Title, Author, Subject, Keywords, Producer, and Creator in-place.
 * - Deletes `trailerInfo.Info` after clearing fields.
 * - Deletes `trailerInfo.ID` document identifier pair.
 * - Saves with `useObjectStreams: false`.
 */
export async function stripPdf(bytes: Uint8Array): Promise<{
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
}> {
  const pdfDoc = await PDFDocument.load(bytes, {
    updateMetadata: false,
  });

  const removedSegments: string[] = [];

  // Remove XMP / Metadata stream from the Catalog (if present)
  const metadataKey = PDFName.of('Metadata');
  if (pdfDoc.catalog.get(metadataKey)) {
    pdfDoc.catalog.delete(metadataKey);
    removedSegments.push('PDF Catalog /Metadata XMP stream');
  }

  // Clear text fields first (modifies the existing Info dict in-place so the
  // original values are overwritten in the serialized output, not just de-referenced)
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('');
  pdfDoc.setCreator('');
  removedSegments.push('PDF Document Info fields');

  // Remove the Info dict reference from the trailer entirely AFTER the set* calls above
  if (pdfDoc.context?.trailerInfo?.Info) {
    delete pdfDoc.context.trailerInfo.Info;
    removedSegments.push('PDF Trailer /Info reference');
  }

  // Remove the document /ID pair
  if (pdfDoc.context?.trailerInfo?.ID) {
    delete pdfDoc.context.trailerInfo.ID;
    removedSegments.push('PDF Trailer /ID document fingerprint');
  }

  const newPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const cleanedBuffer = new Uint8Array(newPdfBytes);

  return {
    cleanedBuffer,
    removedSegments,
    bytesSaved: bytes.length - cleanedBuffer.length,
  };
}

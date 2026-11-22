import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';
import {
  extractSupportedFilesFromZipBuffer,
  isHiddenMacOsEntry,
  isZipFile,
  sanitizeArchiveRelativePath,
} from '../../zip/zipExtractor';
import {
  createZipArchiveInWorker,
  extractZipArchiveInWorker,
  inspectFileInWorker,
  processFileItem,
} from '../../worker/workerRunner';
import { stripImageMetadata } from '../stripper';
import {
  createSampleJpegWithMetadata,
  createSamplePngWithMetadata,
} from './fixtures';

const ROOT = path.resolve(__dirname, '../../../..');

describe('Client-Side ZIP Extraction Engine', () => {
  it('identifies ZIP files and filters macOS hidden entries & path traversal', () => {
    expect(isZipFile({ name: 'photos.zip', type: 'application/zip' })).toBe(true);
    expect(isZipFile({ name: 'ARCHIVE.ZIP', type: '' })).toBe(true);
    expect(isZipFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);

    expect(isHiddenMacOsEntry('__MACOSX/album/._photo.jpg')).toBe(true);
    expect(isHiddenMacOsEntry('album/.DS_Store')).toBe(true);
    expect(isHiddenMacOsEntry('album/._DS_Store')).toBe(true);
    expect(isHiddenMacOsEntry('album/._img.png')).toBe(true);
    expect(isHiddenMacOsEntry('album/photo.jpg')).toBe(false);

    expect(sanitizeArchiveRelativePath('../../secret/trip/photo.jpg')).toEqual({
      name: 'photo.jpg',
      relativePath: 'secret/trip/photo.jpg',
    });
  });

  it('extracts nested supported media/documents, ignores macOS/unsupported files, and cleans extracted images', async () => {
    const zip = new JSZip();
    const sampleJpeg = createSampleJpegWithMetadata();
    const samplePng = createSamplePngWithMetadata();
    const fixedDate = new Date('2025-05-10T12:00:00Z');

    zip.file('trip/day1/camera.jpg', sampleJpeg, { date: fixedDate });
    zip.file('trip/day2/screen.png', samplePng, { date: fixedDate });
    zip.file('docs/report.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
      date: fixedDate,
    });
    zip.file('audio/voice.mp3', new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]), {
      date: fixedDate,
    });
    // Hidden macOS & unsupported files that must be ignored
    zip.file('__MACOSX/trip/day1/._camera.jpg', new Uint8Array([1, 2, 3]));
    zip.file('trip/.DS_Store', new Uint8Array([4, 5, 6]));
    zip.file('trip/._hidden.png', new Uint8Array([7, 8, 9]));
    zip.file('raw/unsupported.heic', new Uint8Array([10, 11, 12]));
    zip.file('notes/readme.txt', 'hello world');

    const archiveBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const progressEvents: number[] = [];

    const result = await extractSupportedFilesFromZipBuffer(
      archiveBuffer,
      'bundle.zip',
      {},
      (p) => progressEvents.push(p.processedEntries),
    );

    expect(result.rejected).toEqual([]);
    expect(result.skippedUnsupportedCount).toBe(2);
    expect(result.totalCandidateEntries).toBe(4);
    expect(result.extractedFiles.map((f) => f.relativePath).sort()).toEqual([
      'audio/voice.mp3',
      'docs/report.pdf',
      'trip/day1/camera.jpg',
      'trip/day2/screen.png',
    ]);
    expect(progressEvents[progressEvents.length - 1]).toBe(4);

    const jpegEntry = result.extractedFiles.find((f) => f.name === 'camera.jpg')!;
    expect(jpegEntry.mimeType).toBe('image/jpeg');
    const stripRes = await stripImageMetadata(
      new Uint8Array(jpegEntry.buffer),
      jpegEntry.name,
    );
    expect(stripRes.error).toBeUndefined();
    expect(stripRes.cleanedSize).toBeLessThan(stripRes.originalSize);
  });

  it('enforces per-file size, total batch byte limits, and file count limits', async () => {
    const zip = new JSZip();
    const sampleJpeg = createSampleJpegWithMetadata();
    zip.file('first.jpg', sampleJpeg);
    zip.file('second.jpg', sampleJpeg);
    zip.file('oversized.png', new Uint8Array(2048));

    const archiveBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    const limitedResult = await extractSupportedFilesFromZipBuffer(
      archiveBuffer,
      'limits.zip',
      {
        maxFileBytes: 1024, // oversized.png exceeds 1024 B
        maxRemainingFiles: 1, // only 1 file allowed
        maxRemainingBytes: 100_000,
      },
    );

    expect(limitedResult.extractedFiles.length).toBe(1);
    expect(limitedResult.extractedFiles[0].name).toBe('first.jpg');
    expect(limitedResult.rejected.some((r) => r.includes('oversized.png'))).toBe(true);
    expect(limitedResult.rejected.some((r) => r.includes('second.jpg'))).toBe(true);
  });

  it('rejects corrupted or empty archives and supports AbortSignal cancellation', async () => {
    await expect(
      extractSupportedFilesFromZipBuffer(new ArrayBuffer(0), 'empty.zip'),
    ).rejects.toThrow(/empty or corrupted/i);

    const garbage = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]).buffer;
    await expect(
      extractSupportedFilesFromZipBuffer(garbage, 'corrupt.zip'),
    ).rejects.toThrow(/corrupted or not a valid ZIP/i);

    const abortCtrl = new AbortController();
    abortCtrl.abort(new Error('Extraction canceled by user'));
    await expect(
      extractSupportedFilesFromZipBuffer(
        garbage,
        'aborted.zip',
        {},
        undefined,
        abortCtrl.signal,
      ),
    ).rejects.toThrow('Extraction canceled by user');
  });
});

describe('Worker Fallback Policy & UI Upgrades', () => {
  it('enforces consistent safe main-thread fallback thresholds when Worker initialization fails', async () => {
    const originalWorker = (globalThis as { Worker?: unknown }).Worker;
    try {
      (globalThis as { Worker?: unknown }).Worker = function ThrowingWorker() {
        throw new Error('Worker blocked');
      };

      // Video files must never fall back to the main thread
      const videoFile = new File([new Uint8Array([0, 1, 2, 3])], 'clip.mp4', {
        type: 'video/mp4',
      });
      await expect(inspectFileInWorker(videoFile)).rejects.toThrow(
        /Background metadata worker failed to initialize/i,
      );
      await expect(
        processFileItem({
          id: 'vid-1',
          file: videoFile,
          options: { stripAll: true },
        }),
      ).rejects.toThrow(/Background metadata worker failed to initialize/i);

      // Small non-video image is allowed to use main-thread fallback
      const smallJpeg = new File(
        [new Uint8Array(createSampleJpegWithMetadata())],
        'small.jpg',
        {
          type: 'image/jpeg',
        },
      );
      const processedSmall = await processFileItem({
        id: 'img-1',
        file: smallJpeg,
        options: { stripAll: true },
      });
      expect(processedSmall.result.error).toBeUndefined();

      // Small ZIP archive creation and extraction work with fallback
      const zipBlob = await createZipArchiveInWorker([
        { name: 'small.jpg', data: processedSmall.result.cleanedBuffer },
      ]);
      const zipFile = new File([await zipBlob.arrayBuffer()], 'small.zip', {
        type: 'application/zip',
      });
      const extracted = await extractZipArchiveInWorker(zipFile);
      expect(extracted.files.length).toBe(1);
      expect(extracted.files[0].name).toBe('small.jpg');
    } finally {
      (globalThis as { Worker?: unknown }).Worker = originalWorker;
    }
  });

  it('verifies DropZone dual upload inputs and Gemini Watermark UI/ZIP upgrades', () => {
    const dropzoneCode = fs.readFileSync(
      path.join(ROOT, 'src/components/DropZone.tsx'),
      'utf8',
    );
    expect(dropzoneCode).toContain('Select Photos &amp; Videos');
    expect(dropzoneCode).toContain('Upload ZIP Archive, Documents &amp; Audio');
    expect(dropzoneCode).toContain("const PHOTO_VIDEO_ACCEPT = 'image/*,video/*'");
    expect(dropzoneCode).toContain('Extracting files from ZIP...');
    expect(dropzoneCode).not.toMatch(/\bcapture=/);
    expect(dropzoneCode).toContain('id="cleanshot-upload-photos-videos"');
    expect(dropzoneCode).toContain('id="cleanshot-upload-zip-docs-audio"');
    expect(dropzoneCode).toContain('id="cleanshot-upload-folder"');
    expect(
      dropzoneCode.indexOf('id="cleanshot-upload-folder"'),
    ).toBeLessThan(dropzoneCode.indexOf('role="button"'));

    const gwrPageCode = fs.readFileSync(
      path.join(ROOT, 'src/app/gemini-watermark-remover/page.tsx'),
      'utf8',
    );
    expect(gwrPageCode).toContain('createZipArchiveInWorker');
    expect(gwrPageCode).toContain('Download cleaned image');
    expect(gwrPageCode).toContain('Download cleaned MP4');
    expect(gwrPageCode).toContain('Download all ({readyItems.length}) as ZIP');
    expect(gwrPageCode).toContain('scaleX(');
  });
});

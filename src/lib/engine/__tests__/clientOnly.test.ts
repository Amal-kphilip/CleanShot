import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { stripImageMetadata } from '../stripper';
import { createZipArchive } from '../../zip/clientZip';
import {
  createSampleJpegWithMetadata,
  createSamplePngWithMetadata,
} from './fixtures';

const ROOT = path.resolve(__dirname, '../../../..');

describe('Client-Only Processing & ZIP Packaging', () => {
  it('strips JPEG and PNG metadata locally without server APIs', async () => {
    const jpeg = createSampleJpegWithMetadata();
    const png = createSamplePngWithMetadata();

    const jpegResult = await stripImageMetadata(jpeg, 'photo.jpg');
    expect(jpegResult.error).toBeUndefined();
    expect(jpegResult.cleanedSize).toBeLessThan(jpegResult.originalSize);
    expect(jpegResult.removedSegments.length).toBeGreaterThan(0);

    const pngResult = await stripImageMetadata(png, 'diagram.png');
    expect(pngResult.error).toBeUndefined();
    expect(pngResult.cleanedSize).toBeLessThan(pngResult.originalSize);
    expect(pngResult.removedSegments.length).toBeGreaterThan(0);
  });

  it('creates client-side ZIP archives with deduplication and path sanitization', async () => {
    const jpegResult = await stripImageMetadata(createSampleJpegWithMetadata(), 'photo.jpg');
    const pngResult = await stripImageMetadata(createSamplePngWithMetadata(), 'diagram.png');

    const flatZip = createZipArchive(
      [
        { name: 'photo_clean.jpg', data: jpegResult.cleanedBuffer, path: 'trip/day1/photo_clean.jpg' },
        { name: 'photo_clean.jpg', data: jpegResult.cleanedBuffer, path: 'trip/day2/photo_clean.jpg' },
        { name: 'diagram_clean.png', data: pngResult.cleanedBuffer, path: '../../secret/diagram_clean.png' },
      ],
      false
    );

    expect(flatZip.type).toBe('application/zip');
    const flatEntries = unzipSync(new Uint8Array(await flatZip.arrayBuffer()));
    expect(Object.keys(flatEntries).sort()).toEqual([
      'diagram_clean.png',
      'photo_clean.jpg',
      'photo_clean_1.jpg',
    ]);

    const folderZip = createZipArchive(
      [
        { name: 'photo_clean.jpg', data: jpegResult.cleanedBuffer, path: 'trip/day1/photo_clean.jpg' },
        { name: 'diagram_clean.png', data: pngResult.cleanedBuffer, path: '../../secret/diagram_clean.png' },
      ],
      true
    );

    const folderEntries = unzipSync(new Uint8Array(await folderZip.arrayBuffer()));
    expect(Object.keys(folderEntries).sort()).toEqual([
      'secret/diagram_clean.png',
      'trip/day1/photo_clean.jpg',
    ]);
  });

  it('handles malformed or unrecognized files without crashing', async () => {
    const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    const unknownResult = await stripImageMetadata(unknownBytes, 'corrupt.bin');
    expect(unknownResult.error).toBeTruthy();

    const truncatedJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, 0x45, 0x78]);
    const truncatedResult = await stripImageMetadata(truncatedJpeg, 'broken.jpg');
    expect(truncatedResult.cleanedBuffer).toBeInstanceOf(Uint8Array);
  });
});

describe('Absence of Server-Side Mode', () => {
  it('has removed server-side API routes and job store', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/api/jobs'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/app/api/inspect'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/lib/server/jobStore.ts'))).toBe(false);
  });

  it('does not include archiver in package.json dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.archiver).toBeUndefined();
    expect(pkg.devDependencies?.['@types/archiver']).toBeUndefined();
  });

  it('has removed server-side mode toggles, API calls, and copy from UI pages', () => {
    const filesToCheck = [
      'src/app/page.tsx',
      'src/components/SettingsModal.tsx',
      'src/app/privacy/page.tsx',
      'src/app/how-it-works/page.tsx',
    ];

    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      expect(content).not.toContain('/api/jobs');
      expect(content).not.toContain('isServerMode');
      expect(content).not.toContain('Server-Side');
    }
  });
});

import { it, describe, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createSampleJpegWithMetadata,
  createSamplePngWithMetadata,
  createSampleWebpWithMetadata,
} from './fixtures';

describe('Sample Fixtures Generator', () => {
  it('creates test fixtures in sample-images directory', () => {
    const samplesDir = path.resolve(process.cwd(), 'sample-images');
    if (!fs.existsSync(samplesDir)) {
      fs.mkdirSync(samplesDir, { recursive: true });
    }

    fs.writeFileSync(path.join(samplesDir, 'sample_camera_gps.jpg'), createSampleJpegWithMetadata());
    fs.writeFileSync(path.join(samplesDir, 'sample_graphic_author.png'), createSamplePngWithMetadata());
    fs.writeFileSync(path.join(samplesDir, 'sample_extended_header.webp'), createSampleWebpWithMetadata());

    expect(fs.existsSync(path.join(samplesDir, 'sample_camera_gps.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(samplesDir, 'sample_graphic_author.png'))).toBe(true);
    expect(fs.existsSync(path.join(samplesDir, 'sample_extended_header.webp'))).toBe(true);
  });
});

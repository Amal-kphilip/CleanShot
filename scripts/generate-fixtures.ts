import fs from 'fs';
import path from 'path';
import {
  createSampleJpegWithMetadata,
  createSamplePngWithMetadata,
  createSampleWebpWithMetadata,
  createSampleSvgWithMetadata,
} from '../src/lib/engine/__tests__/fixtures';

const samplesDir = path.resolve(__dirname, '../../sample-images');

if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

// Generate sample images with metadata
fs.writeFileSync(path.join(samplesDir, 'sample_camera_gps.jpg'), createSampleJpegWithMetadata());
fs.writeFileSync(path.join(samplesDir, 'sample_graphic_author.png'), createSamplePngWithMetadata());
fs.writeFileSync(path.join(samplesDir, 'sample_extended_header.webp'), createSampleWebpWithMetadata());
fs.writeFileSync(path.join(samplesDir, 'sample_vector_generator.svg'), createSampleSvgWithMetadata());

console.log('Sample metadata-heavy fixture images created in sample-images/');

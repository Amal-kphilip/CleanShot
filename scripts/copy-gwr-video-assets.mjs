import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicVideoDir = path.join(projectRoot, 'public', 'gemini-video');

const modelsSrc = path.join(
  projectRoot,
  'node_modules',
  '@pilio',
  'gemini-watermark-remover',
  'dist',
  'models',
  'allenk-fdncnn'
);
const modelsDest = path.join(publicVideoDir, 'models', 'allenk-fdncnn');

const ortSrc = path.join(projectRoot, 'node_modules', 'onnxruntime-web', 'dist');
const ortDest = path.join(publicVideoDir, 'onnxruntime');

const ortFiles = [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
];

async function copyDirFiles(srcDir, destDir, allowList = null) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (allowList && !allowList.includes(entry.name)) continue;
    await copyFile(path.join(srcDir, entry.name), path.join(destDir, entry.name));
    count++;
  }
  return count;
}

const modelCount = await copyDirFiles(modelsSrc, modelsDest);
const ortCount = await copyDirFiles(ortSrc, ortDest, ortFiles);

console.log(
  `Copied ${modelCount} ONNX model files and ${ortCount} ONNX Runtime WASM files to public/gemini-video/.`
);

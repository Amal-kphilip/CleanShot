import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  path.join(projectRoot, 'node_modules', '@6over3', 'zeroperl-ts', 'dist', 'esm', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@6over3', 'zeroperl-ts', 'dist', 'cjs', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@6over3', 'zeroperl-ts', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@uswriting', 'exiftool', 'node_modules', '@6over3', 'zeroperl-ts', 'dist', 'esm', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@uswriting', 'exiftool', 'node_modules', '@6over3', 'zeroperl-ts', 'dist', 'cjs', 'zeroperl.wasm'),
];

let source;
for (const candidate of candidates) {
  try {
    const info = await stat(candidate);
    if (info.isFile()) {
      source = candidate;
      break;
    }
  } catch {
    // Try the next supported package layout.
  }
}

if (!source) {
  throw new Error(
    'Could not find the ExifTool WebAssembly runtime in @6over3/zeroperl-ts. Confirm the package was installed and inspect node_modules/@6over3/zeroperl-ts/dist/.'
  );
}

const publicDir = path.join(projectRoot, 'public');
const destination = path.join(publicDir, 'zeroperl.wasm');
await mkdir(publicDir, { recursive: true });
await copyFile(source, destination);
const info = await stat(destination);
console.log(`Copied the local ExifTool WebAssembly runtime to public/zeroperl.wasm (${info.size.toLocaleString()} bytes).`);

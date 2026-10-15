import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(projectRoot, 'public');
const destination = path.join(publicDir, 'zeroperl.wasm');
const temporaryDestination = `${destination}.download`;
const markerPath = path.join(projectRoot, 'node_modules', '.cache', 'stripmeta-zeroperl-wasm-version');
const wasmMagic = [0x00, 0x61, 0x73, 0x6d];

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

async function isValidWasm(file) {
  try {
    const handle = await import('node:fs/promises').then(({ open }) => open(file, 'r'));
    try {
      const buffer = Buffer.alloc(4);
      const result = await handle.read(buffer, 0, 4, 0);
      return result.bytesRead === 4 && wasmMagic.every((byte, index) => buffer[index] === byte);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

async function getRuntimeVersion() {
  const packageJsonPaths = [
    path.join(projectRoot, 'node_modules', '@lilohuang', 'zeroperl-ts', 'package.json'),
    path.join(projectRoot, 'node_modules', '@lilohuang', 'exiftool', 'node_modules', '@lilohuang', 'zeroperl-ts', 'package.json'),
  ];
  for (const packagePath of packageJsonPaths) {
    const packageJson = await readJson(packagePath);
    if (packageJson?.version) return packageJson.version;
  }

  const lock = await readJson(path.join(projectRoot, 'package-lock.json'));
  const packages = lock?.packages ?? {};
  const candidate = Object.entries(packages).find(([key]) =>
    key === 'node_modules/@lilohuang/zeroperl-ts' || key.endsWith('/node_modules/@lilohuang/zeroperl-ts')
  );
  if (candidate?.[1]?.version) return candidate[1].version;

  throw new Error('Could not determine the installed @lilohuang/zeroperl-ts version. Run npm install before copying the WebAssembly runtime.');
}

const version = await getRuntimeVersion();
let markerVersion = '';
try { markerVersion = (await readFile(markerPath, 'utf8')).trim(); } catch { /* not generated yet */ }

if (markerVersion === version && await isValidWasm(destination)) {
  console.log(`Local ExifTool WebAssembly runtime is already present for zeroperl-ts ${version}.`);
  process.exit(0);
}

const candidates = [
  path.join(projectRoot, 'node_modules', '@lilohuang', 'zeroperl-ts', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@lilohuang', 'zeroperl-ts', 'dist', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@lilohuang', 'zeroperl-ts', 'dist', 'esm', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@lilohuang', 'zeroperl-ts', 'dist', 'cjs', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@lilohuang', 'exiftool', 'node_modules', '@lilohuang', 'zeroperl-ts', 'zeroperl.wasm'),
  path.join(projectRoot, 'node_modules', '@lilohuang', 'exiftool', 'node_modules', '@lilohuang', 'zeroperl-ts', 'dist', 'esm', 'zeroperl.wasm'),
];

let source;
for (const candidate of candidates) {
  if (await isValidWasm(candidate)) { source = candidate; break; }
}

await mkdir(publicDir, { recursive: true });
await mkdir(path.dirname(markerPath), { recursive: true });

if (source) {
  await copyFile(source, destination);
  console.log(`Copied the package WebAssembly runtime to public/zeroperl.wasm (${source}).`);
} else {
  // The package README documents the WASM artifact via esm.sh; it is not included
  // as a normal file in some npm package layouts. Download the exact installed version.
  const url = `https://esm.sh/@lilohuang/zeroperl-ts@${version}/zeroperl.wasm`;
  console.log(`The npm package does not contain a local .wasm file. Downloading the documented browser artifact for zeroperl-ts ${version}...`);
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'follow' });
  } catch (error) {
    throw new Error(`Could not download the ExifTool WebAssembly runtime from ${url}. Check network access and retry. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`The WebAssembly download failed with HTTP ${response.status} from ${url}. Check that the installed package version has a published esm.sh artifact.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 8 || !wasmMagic.every((byte, index) => bytes[index] === byte)) {
    throw new Error(`The download from ${url} was not a valid WebAssembly binary (received ${bytes.length.toLocaleString()} bytes). The file was not installed.`);
  }
  await writeFile(temporaryDestination, bytes);
  await rename(temporaryDestination, destination);
  console.log(`Downloaded and verified public/zeroperl.wasm (${bytes.length.toLocaleString()} bytes).`);
}

if (!(await isValidWasm(destination))) {
  throw new Error('The installed public/zeroperl.wasm failed validation. Check the package artifact and retry.');
}
await writeFile(markerPath, `${version}\n`, 'utf8');
const info = await stat(destination);
console.log(`ExifTool browser runtime is ready (${info.size.toLocaleString()} bytes; zeroperl-ts ${version}).`);

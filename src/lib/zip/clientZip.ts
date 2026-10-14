import { sanitizeFilename } from '../engine/magic';
import { zipSync, Zippable } from 'fflate';

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
  path?: string;
}

/**
 * Creates a ZIP archive losslessly with STORE (0-compression) mode
 * for already compressed image formats, ensuring ultra-fast generation and minimal memory overhead.
 */
export function createZipArchive(
  files: ZipFileInput[],
  preserveFolders: boolean = false
): Blob {
  const zipObj: Zippable = {};
  const usedNames = new Set<string>();

  for (const file of files) {
    const requestedPath = preserveFolders && file.path ? file.path : file.name;
    // Normalize paths and remove traversal segments before creating archive entries.
    const pathParts = requestedPath.replace(/\\/g, '/').split('/').filter((part) => part && part !== '.' && part !== '..');
    const leaf = sanitizeFilename(pathParts.pop() || file.name);
    let zipPath = [...pathParts.map((part) => sanitizeFilename(part)), leaf].join('/');
    if (!zipPath || zipPath.startsWith('/')) zipPath = sanitizeFilename(file.name);

    // Avoid duplicate names in ZIP
    if (usedNames.has(zipPath)) {
      const slash = zipPath.lastIndexOf('/');
      const directory = slash >= 0 ? zipPath.slice(0, slash + 1) : '';
      const filename = slash >= 0 ? zipPath.slice(slash + 1) : zipPath;
      const dot = filename.lastIndexOf('.');
      const base = dot > 0 ? filename.substring(0, dot) : filename;
      const ext = dot > 0 ? filename.substring(dot) : '';
      let counter = 1;
      while (usedNames.has(`${directory}${base}_${counter}${ext}`)) counter++;
      zipPath = `${directory}${base}_${counter}${ext}`;
    }

    usedNames.add(zipPath);

    // Use compression level 0 (STORE) for already-compressed binary images
    zipObj[zipPath] = [file.data, { level: 0 }];
  }

  const zipped = zipSync(zipObj);
  return new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
}

/**
 * Triggers a direct client download of a Blob
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

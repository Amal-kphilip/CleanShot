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
    let zipPath = preserveFolders && file.path ? file.path : file.name;

    // Avoid duplicate names in ZIP
    if (usedNames.has(zipPath)) {
      const dot = zipPath.lastIndexOf('.');
      let base = dot === -1 ? zipPath : zipPath.substring(0, dot);
      const ext = dot === -1 ? '' : zipPath.substring(dot);
      let counter = 1;
      while (usedNames.has(`${base}_${counter}${ext}`)) {
        counter++;
      }
      zipPath = `${base}_${counter}${ext}`;
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

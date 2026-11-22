import JSZip from 'jszip';
import { sanitizeFilename } from '../engine/magic';

export const MAX_ZIP_ARCHIVE_BYTES = 100 * 1024 * 1024; // 100 MB compressed archive cap
export const MAX_EXTRACTED_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const MAX_QUEUE_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB total queue
export const MAX_QUEUE_FILES = 150; // 150 files total queue
export const MAX_ARCHIVE_ENTRIES_INSPECT = 2500; // Guard against zip-bomb directory floods

export const SUPPORTED_ZIP_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
};

export interface ExtractedZipEntryPayload {
  name: string;
  relativePath: string;
  mimeType: string;
  lastModified: number;
  buffer: ArrayBuffer;
}

export interface ZipExtractionLimits {
  maxFileBytes?: number;
  maxRemainingBytes?: number;
  maxRemainingFiles?: number;
  concurrency?: number;
}

export interface ZipExtractionProgress {
  archiveName: string;
  extractedCount: number;
  processedEntries: number;
  totalEntries: number;
}

export interface ZipExtractionWorkerResult {
  extractedFiles: ExtractedZipEntryPayload[];
  rejected: string[];
  skippedUnsupportedCount: number;
  totalCandidateEntries: number;
}

export function isZipFile(file: { name: string; type?: string }): boolean {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.zip')) return true;
  const mime = (file.type || '').toLowerCase();
  return (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'multipart/x-zip'
  );
}

/**
 * Checks whether a ZIP entry path is a hidden macOS metadata artifact
 * (`__MACOSX/`, `._*`, or `.DS_Store`).
 */
export function isHiddenMacOsEntry(rawPath: string): boolean {
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return true;
  for (const segment of segments) {
    if (segment === '__MACOSX') return true;
  }
  const base = segments[segments.length - 1];
  if (base.toLowerCase() === '.ds_store') return true;
  if (base.startsWith('._')) return true;
  return false;
}

/**
 * Sanitizes an archive entry's relative path against path traversal (`..`, `.`, leading `/`, drive letters).
 */
export function sanitizeArchiveRelativePath(rawPath: string): {
  name: string;
  relativePath: string;
} | null {
  const normalized = rawPath.replace(/\0/g, '').replace(/\\/g, '/');
  const rawParts = normalized.split('/');
  const safeParts: string[] = [];

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..') continue;
    // Strip Windows drive prefixes like C:
    const withoutDrive = trimmed.replace(/^[a-zA-Z]:/, '');
    const cleaned = sanitizeFilename(withoutDrive);
    if (!cleaned || cleaned === '.' || cleaned === '..') continue;
    safeParts.push(cleaned);
  }

  if (safeParts.length === 0) return null;
  const name = safeParts[safeParts.length - 1];
  return {
    name,
    relativePath: safeParts.join('/'),
  };
}

export function getSupportedExtensionMime(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return SUPPORTED_ZIP_MIME_MAP[ext] ?? null;
}

function deduplicateRelativePath(
  relativePath: string,
  usedPaths: Set<string>,
): { name: string; relativePath: string } {
  if (!usedPaths.has(relativePath)) {
    usedPaths.add(relativePath);
    const slash = relativePath.lastIndexOf('/');
    return {
      name: slash >= 0 ? relativePath.slice(slash + 1) : relativePath,
      relativePath,
    };
  }

  const slash = relativePath.lastIndexOf('/');
  const dir = slash >= 0 ? relativePath.slice(0, slash + 1) : '';
  const leaf = slash >= 0 ? relativePath.slice(slash + 1) : relativePath;
  const dot = leaf.lastIndexOf('.');
  const base = dot > 0 ? leaf.slice(0, dot) : leaf;
  const ext = dot > 0 ? leaf.slice(dot) : '';
  let counter = 1;
  while (usedPaths.has(`${dir}${base}_${counter}${ext}`)) {
    counter++;
  }
  const nextLeaf = `${base}_${counter}${ext}`;
  const nextPath = `${dir}${nextLeaf}`;
  usedPaths.add(nextPath);
  return { name: nextLeaf, relativePath: nextPath };
}

interface InternalZipObject extends JSZip.JSZipObject {
  _data?: {
    uncompressedSize?: number;
    compressedSize?: number;
    encrypted?: boolean;
  };
}

/**
 * Extracts supported files from a ZIP ArrayBuffer with bounded concurrency,
 * strict per-file/total size limits, ZIP-bomb protection, and path sanitization.
 */
export async function extractSupportedFilesFromZipBuffer(
  buffer: ArrayBuffer,
  archiveName: string,
  limits: ZipExtractionLimits = {},
  onProgress?: (progress: ZipExtractionProgress) => void,
  signal?: AbortSignal,
): Promise<ZipExtractionWorkerResult> {
  signal?.throwIfAborted();

  if (buffer.byteLength === 0) {
    throw new Error(`${archiveName} is empty or corrupted.`);
  }
  if (buffer.byteLength > MAX_ZIP_ARCHIVE_BYTES) {
    throw new Error(`${archiveName} exceeds the 100 MB archive size limit.`);
  }

  const maxFileBytes = limits.maxFileBytes ?? MAX_EXTRACTED_FILE_BYTES;
  const maxRemainingBytes = limits.maxRemainingBytes ?? MAX_QUEUE_TOTAL_BYTES;
  const maxRemainingFiles = limits.maxRemainingFiles ?? MAX_QUEUE_FILES;
  const concurrency = Math.max(1, Math.min(4, limits.concurrency ?? 3));

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { createFolders: false });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (/encrypted|password/i.test(msg)) {
      throw new Error(`${archiveName} is password-protected and cannot be extracted.`);
    }
    throw new Error(`${archiveName} is corrupted or not a valid ZIP archive.`);
  }

  signal?.throwIfAborted();

  const allEntries = Object.values(zip.files) as InternalZipObject[];
  if (allEntries.length > MAX_ARCHIVE_ENTRIES_INSPECT) {
    throw new Error(
      `${archiveName} contains too many entries (${allEntries.length}) and was blocked for safety.`,
    );
  }

  const candidateEntries: Array<{
    entry: InternalZipObject;
    name: string;
    relativePath: string;
    mimeType: string;
  }> = [];
  const rejected: string[] = [];
  let skippedUnsupportedCount = 0;
  const usedPaths = new Set<string>();

  for (const entry of allEntries) {
    if (entry.dir || entry.name.endsWith('/')) continue;
    if (isHiddenMacOsEntry(entry.name)) continue;

    // Check raw path for obvious traversal attempts; sanitize into safe relative path
    const sanitized = sanitizeArchiveRelativePath(entry.name);
    if (!sanitized) continue;

    const mimeType = getSupportedExtensionMime(sanitized.name);
    if (!mimeType) {
      skippedUnsupportedCount++;
      continue;
    }

    if (entry._data?.encrypted) {
      rejected.push(`${sanitized.name} (encrypted entry)`);
      continue;
    }

    const declaredSize = entry._data?.uncompressedSize;
    if (typeof declaredSize === 'number' && declaredSize > maxFileBytes) {
      rejected.push(`${sanitized.name} (over 50 MB)`);
      continue;
    }
    if (typeof declaredSize === 'number' && declaredSize < 0) {
      rejected.push(`${sanitized.name} (invalid entry size)`);
      continue;
    }

    const deduped = deduplicateRelativePath(sanitized.relativePath, usedPaths);
    candidateEntries.push({
      entry,
      name: deduped.name,
      relativePath: deduped.relativePath,
      mimeType,
    });
  }

  const totalEntries = candidateEntries.length;
  onProgress?.({
    archiveName,
    extractedCount: 0,
    processedEntries: 0,
    totalEntries,
  });

  if (totalEntries === 0) {
    return {
      extractedFiles: [],
      rejected,
      skippedUnsupportedCount,
      totalCandidateEntries: 0,
    };
  }

  const extractedFiles: ExtractedZipEntryPayload[] = [];
  let accumulatedBytes = 0;
  let processedEntries = 0;
  let cursor = 0;

  const workerLoop = async () => {
    while (cursor < candidateEntries.length) {
      signal?.throwIfAborted();
      const idx = cursor++;
      const item = candidateEntries[idx];
      if (!item) return;

      // Check remaining file count before decompressing
      if (extractedFiles.length >= maxRemainingFiles) {
        rejected.push(`${item.name} (queue limit: ${MAX_QUEUE_FILES} files)`);
        processedEntries++;
        onProgress?.({
          archiveName,
          extractedCount: extractedFiles.length,
          processedEntries,
          totalEntries,
        });
        continue;
      }

      // Pre-check declared uncompressed size against remaining batch budget
      const declaredSize = item.entry._data?.uncompressedSize;
      if (
        typeof declaredSize === 'number' &&
        declaredSize > 0 &&
        accumulatedBytes + declaredSize > maxRemainingBytes
      ) {
        rejected.push(`${item.name} (batch limit: 100 MB)`);
        processedEntries++;
        onProgress?.({
          archiveName,
          extractedCount: extractedFiles.length,
          processedEntries,
          totalEntries,
        });
        continue;
      }

      try {
        const bytes = await item.entry.async('uint8array');
        signal?.throwIfAborted();

        if (bytes.byteLength > maxFileBytes) {
          rejected.push(`${item.name} (over 50 MB)`);
        } else if (extractedFiles.length >= maxRemainingFiles) {
          rejected.push(`${item.name} (queue limit: ${MAX_QUEUE_FILES} files)`);
        } else if (accumulatedBytes + bytes.byteLength > maxRemainingBytes) {
          rejected.push(`${item.name} (batch limit: 100 MB)`);
        } else {
          accumulatedBytes += bytes.byteLength;
          const transferBuffer =
            bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
              ? (bytes.buffer as ArrayBuffer)
              : (bytes.slice().buffer as ArrayBuffer);
          const dateMs =
            item.entry.date instanceof Date && !Number.isNaN(item.entry.date.getTime())
              ? item.entry.date.getTime()
              : Date.now();
          extractedFiles.push({
            name: item.name,
            relativePath: item.relativePath,
            mimeType: item.mimeType,
            lastModified: dateMs,
            buffer: transferBuffer,
          });
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        const msg = err instanceof Error ? err.message : '';
        if (/encrypted|password/i.test(msg)) {
          rejected.push(`${item.name} (encrypted entry)`);
        } else {
          rejected.push(`${item.name} (corrupted entry)`);
        }
      }

      processedEntries++;
      onProgress?.({
        archiveName,
        extractedCount: extractedFiles.length,
        processedEntries,
        totalEntries,
      });
    }
  };

  const poolSize = Math.min(concurrency, candidateEntries.length);
  await Promise.all(Array.from({ length: poolSize }, () => workerLoop()));

  return {
    extractedFiles,
    rejected,
    skippedUnsupportedCount,
    totalCandidateEntries: totalEntries,
  };
}

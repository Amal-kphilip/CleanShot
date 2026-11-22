import { stripImageMetadata } from '../engine/stripper';
import { inspectMetadata } from '../engine/inspector';
import { StripOptions, StripResult, ParsedMetadata } from '../engine/types';
import { createZipArchive, ZipFileInput } from '../zip/clientZip';
import {
  extractSupportedFilesFromZipBuffer,
  ZipExtractionLimits,
  ZipExtractionProgress,
  ZipExtractionWorkerResult,
} from '../zip/zipExtractor';

export interface ProcessTask {
  id: string;
  file: File;
  relativePath?: string;
  options: StripOptions;
  metadata?: ParsedMetadata;
}

export interface ProcessOutput {
  id: string;
  result: StripResult;
  metadata?: ParsedMetadata;
  cleanedMetadata?: ParsedMetadata;
  thumbnailUrl: string;
}

interface WorkerResponse {
  id: string;
  type?: 'progress';
  result?: StripResult;
  metadata?: ParsedMetadata;
  cleanedMetadata?: ParsedMetadata;
  zipBuffer?: ArrayBuffer;
  zipExtracted?: ZipExtractionWorkerResult;
  zipProgress?: ZipExtractionProgress;
  geminiMeta?: { width: number; height: number; meta: unknown };
  error?: string;
}

interface PooledTask {
  id: string;
  message: Record<string, unknown>;
  transfer: Transferable[];
  signal?: AbortSignal;
  onProgressMessage?: (data: WorkerResponse) => void;
  resolve: (value: WorkerResponse) => void;
  reject: (reason?: unknown) => void;
  cleanupAbort?: () => void;
}

interface PoolSlot {
  worker: Worker;
  busy: boolean;
  currentTask: PooledTask | null;
}

class WorkerUnavailableError extends Error {
  constructor(message = 'Web Worker unavailable') {
    super(message);
    this.name = 'WorkerUnavailableError';
  }
}

export const MAX_MAIN_THREAD_FALLBACK_BYTES = 10 * 1024 * 1024;
const poolSlots: PoolSlot[] = [];
const taskQueue: PooledTask[] = [];
let workersBlocked = false;
let lastWorkerCtor: unknown = undefined;

/**
 * Returns device-aware worker/task concurrency to protect low-memory mobile devices
 * while keeping desktop batches fast.
 */
export function getDeviceAwareConcurrency(maxDesktop = 3): number {
  if (typeof navigator === 'undefined') return 2;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const cores = navigator.hardwareConcurrency || 2;
  const isMobileViewport =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 768px)').matches;

  if (memory !== undefined && memory <= 2) return 1;
  if ((memory !== undefined && memory <= 4) || isMobileViewport) {
    return Math.min(2, Math.max(1, cores - 1));
  }
  return Math.min(maxDesktop, Math.max(1, cores - 1));
}

function getMaxPoolSize(): number {
  return getDeviceAwareConcurrency(4);
}

function isVideoFilename(filename: string): boolean {
  return /\.(mp4|mov|m4a|webm|mkv)$/i.test(filename);
}

function canFallbackToMainThread(byteLength: number, filename: string): boolean {
  return byteLength <= MAX_MAIN_THREAD_FALLBACK_BYTES && !isVideoFilename(filename);
}

function shouldEnforceWorkerRequirement(): boolean {
  return typeof Worker !== 'undefined' || typeof window !== 'undefined';
}

function syncWorkerEnvironment() {
  const currentCtor = typeof Worker !== 'undefined' ? Worker : undefined;
  if (currentCtor !== lastWorkerCtor) {
    lastWorkerCtor = currentCtor;
    workersBlocked = false;
    while (poolSlots.length > 0) {
      removeSlot(poolSlots[0]);
    }
  }
}

function removeSlot(slot: PoolSlot) {
  const index = poolSlots.indexOf(slot);
  if (index !== -1) poolSlots.splice(index, 1);
  slot.worker.onmessage = null;
  slot.worker.onerror = null;
  try {
    slot.worker.terminate();
  } catch {
    // Ignore termination errors on already-closed workers.
  }
}

function createPoolSlot(): PoolSlot {
  if (typeof Worker === 'undefined' || workersBlocked) {
    throw new WorkerUnavailableError();
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL('./stripWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    workersBlocked = true;
    throw new WorkerUnavailableError();
  }

  const slot: PoolSlot = {
    worker,
    busy: false,
    currentTask: null,
  };

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const active = slot.currentTask;
    if (!active || event.data.id !== active.id) return;
    if (event.data.type === 'progress') {
      active.onProgressMessage?.(event.data);
      return;
    }
    active.cleanupAbort?.();
    slot.currentTask = null;
    slot.busy = false;
    active.resolve(event.data);
    pumpQueue();
  };

  worker.onerror = (event) => {
    const active = slot.currentTask;
    slot.currentTask = null;
    slot.busy = false;
    removeSlot(slot);
    if (active) {
      active.cleanupAbort?.();
      active.reject(new Error(event.message || 'Image worker failed'));
    }
    pumpQueue();
  };

  poolSlots.push(slot);
  return slot;
}

function dispatchToSlot(slot: PoolSlot, task: PooledTask) {
  slot.busy = true;
  slot.currentTask = task;

  if (task.signal) {
    const onAbort = () => {
      if (slot.currentTask !== task) return;
      slot.currentTask = null;
      slot.busy = false;
      removeSlot(slot);
      task.reject(task.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      pumpQueue();
    };
    if (task.signal.aborted) {
      onAbort();
      return;
    }
    task.signal.addEventListener('abort', onAbort, { once: true });
    task.cleanupAbort = () => task.signal?.removeEventListener('abort', onAbort);
  }

  try {
    slot.worker.postMessage(task.message, task.transfer);
  } catch (error) {
    task.cleanupAbort?.();
    slot.currentTask = null;
    slot.busy = false;
    removeSlot(slot);
    task.reject(error instanceof Error ? error : new Error('Unable to start image worker'));
    pumpQueue();
  }
}

function pumpQueue() {
  while (taskQueue.length > 0) {
    let slot = poolSlots.find((s) => !s.busy);
    if (!slot) {
      if (poolSlots.length >= getMaxPoolSize()) return;
      try {
        slot = createPoolSlot();
      } catch (error) {
        while (taskQueue.length > 0) {
          const pending = taskQueue.shift()!;
          pending.cleanupAbort?.();
          pending.reject(error);
        }
        return;
      }
    }

    const nextTask = taskQueue.shift()!;
    if (nextTask.signal?.aborted) {
      nextTask.cleanupAbort?.();
      nextTask.reject(nextTask.signal.reason ?? new DOMException('Aborted', 'AbortError'));
      continue;
    }
    dispatchToSlot(slot, nextTask);
  }
}

function runInWorkerPool(
  id: string,
  message: Record<string, unknown>,
  transfer: Transferable[],
  signal?: AbortSignal,
  onProgressMessage?: (data: WorkerResponse) => void,
): Promise<WorkerResponse> {
  syncWorkerEnvironment();
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  }

  return new Promise<WorkerResponse>((resolve, reject) => {
    const task: PooledTask = {
      id,
      message,
      transfer,
      signal,
      onProgressMessage,
      resolve,
      reject,
    };

    if (signal) {
      const onQueuedAbort = () => {
        const idx = taskQueue.indexOf(task);
        if (idx !== -1) {
          taskQueue.splice(idx, 1);
          reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        }
      };
      signal.addEventListener('abort', onQueuedAbort, { once: true });
      task.cleanupAbort = () => signal.removeEventListener('abort', onQueuedAbort);
    }

    taskQueue.push(task);
    pumpQueue();
  });
}

/** Creates an object URL for an image thumbnail; returns empty string for non-image files. */
export function createThumbnail(file: File): string {
  try {
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : '';
    const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'heic'].includes(ext);
    if (!isImage) return '';
    return URL.createObjectURL(file);
  } catch {
    return '';
  }
}

async function stripInWorker(
  id: string,
  buffer: ArrayBuffer,
  filename: string,
  options: StripOptions,
  includeOriginalInspect: boolean,
  onProgress?: (progress: number) => void,
): Promise<{ result: StripResult; metadata?: ParsedMetadata; cleanedMetadata?: ParsedMetadata }> {
  const byteLength = buffer.byteLength;
  const allowFallback = canFallbackToMainThread(byteLength, filename);
  onProgress?.(35);
  try {
    const data = await runInWorkerPool(
      id,
      { id, action: 'strip', buffer, filename, options, includeOriginalInspect },
      [buffer],
    );
    if (data.error || !data.result) {
      throw new Error(data.error || 'Worker returned no processing result');
    }
    onProgress?.(100);
    return {
      result: data.result,
      metadata: data.metadata,
      cleanedMetadata: data.cleanedMetadata,
    };
  } catch (error) {
    if (!(error instanceof WorkerUnavailableError)) {
      throw error;
    }
    if (!allowFallback && shouldEnforceWorkerRequirement()) {
      throw new Error(
        'Background metadata worker failed to initialize. Large or video files cannot be cleaned on the main thread.',
      );
    }
    const inputBytes = new Uint8Array(buffer);
    let metadata: ParsedMetadata | undefined;
    if (includeOriginalInspect) {
      try {
        metadata = await inspectMetadata(inputBytes, filename);
      } catch {
        // Best-effort inspection.
      }
    }
    const result = await stripImageMetadata(inputBytes, filename, options);
    let cleanedMetadata: ParsedMetadata | undefined;
    if (!result.error) {
      try {
        cleanedMetadata = await inspectMetadata(result.cleanedBuffer, filename);
      } catch {
        // Best-effort verification.
      }
    }
    onProgress?.(100);
    return { result, metadata, cleanedMetadata };
  }
}

/** Run metadata inspection in the shared Web Worker pool so large EXIF payloads do not block scrolling. */
export async function inspectFileInWorker(file: File, id = crypto.randomUUID()): Promise<ParsedMetadata> {
  const allowFallback = canFallbackToMainThread(file.size, file.name);
  const buffer = await file.arrayBuffer();
  try {
    const data = await runInWorkerPool(
      id,
      { id, action: 'inspect', buffer, filename: file.name },
      [buffer],
    );
    if (data.metadata) return data.metadata;
    throw new Error(data.error || 'Metadata inspection failed');
  } catch (error) {
    if (error instanceof WorkerUnavailableError) {
      if (!allowFallback && shouldEnforceWorkerRequirement()) {
        throw new Error(
          'Background metadata worker failed to initialize. Large or video files cannot be inspected on the main thread.',
        );
      }
      return inspectMetadata(new Uint8Array(buffer), file.name);
    }
    throw error;
  }
}

/** Process one file; CPU-heavy metadata inspection and stripping are performed off the main thread. */
export async function processFileItem(
  task: ProcessTask,
  onProgress?: (progress: number) => void,
): Promise<ProcessOutput> {
  const arrayBuffer = await task.file.arrayBuffer();
  onProgress?.(20);

  const { result, metadata: workerMetadata, cleanedMetadata } = await stripInWorker(
    task.id,
    arrayBuffer,
    task.file.name,
    task.options,
    !task.metadata,
    onProgress,
  );

  return {
    id: task.id,
    result,
    metadata: task.metadata || workerMetadata,
    cleanedMetadata,
    thumbnailUrl: '',
  };
}

/**
 * Strips metadata from a Blob using the shared stripWorker pool (zero-copy transferable ArrayBuffer)
 * without running an extra inspection pass, respecting AbortSignal and failing on `result.error`.
 */
export async function stripBlobMetadataInWorker(
  blob: Blob,
  filename: string,
  options: StripOptions = {},
  signal?: AbortSignal,
): Promise<StripResult> {
  signal?.throwIfAborted();
  const buffer = await blob.arrayBuffer();
  signal?.throwIfAborted();

  const validateResult = (result: StripResult): StripResult => {
    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.cleanedBuffer || result.cleanedBuffer.length === 0) {
      throw new Error('Metadata cleaning returned an empty file.');
    }
    return result;
  };

  const allowMainThreadFallback = canFallbackToMainThread(blob.size, filename);

  const id = crypto.randomUUID();
  try {
    const data = await runInWorkerPool(
      id,
      { id, action: 'strip', buffer, filename, options, skipInspect: true },
      [buffer],
      signal,
    );
    if (data.error || !data.result) {
      throw new Error(data.error || 'Worker returned no metadata-cleaning result.');
    }
    return validateResult(data.result);
  } catch (error) {
    if (!(error instanceof WorkerUnavailableError)) {
      throw error;
    }
    if (!allowMainThreadFallback && shouldEnforceWorkerRequirement()) {
      throw new Error(
        'Background metadata worker failed to initialize. Large or video files cannot be cleaned on the main thread.',
      );
    }
    const result = await stripImageMetadata(new Uint8Array(buffer), filename, options);
    signal?.throwIfAborted();
    return validateResult(result);
  }
}

/** Concurrency-limited pool. At most `concurrency` worker jobs exist simultaneously. */
export async function processBatchWithConcurrency(
  tasks: ProcessTask[],
  concurrency: number = getDeviceAwareConcurrency(3),
  onFileStart?: (id: string) => void,
  onFileComplete?: (output: ProcessOutput) => void,
  onFileError?: (id: string, error: string) => void,
  onFileProgress?: (id: string, progress: number) => void,
): Promise<ProcessOutput[]> {
  const results: ProcessOutput[] = [];
  let currentIndex = 0;

  async function workerLoop() {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];
      if (!task) return;
      onFileStart?.(task.id);
      try {
        const output = await processFileItem(task, (progress) => onFileProgress?.(task.id, progress));
        results.push(output);
        onFileComplete?.(output);
      } catch (error) {
        onFileError?.(task.id, error instanceof Error ? error.message : 'Processing failed');
      }
    }
  }

  const poolSize = Math.max(1, Math.min(Math.floor(concurrency) || 1, tasks.length || 1));
  await Promise.all(Array.from({ length: poolSize }, () => workerLoop()));
  return results;
}

export interface GeminiWorkerImageResult {
  width: number;
  height: number;
  meta: unknown;
  result: StripResult;
}

/**
 * Runs Gemini watermark removal + canvas encoding + StripMeta cleaning inside the shared
 * Web Worker pool so the main thread and CSS animations remain completely unblocked.
 */
export async function processGeminiImageInWorker(
  file: File,
  outputName: string,
  targetMimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  adaptiveMode: 'auto' | 'always' | 'off',
  signal?: AbortSignal,
): Promise<GeminiWorkerImageResult | null> {
  if (
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined' ||
    typeof createImageBitmap !== 'function'
  ) {
    return null;
  }

  signal?.throwIfAborted();
  const buffer = await file.arrayBuffer();
  signal?.throwIfAborted();

  const id = crypto.randomUUID();
  try {
    const data = await runInWorkerPool(
      id,
      {
        id,
        action: 'gemini-image',
        buffer,
        sourceMimeType: file.type || 'image/png',
        outputName,
        targetMimeType,
        adaptiveMode,
      },
      [buffer],
      signal,
    );
    if (data.error || !data.result || !data.geminiMeta) {
      throw new Error(data.error || 'Worker failed to process Gemini image.');
    }
    return {
      width: data.geminiMeta.width,
      height: data.geminiMeta.height,
      meta: data.geminiMeta.meta,
      result: data.result,
    };
  } catch (error) {
    if (error instanceof WorkerUnavailableError) {
      return null;
    }
    throw error;
  }
}

/**
 * Builds a ZIP archive inside the shared Web Worker pool so large batches do not freeze the UI.
 * Allows main-thread fallback only for small archives (<= 10 MB) when workers are unavailable.
 */
export async function createZipArchiveInWorker(
  files: ZipFileInput[],
  preserveFolders: boolean = false,
): Promise<Blob> {
  const totalBytes = files.reduce((sum, f) => sum + f.data.byteLength, 0);
  const allowFallback = totalBytes <= MAX_MAIN_THREAD_FALLBACK_BYTES;

  if (typeof Worker === 'undefined') {
    if (!allowFallback && typeof window !== 'undefined') {
      throw new Error(
        'Background ZIP worker is unavailable. Large archives cannot be created on the main thread.',
      );
    }
    return createZipArchive(files, preserveFolders);
  }

  const id = crypto.randomUUID();
  const transferList: ArrayBuffer[] = [];
  const payloadFiles = files.map((file) => {
    const copy = new Uint8Array(file.data.byteLength);
    copy.set(file.data);
    transferList.push(copy.buffer);
    return { name: file.name, data: copy.buffer, path: file.path };
  });

  try {
    const data = await runInWorkerPool(
      id,
      { id, action: 'zip', files: payloadFiles, preserveFolders },
      transferList,
    );
    if (data.error || !data.zipBuffer) {
      throw new Error(data.error || 'Failed to build ZIP archive.');
    }
    return new Blob([data.zipBuffer], { type: 'application/zip' });
  } catch (error) {
    if (error instanceof WorkerUnavailableError) {
      if (!allowFallback && shouldEnforceWorkerRequirement()) {
        throw new Error(
          'Background ZIP worker failed to initialize. Large archives cannot be created on the main thread.',
        );
      }
      return createZipArchive(files, preserveFolders);
    }
    throw error;
  }
}

export interface ExtractedZipFileResult {
  files: File[];
  rejected: string[];
  skippedUnsupportedCount: number;
  totalCandidateEntries: number;
}

function hydrateExtractedFiles(result: ZipExtractionWorkerResult): ExtractedZipFileResult {
  const files = result.extractedFiles.map((entry) => {
    const file = new File([entry.buffer], entry.name, {
      type: entry.mimeType,
      lastModified: entry.lastModified,
    });
    try {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: entry.relativePath,
        configurable: true,
      });
    } catch {
      // Fallback if defineProperty is restricted
    }
    return file;
  });

  return {
    files,
    rejected: result.rejected,
    skippedUnsupportedCount: result.skippedUnsupportedCount,
    totalCandidateEntries: result.totalCandidateEntries,
  };
}

/**
 * Extracts supported files from a ZIP archive inside the shared Web Worker pool
 * with streaming progress and transferable ArrayBuffers.
 */
export async function extractZipArchiveInWorker(
  archiveFile: File,
  limits: ZipExtractionLimits = {},
  onProgress?: (progress: ZipExtractionProgress) => void,
  signal?: AbortSignal,
): Promise<ExtractedZipFileResult> {
  signal?.throwIfAborted();
  const allowFallback = archiveFile.size <= MAX_MAIN_THREAD_FALLBACK_BYTES;
  const buffer = await archiveFile.arrayBuffer();
  signal?.throwIfAborted();

  const id = crypto.randomUUID();
  try {
    const data = await runInWorkerPool(
      id,
      {
        id,
        action: 'extract-zip',
        buffer,
        archiveName: archiveFile.name,
        limits,
      },
      [buffer],
      signal,
      (msg) => {
        if (msg.zipProgress) {
          onProgress?.(msg.zipProgress);
        }
      },
    );
    if (data.error || !data.zipExtracted) {
      throw new Error(data.error || `Failed to extract ${archiveFile.name}.`);
    }
    return hydrateExtractedFiles(data.zipExtracted);
  } catch (error) {
    if (!(error instanceof WorkerUnavailableError)) {
      throw error;
    }
    if (!allowFallback && shouldEnforceWorkerRequirement()) {
      throw new Error(
        'Background ZIP worker failed to initialize. Large ZIP archives cannot be extracted on the main thread.',
      );
    }
    const extracted = await extractSupportedFilesFromZipBuffer(
      buffer,
      archiveFile.name,
      limits,
      onProgress,
      signal,
    );
    return hydrateExtractedFiles(extracted);
  }
}

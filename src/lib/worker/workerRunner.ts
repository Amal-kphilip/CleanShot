import { stripImageMetadata } from '../engine/stripper';
import { inspectMetadata } from '../engine/inspector';
import { StripOptions, StripResult, ParsedMetadata } from '../engine/types';

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

function stripInWorker(
  id: string,
  buffer: ArrayBuffer,
  filename: string,
  options: StripOptions,
  onProgress?: (progress: number) => void,
): Promise<{ result: StripResult; cleanedMetadata?: ParsedMetadata }> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./stripWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      // Older browsers or restrictive environments use the main-thread fallback.
      stripImageMetadata(new Uint8Array(buffer), filename, options).then(async (result) => {
        let cleanedMetadata: ParsedMetadata | undefined;
        if (!result.error) {
          try { cleanedMetadata = await inspectMetadata(result.cleanedBuffer, filename); } catch { /* best-effort verification */ }
        }
        resolve({ result, cleanedMetadata });
      }, reject);
      return;
    }

    const dispose = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<{ id: string; result?: StripResult; cleanedMetadata?: ParsedMetadata; error?: string }>) => {
      if (event.data.id !== id) return;
      dispose();
      if (event.data.error || !event.data.result) {
        reject(new Error(event.data.error || 'Worker returned no processing result'));
        return;
      }
      onProgress?.(100);
      resolve({ result: event.data.result, cleanedMetadata: event.data.cleanedMetadata });
    };

    worker.onerror = (event) => {
      dispose();
      reject(new Error(event.message || 'Image worker failed'));
    };

    onProgress?.(40);
    try {
      worker.postMessage({ id, action: 'strip', buffer, filename, options }, [buffer]);
    } catch (error) {
      dispose();
      reject(error instanceof Error ? error : new Error('Unable to start image worker'));
    }
  });
}

/** Run metadata inspection in a Web Worker so large EXIF payloads do not block scrolling. */
export async function inspectFileInWorker(file: File, id = crypto.randomUUID()): Promise<ParsedMetadata> {
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./stripWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      inspectMetadata(new Uint8Array(buffer), file.name).then(resolve, reject);
      return;
    }
    const dispose = () => { worker.onmessage = null; worker.onerror = null; worker.terminate(); };
    worker.onmessage = (event: MessageEvent<{ id: string; metadata?: ParsedMetadata; error?: string }>) => {
      if (event.data.id !== id) return;
      dispose();
      if (event.data.metadata) resolve(event.data.metadata);
      else reject(new Error(event.data.error || 'Metadata inspection failed'));
    };
    worker.onerror = (event) => { dispose(); reject(new Error(event.message || 'Metadata inspection worker failed')); };
    try { worker.postMessage({ id, action: 'inspect', buffer, filename: file.name }, [buffer]); }
    catch (error) { dispose(); reject(error instanceof Error ? error : new Error('Unable to start metadata inspection')); }
  });
}

/** Process one file; CPU-heavy metadata stripping is performed off the main thread. */
export async function processFileItem(
  task: ProcessTask,
  onProgress?: (progress: number) => void,
): Promise<ProcessOutput> {
  const arrayBuffer = await task.file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  onProgress?.(15);

  let metadata: ParsedMetadata | undefined = task.metadata;
  if (!metadata) {
    try {
      metadata = await inspectMetadata(bytes, task.file.name);
    } catch {
      // Metadata preview is best-effort; stripping still performs its own format validation.
    }
  }
  onProgress?.(30);

  const { result, cleanedMetadata } = await stripInWorker(task.id, arrayBuffer, task.file.name, task.options, onProgress);
  return { id: task.id, result, metadata, cleanedMetadata, thumbnailUrl: '' };
}

const MAX_MAIN_THREAD_FALLBACK_BYTES = 10 * 1024 * 1024;

function isVideoFilename(filename: string): boolean {
  return /\.(mp4|mov|m4a|webm|mkv)$/i.test(filename);
}

/**
 * Strips metadata from a Blob using the existing stripWorker (zero-copy transferable ArrayBuffer)
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

  const allowMainThreadFallback =
    blob.size <= MAX_MAIN_THREAD_FALLBACK_BYTES && !isVideoFilename(filename);

  if (typeof Worker === 'undefined') {
    if (typeof window !== 'undefined' && !allowMainThreadFallback) {
      throw new Error(
        'Web Worker support is required to clean large video files off the main thread.',
      );
    }
    const result = await stripImageMetadata(new Uint8Array(buffer), filename, options);
    signal?.throwIfAborted();
    return validateResult(result);
  }

  return new Promise<StripResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./stripWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      if (!allowMainThreadFallback) {
        reject(
          new Error(
            'Background metadata worker failed to initialize. Large or video files cannot be cleaned on the main thread.',
          ),
        );
        return;
      }
      stripImageMetadata(new Uint8Array(buffer), filename, options).then((res) => {
        try {
          signal?.throwIfAborted();
          resolve(validateResult(res));
        } catch (err) {
          reject(err);
        }
      }, reject);
      return;
    }

    const id = crypto.randomUUID();
    let settled = false;

    const dispose = () => {
      signal?.removeEventListener('abort', onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      dispose();
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    worker.onmessage = (
      event: MessageEvent<{ id: string; result?: StripResult; error?: string }>,
    ) => {
      if (event.data.id !== id || settled) return;
      settled = true;
      dispose();
      if (event.data.error || !event.data.result) {
        reject(new Error(event.data.error || 'Worker returned no metadata-cleaning result.'));
        return;
      }
      try {
        resolve(validateResult(event.data.result));
      } catch (err) {
        reject(err);
      }
    };

    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      dispose();
      reject(new Error(event.message || 'Metadata worker failed.'));
    };

    try {
      worker.postMessage(
        { id, action: 'strip', buffer, filename, options, skipInspect: true },
        [buffer],
      );
    } catch (error) {
      if (!settled) {
        settled = true;
        dispose();
        reject(error instanceof Error ? error : new Error('Unable to start metadata worker.'));
      }
    }
  });
}

/** Concurrency-limited pool. At most `concurrency` worker jobs exist simultaneously. */
export async function processBatchWithConcurrency(
  tasks: ProcessTask[],
  concurrency: number = 2,
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

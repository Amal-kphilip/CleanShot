import { stripImageMetadata } from '../engine/stripper';
import { inspectMetadata } from '../engine/inspector';
import { StripOptions, StripResult, ParsedMetadata } from '../engine/types';

export interface ProcessTask {
  id: string;
  file: File;
  relativePath?: string;
  options: StripOptions;
}

export interface ProcessOutput {
  id: string;
  result: StripResult;
  metadata?: ParsedMetadata;
  thumbnailUrl: string;
}

/**
 * Generates an in-memory thumbnail URL without modifying the original file
 */
export function createThumbnail(file: File): string {
  try {
    return URL.createObjectURL(file);
  } catch (e) {
    return '';
  }
}

/**
 * Process a single image file with metadata inspection and lossless stripping
 */
export async function processFileItem(
  task: ProcessTask,
  onProgress?: (progress: number) => void
): Promise<ProcessOutput> {
  const arrayBuffer = await task.file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  onProgress?.(30);

  // Inspect metadata for before/after view
  let metadata: ParsedMetadata | undefined;
  try {
    metadata = await inspectMetadata(uint8);
  } catch (e) {
    // Ignore inspection error and proceed to stripping
  }

  onProgress?.(70);

  // Perform lossless stripping
  const result = await stripImageMetadata(uint8, task.file.name, task.options);

  onProgress?.(100);

  const thumbnailUrl = createThumbnail(task.file);

  return {
    id: task.id,
    result,
    metadata,
    thumbnailUrl,
  };
}

/**
 * Concurrency-limited batch processor for running multiple files in parallel
 */
export async function processBatchWithConcurrency(
  tasks: ProcessTask[],
  concurrency: number = 4,
  onFileStart?: (id: string) => void,
  onFileComplete?: (output: ProcessOutput) => void,
  onFileError?: (id: string, error: string) => void
): Promise<ProcessOutput[]> {
  const results: ProcessOutput[] = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];
      if (!task) break;

      onFileStart?.(task.id);

      try {
        const output = await processFileItem(task);
        results.push(output);
        onFileComplete?.(output);
      } catch (err: any) {
        onFileError?.(task.id, err?.message || 'Processing failed');
      }
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(pool);

  return results;
}

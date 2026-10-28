import { stripImageMetadata } from '../engine/stripper';
import { inspectMetadata } from '../engine/inspector';
import { StripOptions } from '../engine/types';

type WorkerRequest =
  | { id: string; action: 'inspect'; buffer: ArrayBuffer; filename?: string }
  | { id: string; action: 'strip'; buffer: ArrayBuffer; filename: string; options: StripOptions };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.action === 'inspect') {
      const metadata = await inspectMetadata(new Uint8Array(message.buffer), message.filename || '');
      workerScope.postMessage({ id: message.id, metadata });
      return;
    }

    const result = await stripImageMetadata(new Uint8Array(message.buffer), message.filename, message.options);
    let cleanedMetadata;
    if (!result.error) {
      try {
        cleanedMetadata = await inspectMetadata(result.cleanedBuffer, message.filename);
      } catch {
        // Cleaning may succeed even if the best-effort post-clean inspection cannot parse the output.
      }
    }
    workerScope.postMessage(
      { id: message.id, result, cleanedMetadata },
      [result.cleanedBuffer.buffer as ArrayBuffer],
    );
  } catch (error) {
    workerScope.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : 'Image processing failed',
    });
  }
};

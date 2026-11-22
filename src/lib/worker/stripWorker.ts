import { zipSync, Zippable } from 'fflate';
import { stripImageMetadata } from '../engine/stripper';
import { inspectMetadata } from '../engine/inspector';
import { sanitizeFilename } from '../engine/magic';
import { StripOptions } from '../engine/types';
import {
  extractSupportedFilesFromZipBuffer,
  ZipExtractionLimits,
} from '../zip/zipExtractor';
import {
  isGifImage,
  processGeminiGifBuffer,
} from '../tools/geminiGifWatermark';

type GeminiAdaptiveMode = 'auto' | 'always' | 'off';
type GeminiTargetMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

type WorkerRequest =
  | { id: string; action: 'inspect'; buffer: ArrayBuffer; filename?: string }
  | {
      id: string;
      action: 'strip';
      buffer: ArrayBuffer;
      filename: string;
      options: StripOptions;
      skipInspect?: boolean;
      includeOriginalInspect?: boolean;
    }
  | {
      id: string;
      action: 'gemini-image';
      buffer: ArrayBuffer;
      sourceMimeType: string;
      outputName: string;
      targetMimeType: GeminiTargetMime;
      adaptiveMode: GeminiAdaptiveMode;
    }
  | {
      id: string;
      action: 'zip';
      files: Array<{ name: string; data: ArrayBuffer; path?: string }>;
      preserveFolders: boolean;
    }
  | {
      id: string;
      action: 'extract-zip';
      buffer: ArrayBuffer;
      archiveName: string;
      limits?: ZipExtractionLimits;
    };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let cachedWatermarkModulePromise: Promise<typeof import('@pilio/gemini-watermark-remover/image-data')> | null = null;
let cachedWatermarkEnginePromise: Promise<unknown> | null = null;

async function getWatermarkEngineAndModule() {
  if (!cachedWatermarkModulePromise) {
    cachedWatermarkModulePromise = import('@pilio/gemini-watermark-remover/image-data');
  }
  const mod = await cachedWatermarkModulePromise;
  if (!cachedWatermarkEnginePromise) {
    cachedWatermarkEnginePromise = mod.createWatermarkEngine().catch((err) => {
      cachedWatermarkEnginePromise = null;
      throw err;
    });
  }
  const engine = await cachedWatermarkEnginePromise;
  return { mod, engine };
}

function buildZipInWorker(
  files: Array<{ name: string; data: ArrayBuffer; path?: string }>,
  preserveFolders: boolean,
): Uint8Array {
  const zipObj: Zippable = {};
  const usedNames = new Set<string>();

  for (const file of files) {
    const requestedPath = preserveFolders && file.path ? file.path : file.name;
    const pathParts = requestedPath
      .replace(/\\/g, '/')
      .split('/')
      .filter((part) => part && part !== '.' && part !== '..');
    const leaf = sanitizeFilename(pathParts.pop() || file.name);
    let zipPath = [...pathParts.map((part) => sanitizeFilename(part)), leaf].join('/');
    if (!zipPath || zipPath.startsWith('/')) zipPath = sanitizeFilename(file.name);

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
    zipObj[zipPath] = [new Uint8Array(file.data), { level: 0 }];
  }

  return zipSync(zipObj);
}

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.action === 'inspect') {
      const metadata = await inspectMetadata(new Uint8Array(message.buffer), message.filename || '');
      workerScope.postMessage({ id: message.id, metadata });
      return;
    }

    if (message.action === 'zip') {
      const zipped = buildZipInWorker(message.files, message.preserveFolders);
      const transferBuffer =
        zipped.byteOffset === 0 && zipped.byteLength === zipped.buffer.byteLength
          ? (zipped.buffer as ArrayBuffer)
          : (zipped.slice().buffer as ArrayBuffer);
      workerScope.postMessage(
        { id: message.id, zipBuffer: transferBuffer },
        [transferBuffer],
      );
      return;
    }

    if (message.action === 'extract-zip') {
      let lastProgressPost = 0;
      const zipExtracted = await extractSupportedFilesFromZipBuffer(
        message.buffer,
        message.archiveName,
        message.limits,
        (progress) => {
          const now = Date.now();
          if (
            progress.processedEntries === progress.totalEntries ||
            now - lastProgressPost >= 80
          ) {
            lastProgressPost = now;
            workerScope.postMessage({
              id: message.id,
              type: 'progress',
              zipProgress: progress,
            });
          }
        },
      );
      const transfers = zipExtracted.extractedFiles.map((entry) => entry.buffer);
      workerScope.postMessage(
        { id: message.id, zipExtracted },
        transfers,
      );
      return;
    }

    if (message.action === 'gemini-image') {
      if (
        isGifImage(message.sourceMimeType, message.outputName) ||
        message.targetMimeType === 'image/gif'
      ) {
        const { engine } = await getWatermarkEngineAndModule();
        let lastProgressPost = 0;
        const gifProcessed = await processGeminiGifBuffer(
          new Uint8Array(message.buffer),
          message.outputName,
          {
            adaptiveMode: message.adaptiveMode,
            engine: engine as Awaited<
              ReturnType<
                typeof import('@pilio/gemini-watermark-remover/image-data')['createWatermarkEngine']
              >
            >,
            onProgress: (gifProgress) => {
              const now = Date.now();
              if (
                gifProgress.currentFrame === gifProgress.totalFrames ||
                now - lastProgressPost >= 80
              ) {
                lastProgressPost = now;
                workerScope.postMessage({
                  id: message.id,
                  type: 'progress',
                  gifProgress,
                });
              }
            },
          },
        );
        const transferBuffer =
          gifProcessed.result.cleanedBuffer.byteOffset === 0 &&
          gifProcessed.result.cleanedBuffer.byteLength ===
            gifProcessed.result.cleanedBuffer.buffer.byteLength
            ? (gifProcessed.result.cleanedBuffer.buffer as ArrayBuffer)
            : (gifProcessed.result.cleanedBuffer.slice().buffer as ArrayBuffer);

        workerScope.postMessage(
          {
            id: message.id,
            result: gifProcessed.result,
            geminiMeta: {
              width: gifProcessed.width,
              height: gifProcessed.height,
              meta: gifProcessed.meta,
              frameCount: gifProcessed.frameCount,
              animated: gifProcessed.animated,
            },
          },
          [transferBuffer],
        );
        return;
      }

      if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
        throw new Error('OffscreenCanvas image processing is unavailable in this worker.');
      }
      const sourceBlob = new Blob([message.buffer], {
        type: message.sourceMimeType || 'image/png',
      });
      const bitmap = await createImageBitmap(sourceBlob);
      const width = bitmap.width;
      const height = bitmap.height;
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        throw new Error('Failed to initialize OffscreenCanvas 2D context.');
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const imageData = ctx.getImageData(0, 0, width, height);
      const { mod, engine } = await getWatermarkEngineAndModule();
      const { imageData: processedData, meta } = await mod.removeWatermarkFromImageData(imageData, {
        engine: engine as Awaited<ReturnType<typeof mod.createWatermarkEngine>>,
        adaptiveMode: message.adaptiveMode,
      });
      const outputImageData =
        processedData instanceof ImageData
          ? processedData
          : new ImageData(
              new Uint8ClampedArray(processedData.data),
              processedData.width,
              processedData.height,
            );
      ctx.putImageData(outputImageData, 0, 0);

      const encodedBlob = await canvas.convertToBlob({
        type: message.targetMimeType,
        quality: message.targetMimeType === 'image/png' ? undefined : 0.95,
      });
      const encodedBytes = new Uint8Array(await encodedBlob.arrayBuffer());
      const result = await stripImageMetadata(encodedBytes, message.outputName);
      if (result.error) {
        throw new Error(result.error);
      }
      const transferBuffer =
        result.cleanedBuffer.byteOffset === 0 &&
        result.cleanedBuffer.byteLength === result.cleanedBuffer.buffer.byteLength
          ? (result.cleanedBuffer.buffer as ArrayBuffer)
          : (result.cleanedBuffer.slice().buffer as ArrayBuffer);

      workerScope.postMessage(
        {
          id: message.id,
          result,
          geminiMeta: { width, height, meta },
        },
        [transferBuffer],
      );
      return;
    }

    const inputBytes = new Uint8Array(message.buffer);
    let metadata;
    if (message.includeOriginalInspect) {
      try {
        metadata = await inspectMetadata(inputBytes, message.filename);
      } catch {
        // Best-effort pre-clean inspection; stripping performs its own validation.
      }
    }

    const result = await stripImageMetadata(inputBytes, message.filename, message.options);
    let cleanedMetadata;
    if (!result.error && !message.skipInspect) {
      try {
        cleanedMetadata = await inspectMetadata(result.cleanedBuffer, message.filename);
      } catch {
        // Cleaning may succeed even if the best-effort post-clean inspection cannot parse the output.
      }
    }
    const transferBuffer =
      result.cleanedBuffer.byteOffset === 0 &&
      result.cleanedBuffer.byteLength === result.cleanedBuffer.buffer.byteLength
        ? (result.cleanedBuffer.buffer as ArrayBuffer)
        : (result.cleanedBuffer.slice().buffer as ArrayBuffer);
    workerScope.postMessage(
      { id: message.id, result, metadata, cleanedMetadata },
      [transferBuffer],
    );
  } catch (error) {
    workerScope.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : 'Image processing failed',
    });
  }
};

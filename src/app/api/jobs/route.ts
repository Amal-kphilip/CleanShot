import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createJob, addFileToJob, deleteJob, getActiveJobCount, getStoredByteCount } from '@/lib/server/jobStore';
import { stripImageMetadata } from '@/lib/engine/stripper';
import { inspectMetadata } from '@/lib/engine/inspector';
import { sanitizeFilename } from '@/lib/engine/magic';
import { StripOptions } from '@/lib/engine/types';

export const dynamic = 'force-dynamic';
const MAX_FILES_PER_BATCH = 40;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const MAX_STORED_BYTES = 180 * 1024 * 1024;
const MAX_ACTIVE_JOBS = 12;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const requestLog = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  try {
    // Best-effort process-local throttle. Configure an edge/platform rate limit too for multi-instance deployments.
    const forwarded = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const recent = (requestLog.get(forwarded) || []).filter((time) => now - time < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_REQUESTS) {
      return NextResponse.json({ error: 'Too many server processing requests. Please wait a few minutes or use Client-Side mode.' }, { status: 429 });
    }
    recent.push(now);
    requestLog.set(forwarded, recent);
    if (requestLog.size > 1000) {
      for (const [key, times] of requestLog.entries()) {
        const valid = times.filter((time) => now - time < RATE_WINDOW_MS);
        if (valid.length) requestLog.set(key, valid); else requestLog.delete(key);
      }
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BATCH_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: 'Server-mode requests are limited to 50 MB per batch.' }, { status: 413 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    const optionsRaw = formData.get('options') as string | null;
    let clientIds: string[] = [];
    const clientIdsRaw = formData.get('clientIds');
    const hasClientIds = typeof clientIdsRaw === 'string';
    if (typeof clientIdsRaw === 'string') {
      try {
        const parsed: unknown = JSON.parse(clientIdsRaw);
        if (Array.isArray(parsed)) clientIds = parsed.filter((id): id is string => typeof id === 'string');
      } catch {
        return NextResponse.json({ error: 'Invalid client file mapping.' }, { status: 400 });
      }
    }
    
    let options: StripOptions = {};
    if (optionsRaw) {
      let parsedOptions: unknown;
      try {
        parsedOptions = JSON.parse(optionsRaw);
      } catch {
        return NextResponse.json({ error: 'Invalid processing options.' }, { status: 400 });
      }
      if (!parsedOptions || typeof parsedOptions !== 'object' || Array.isArray(parsedOptions)) {
        return NextResponse.json({ error: 'Processing options must be an object.' }, { status: 400 });
      }
      const raw = parsedOptions as Record<string, unknown>;
      const booleanKeys: (keyof StripOptions)[] = [
        'keepIccProfile', 'keepOrientation', 'stripAll', 'removeGps',
        'removeCameraInfo', 'removeTimestamps', 'removeAuthorCopyright',
        'removeSoftwareTech', 'removeThumbnails', 'preserveFolderStructure',
      ];
      for (const key of booleanKeys) {
        if (raw[key] !== undefined && typeof raw[key] !== 'boolean') {
          return NextResponse.json({ error: `Invalid option type for ${key}.` }, { status: 400 });
        }
      }
      if (raw.filenameSuffix !== undefined && typeof raw.filenameSuffix !== 'string') {
        return NextResponse.json({ error: 'Filename suffix must be text.' }, { status: 400 });
      }
      options = {
        ...Object.fromEntries(booleanKeys.filter((key) => typeof raw[key] === 'boolean').map((key) => [key, raw[key]])),
        filenameSuffix: typeof raw.filenameSuffix === 'string' ? raw.filenameSuffix.slice(0, 40).replace(/[\/\\\0-\x1f\x7f]/g, '') : undefined,
      } as StripOptions;
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json({ error: `Server mode supports up to ${MAX_FILES_PER_BATCH} files per batch.` }, { status: 400 });
    }
    if (hasClientIds && clientIds.length !== files.length) {
      return NextResponse.json({ error: 'File mapping does not match the uploaded batch.' }, { status: 400 });
    }
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      return NextResponse.json({ error: 'Each server-mode file must be 20 MB or smaller.' }, { status: 413 });
    }
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_BATCH_BYTES) {
      return NextResponse.json({ error: 'Server-mode batches are limited to 50 MB total.' }, { status: 413 });
    }
    if (getActiveJobCount() >= MAX_ACTIVE_JOBS || getStoredByteCount() + totalBytes * 2 > MAX_STORED_BYTES) {
      return NextResponse.json({ error: 'Server processing is temporarily at capacity. Please try later or use Client-Side mode.' }, { status: 503 });
    }

    const job = createJob(options);
    job.totalFiles = files.length;
    job.status = 'processing';

    const processedFilesList = [];

    for (const [fileIndex, file] of files.entries()) {
      const fileId = crypto.randomUUID();
      const clientId = clientIds[fileIndex];
      const safeOriginalName = sanitizeFilename(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Losslessly strip; avoid retaining or computing an unnecessary copy of original metadata.
      const stripResult = await stripImageMetadata(uint8, safeOriginalName, options);

      let cleanedMetadata;
      if (!stripResult.error) {
        try { cleanedMetadata = await inspectMetadata(stripResult.cleanedBuffer, safeOriginalName); } catch { /* post-clean inspection is best-effort */ }
      }

      const storedFile = {
        fileId,
        originalFilename: safeOriginalName,
        cleanedFilename: stripResult.cleanedFilename,
        mimeType: stripResult.mimeType,
        cleanedBuffer: stripResult.cleanedBuffer,
        stripResult,
        createdAt: Date.now(),
      };

      // Do not retain a failed/original buffer as if it were a cleaned result.
      if (!stripResult.error) addFileToJob(job.jobId, storedFile);

      processedFilesList.push({
        fileId: stripResult.error ? undefined : fileId,
        clientId,
        filename: safeOriginalName,
        cleanedFilename: stripResult.cleanedFilename,
        format: stripResult.format,
        originalSize: stripResult.originalSize,
        cleanedSize: stripResult.cleanedSize,
        bytesSaved: stripResult.bytesSaved,
        removedFieldsCount: stripResult.removedFieldsCount,
        pixelIdentical: stripResult.pixelIdentical,
        mimeType: stripResult.mimeType,
        error: stripResult.error,
        cleanedMetadata: cleanedMetadata ? {
          ...cleanedMetadata,
          rawSummary: {},
        } : undefined,
      });
    }

    job.status = 'completed';
    if (job.files.size === 0) deleteJob(job.jobId);

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      totalFiles: job.totalFiles,
      completedFiles: job.completedFiles,
      expiresAt: job.expiresAt,
      files: processedFilesList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Server error processing batch' },
      { status: 500 }
    );
  }
}

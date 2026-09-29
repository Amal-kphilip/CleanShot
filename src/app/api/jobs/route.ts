import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createJob, addFileToJob, StoredJob } from '@/lib/server/jobStore';
import { stripImageMetadata } from '@/lib/engine/stripper';
import { inspectMetadata } from '@/lib/engine/inspector';
import { sanitizeFilename } from '@/lib/engine/magic';
import { StripOptions } from '@/lib/engine/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const optionsRaw = formData.get('options') as string;
    
    let options: StripOptions = {};
    if (optionsRaw) {
      try {
        options = JSON.parse(optionsRaw);
      } catch (e) {
        // Fallback to defaults
      }
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Limit check: 100 files max per request
    if (files.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 files allowed per batch' }, { status: 400 });
    }

    const job = createJob(options);
    job.totalFiles = files.length;
    job.status = 'processing';

    const processedFilesList = [];

    for (const file of files) {
      const fileId = crypto.randomUUID();
      const safeOriginalName = sanitizeFilename(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Inspect metadata
      let metadata;
      try {
        metadata = await inspectMetadata(uint8);
      } catch (e) {}

      // Losslessly strip
      const stripResult = await stripImageMetadata(uint8, safeOriginalName, options);

      const storedFile = {
        fileId,
        originalFilename: safeOriginalName,
        cleanedFilename: stripResult.cleanedFilename,
        mimeType: stripResult.mimeType,
        originalBuffer: uint8,
        cleanedBuffer: stripResult.cleanedBuffer,
        stripResult,
        metadata,
        createdAt: Date.now(),
      };

      addFileToJob(job.jobId, storedFile);

      processedFilesList.push({
        fileId,
        filename: safeOriginalName,
        cleanedFilename: stripResult.cleanedFilename,
        format: stripResult.format,
        originalSize: stripResult.originalSize,
        cleanedSize: stripResult.cleanedSize,
        bytesSaved: stripResult.bytesSaved,
        removedFieldsCount: stripResult.removedFieldsCount,
        pixelIdentical: stripResult.pixelIdentical,
        metadata: metadata ? {
          categories: metadata.categories,
          hasHighRiskFields: metadata.hasHighRiskFields,
          gps: metadata.gps,
        } : undefined,
      });
    }

    job.status = 'completed';

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

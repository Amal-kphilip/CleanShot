import { NextRequest, NextResponse } from 'next/server';
import { getJob, deleteJob } from '@/lib/server/jobStore';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = getJob(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 });
  }

  const filesList = Array.from(job.files.values()).map((f) => ({
    fileId: f.fileId,
    originalFilename: f.originalFilename,
    cleanedFilename: f.cleanedFilename,
    format: f.stripResult.format,
    originalSize: f.stripResult.originalSize,
    cleanedSize: f.stripResult.cleanedSize,
    bytesSaved: f.stripResult.bytesSaved,
    removedFieldsCount: f.stripResult.removedFieldsCount,
    pixelIdentical: f.stripResult.pixelIdentical,
  }));

  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    totalFiles: job.totalFiles,
    completedFiles: job.completedFiles,
    expiresAt: job.expiresAt,
    files: filesList,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deleted = deleteJob(params.id);
  return NextResponse.json({ success: deleted, message: deleted ? 'Job purged' : 'Job not found' });
}

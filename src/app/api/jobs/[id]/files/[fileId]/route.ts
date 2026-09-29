import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/server/jobStore';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const job = getJob(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 });
  }

  const file = job.files.get(params.fileId);
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const bodyBuffer = Buffer.from(file.cleanedBuffer);

  return new NextResponse(bodyBuffer, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.cleanedFilename)}"`,
      'Content-Length': file.cleanedBuffer.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

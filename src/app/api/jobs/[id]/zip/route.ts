import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/server/jobStore';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = getJob(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 });
  }

  const archive = archiver('zip', {
    zlib: { level: 0 }, // STORE (0 compression) for ultra-fast streamed response
  });

  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  for (const file of job.files.values()) {
    archive.append(Buffer.from(file.cleanedBuffer), {
      name: file.cleanedFilename,
    });
  }

  // Finalize archive in background
  archive.finalize();

  // Convert Node.js PassThrough stream to Web ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      passThrough.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      passThrough.on('end', () => {
        controller.close();
      });
      passThrough.on('error', (err) => {
        controller.error(err);
      });
    },
  });

  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="cleanshot_${job.jobId.substring(0, 8)}.zip"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

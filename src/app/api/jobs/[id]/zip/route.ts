import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/server/jobStore';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const job = getJob(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 });
  }

  const requestedIds = new URL(req.url).searchParams.get('fileIds');
  const selectedIds = requestedIds ? new Set(requestedIds.split(',').filter(Boolean)) : null;
  const selectedFiles = Array.from(job.files.values()).filter((file) =>
    (!selectedIds || selectedIds.has(file.fileId)) && !file.stripResult.error
  );
  if (selectedFiles.length === 0) {
    return NextResponse.json({ error: 'No successfully cleaned files are available for download.' }, { status: 422 });
  }

  const archive = archiver('zip', {
    zlib: { level: 0 }, // STORE (0 compression) for ultra-fast streamed response
  });

  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  const usedNames = new Set<string>();
  for (const file of selectedFiles) {
    let name = file.cleanedFilename.replace(/[\\/]+/g, '_').replace(/\.\.(?=\.)/g, '_');
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let counter = 1;
    while (usedNames.has(name)) name = `${base}_${counter++}${ext}`;
    usedNames.add(name);
    archive.append(Buffer.from(file.cleanedBuffer), { name });
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

import { NextRequest, NextResponse } from 'next/server';
import { inspectMetadata } from '@/lib/engine/inspector';

export const dynamic = 'force-dynamic';

const MAX_INSPECT_FILE_BYTES = 20 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_INSPECT_FILE_BYTES + 1024 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 30;
const requestLog = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  try {
    // Best-effort process-local throttling. Enforce a platform/edge rate limit in production too.
    const clientKey = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const recent = (requestLog.get(clientKey) || []).filter((time) => now - time < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_REQUESTS) {
      return NextResponse.json({ error: 'Too many inspection requests. Please wait a few minutes.' }, { status: 429 });
    }
    recent.push(now);
    requestLog.set(clientKey, recent);
    if (requestLog.size > 1000) {
      for (const [key, times] of requestLog.entries()) {
        const valid = times.filter((time) => now - time < RATE_WINDOW_MS);
        if (valid.length) requestLog.set(key, valid); else requestLog.delete(key);
      }
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Metadata inspection uploads are limited to 20 MB.' }, { status: 413 });
    }

    const formData = await req.formData();
    const entry = formData.get('file');
    if (!(entry instanceof File)) {
      return NextResponse.json({ error: 'A valid image file is required.' }, { status: 400 });
    }
    if (entry.size > MAX_INSPECT_FILE_BYTES) {
      return NextResponse.json({ error: 'Metadata inspection files are limited to 20 MB.' }, { status: 413 });
    }

    const metadata = await inspectMetadata(new Uint8Array(await entry.arrayBuffer()), entry.name);
    return NextResponse.json(metadata, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Could not inspect this file. It may be malformed or unsupported.' },
      { status: 422, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

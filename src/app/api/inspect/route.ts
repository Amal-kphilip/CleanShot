import { NextRequest, NextResponse } from 'next/server';
import { inspectMetadata } from '@/lib/engine/inspector';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const metadata = await inspectMetadata(uint8);

    return NextResponse.json(metadata);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to inspect file metadata' },
      { status: 500 }
    );
  }
}

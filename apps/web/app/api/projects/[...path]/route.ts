import { NextRequest } from 'next/server';
import { proxyToWorker } from '@/lib/server-proxy';

export const runtime = 'nodejs';

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const subpath = resolvedParams.path ? resolvedParams.path.join('/') : '';
  return proxyToWorker(req, `/api/projects/${subpath}`);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;

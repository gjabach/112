import { NextRequest } from 'next/server';
import { proxyToWorker } from '@/lib/server-proxy';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return proxyToWorker(req, '/api/projects');
}

export async function POST(req: NextRequest) {
  return proxyToWorker(req, '/api/projects');
}

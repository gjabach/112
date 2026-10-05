import { NextRequest, NextResponse } from 'next/server';
import { getWorkerBaseUrl, isWorkerConfigured } from '@/lib/server-proxy';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const configured = isWorkerConfigured();
  const workerBase = getWorkerBaseUrl();
  let reachable = false;
  let serverTime = Date.now();

  if (configured && workerBase) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${workerBase}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        reachable = true;
        serverTime = Date.now();
      }
    } catch {
      reachable = false;
    }
  }

  return NextResponse.json({
    available: configured && reachable,
    configured,
    reachable,
    mode: configured ? 'proxy' : 'unconfigured',
    chapterLocks: true,
    revisions: true,
    durableSync: true,
    serverTime
  });
}

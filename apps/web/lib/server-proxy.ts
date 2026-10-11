import { NextRequest, NextResponse } from 'next/server';

export function getWorkerBaseUrl(): string | null {
  const url = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!url || !url.trim()) return null;
  return url.trim().replace(/\/+$/, '');
}

export function isWorkerConfigured(): boolean {
  return Boolean(getWorkerBaseUrl());
}

export async function proxyToWorker(req: NextRequest, targetPath: string): Promise<NextResponse> {
  const base = getWorkerBaseUrl();
  if (!base) {
    return NextResponse.json({
      error: 'Dịch vụ máy chủ chưa được cấu hình (API_URL chưa thiết lập)',
      code: 'UNCONFIGURED'
    }, { status: 503 });
  }

  const url = new URL(req.url);
  const targetUrl = `${base}${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}${url.search}`;

  const headers = new Headers();
  const allowedHeaders = [
    'authorization',
    'content-type',
    'x-chapter-lock-token',
    'x-operation-id',
    'if-match',
    'x-request-id',
    'accept',
    'cookie'
  ];

  for (const [key, value] of req.headers.entries()) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  let body: BodyInit | undefined = undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    try {
      body = await req.arrayBuffer();
    } catch {}
  }

  let workerRes: Response | null = null;
  let lastErr: any = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      workerRes = await fetch(targetUrl, {
        cache: 'no-store',
        method: req.method,
        headers,
        body,
        signal: controller.signal,
        redirect: 'manual'
      });
      clearTimeout(timeoutId);

      // If response is successful, or client error (4xx), or final attempt, break
      if (workerRes.status < 500 || attempt === maxAttempts) {
        break;
      }
      // On 502/503/504 from upstream worker, wait briefly and retry
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      lastErr = err;
      if (attempt === maxAttempts) {
        const isTimeout = err?.name === 'AbortError';
        return NextResponse.json({
          error: isTimeout ? 'Yêu cầu máy chủ backend quá thời gian chờ (timeout)' : 'Không thể kết nối máy chủ backend: ' + (err?.message || 'Lỗi mạng'),
          code: isTimeout ? 'TIMEOUT' : 'UNREACHABLE'
        }, { status: isTimeout ? 504 : 502 });
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!workerRes) {
    const isTimeout = lastErr?.name === 'AbortError';
    return NextResponse.json({
      error: isTimeout ? 'Yêu cầu máy chủ backend quá thời gian chờ (timeout)' : 'Không thể kết nối máy chủ backend',
      code: isTimeout ? 'TIMEOUT' : 'UNREACHABLE'
    }, { status: isTimeout ? 504 : 502 });
  }

  const resHeaders = new Headers();
  const copyHeaders = ['content-type', 'cache-control', 'etag', 'set-cookie', 'x-request-id'];
  for (const h of copyHeaders) {
    const v = workerRes.headers.get(h);
    if (v) resHeaders.set(h, v);
  }

  const resBody = await workerRes.arrayBuffer();
  return new NextResponse(resBody, {
    status: workerRes.status,
    statusText: workerRes.statusText,
    headers: resHeaders
  });
}

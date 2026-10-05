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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const workerRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual'
    });
    clearTimeout(timeoutId);

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
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return NextResponse.json({
      error: isTimeout ? 'Yêu cầu máy chủ backend quá thời gian chờ (timeout)' : 'Không thể kết nối máy chủ backend: ' + (err?.message || 'Lỗi mạng'),
      code: isTimeout ? 'TIMEOUT' : 'UNREACHABLE'
    }, { status: isTimeout ? 504 : 502 });
  }
}

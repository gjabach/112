import { NextRequest, NextResponse } from 'next/server';
import { proxyToWorker, isWorkerConfigured } from '@/lib/server-proxy';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (isWorkerConfigured()) {
    return proxyToWorker(req, '/api/sync');
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({
      success: false,
      error: 'Yêu cầu đăng nhập để đồng bộ dữ liệu đám mây',
      code: 'AUTH_REQUIRED'
    }, { status: 401 });
  }

  return NextResponse.json({
    success: false,
    error: 'Dịch vụ đồng bộ đám mây chưa được cấu hình trên máy chủ',
    code: 'UNCONFIGURED'
  }, { status: 503 });
}

export async function POST(req: NextRequest) {
  if (isWorkerConfigured()) {
    return proxyToWorker(req, '/api/sync');
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({
      success: false,
      error: 'Yêu cầu đăng nhập để đồng bộ dữ liệu đám mây',
      code: 'AUTH_REQUIRED'
    }, { status: 401 });
  }

  return NextResponse.json({
    success: false,
    error: 'Dịch vụ đồng bộ đám mây chưa được cấu hình trên máy chủ',
    code: 'UNCONFIGURED'
  }, { status: 503 });
}

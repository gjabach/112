import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({ success: true, settings: body });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi lưu settings' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true });
}

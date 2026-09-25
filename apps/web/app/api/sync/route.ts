import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// We use a free, public key-value store bucket on kvdb.io to bypass Vercel's ephemeral filesystem
// This ensures cross-device sync works seamlessly without requiring the user to set up a database.
const KVDB_BUCKET = 'GqLhqEZUoDJhURKzLQaYaH';
const KVDB_URL = `https://kvdb.io/${KVDB_BUCKET}`;

function sanitizeKey(rawKey: string): string {
  const cleaned = (rawKey || 'default_user').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return cleaned.slice(0, 64) || 'default_user';
}

// GET /api/sync?key=<syncKey>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawKey = searchParams.get('key') || searchParams.get('syncKey') || 'default_user';
    const key = sanitizeKey(rawKey);

    const response = await fetch(`${KVDB_URL}/${key}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (response.ok) {
      const parsed = await response.json();
      return NextResponse.json({
        success: true,
        key,
        lastModified: parsed.lastModified || Date.now(),
        data: parsed.data || parsed,
        source: 'cloud'
      });
    }

    if (response.status === 404) {
      return NextResponse.json({
        success: true,
        key,
        lastModified: 0,
        data: null,
        message: 'Chưa có bản đồng bộ nào cho mã này'
      });
    }

    throw new Error(`Lỗi tải dữ liệu từ Cloud (Status: ${response.status})`);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi mạng khi tải dữ liệu đồng bộ'
    }, { status: 500 });
  }
}

// POST /api/sync
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawKey = body.key || body.syncKey || 'default_user';
    const key = sanitizeKey(rawKey);
    const data = body.data;

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ success: false, error: 'Dữ liệu đồng bộ không hợp lệ' }, { status: 400 });
    }

    const lastModified = body.lastModified || Date.now();
    const payload = {
      key,
      lastModified,
      syncedAt: Date.now(),
      data
    };

    const response = await fetch(`${KVDB_URL}/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Lỗi lưu dữ liệu lên Cloud (Status: ${response.status})`);
    }

    const projectsCount = Array.isArray(data.projects) ? data.projects.length : 0;
    const chaptersCount = Array.isArray(data.chapters) ? data.chapters.length : 0;
    const charactersCount = Array.isArray(data.characters) ? data.characters.length : 0;

    return NextResponse.json({
      success: true,
      key,
      lastModified,
      syncedAt: payload.syncedAt,
      stats: {
        projects: projectsCount,
        chapters: chaptersCount,
        characters: charactersCount
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi mạng khi lưu dữ liệu đồng bộ'
    }, { status: 500 });
  }
}


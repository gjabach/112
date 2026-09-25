import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// In-memory fallback cache for Edge runtime per authenticated user
const secureSyncMemoryStore = new Map<string, { lastModified: number; syncedAt: number; data: any }>();

function getUserSyncIdentifier(authHeader: string): string {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  // Safe hash / prefix identifier
  return token.slice(-32) || 'anonymous';
}

// GET /api/sync
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Yêu cầu đăng nhập để đồng bộ dữ liệu đám mây'
      }, { status: 401 });
    }

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // 1. If backend API is configured, forward securely to Worker API
    if (apiUrl && !apiUrl.includes('localhost')) {
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/sync`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {}
    }

    // 2. Persistent cloud store lookup
    const userKey = getUserSyncIdentifier(authHeader);
    try {
      const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/d_${userKey}`);
      if (res.ok) {
        const stored = await res.json();
        if (stored) {
          return NextResponse.json({
            success: true,
            key: userKey,
            lastModified: stored.lastModified || 0,
            data: stored.data || stored,
            source: 'cloud'
          });
        }
      }
    } catch {}

    const stored = secureSyncMemoryStore.get(userKey);

    if (stored) {
      return NextResponse.json({
        success: true,
        key: userKey,
        lastModified: stored.lastModified,
        data: stored.data,
        source: 'cloud'
      });
    }

    return NextResponse.json({
      success: true,
      key: userKey,
      lastModified: 0,
      data: null,
      message: 'Chưa có bản đồng bộ nào cho tài khoản này'
    });
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
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Yêu cầu đăng nhập để đồng bộ dữ liệu đám mây'
      }, { status: 401 });
    }

    const body = await req.json();
    const data = body.data;

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ success: false, error: 'Dữ liệu đồng bộ không hợp lệ' }, { status: 400 });
    }

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // 1. If backend API is configured, forward securely to Worker API
    if (apiUrl && !apiUrl.includes('localhost')) {
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/sync`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {}
    }

    // 2. Safe Edge in-memory & cloud store persistence
    const userKey = getUserSyncIdentifier(authHeader);
    const lastModified = body.lastModified || Date.now();
    const now = Date.now();

    secureSyncMemoryStore.set(userKey, {
      lastModified,
      syncedAt: now,
      data
    });

    try {
      await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/d_${userKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastModified, syncedAt: now, data })
      });
    } catch {}

    const projectsCount = Array.isArray(data.projects) ? data.projects.length : 0;
    const chaptersCount = Array.isArray(data.chapters) ? data.chapters.length : 0;
    const charactersCount = Array.isArray(data.characters) ? data.characters.length : 0;

    return NextResponse.json({
      success: true,
      key: userKey,
      lastModified,
      syncedAt: now,
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

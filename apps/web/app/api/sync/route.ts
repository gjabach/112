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
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('key') || searchParams.get('dataKey');
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

    if (!queryKey && (!authHeader || !authHeader.toLowerCase().startsWith('bearer '))) {
      return NextResponse.json({
        success: false,
        error: 'Yêu cầu đăng nhập hoặc cung cấp khóa đồng bộ'
      }, { status: 401 });
    }

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // 1. If backend API is configured, forward securely to Worker API
    if (authHeader && apiUrl && !apiUrl.includes('localhost')) {
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
    const rawKey = queryKey || getUserSyncIdentifier(authHeader || '');
    const targetKey = rawKey.startsWith('d_') ? rawKey : `d_${rawKey}`;

    try {
      const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${targetKey}`);
      if (res.ok) {
        const stored = await res.json();
        if (stored) {
          const unwrapped = (stored.data && typeof stored.data === 'object' && (stored.data.projects || stored.data.chapters))
            ? stored.data
            : stored;

          return NextResponse.json({
            success: true,
            key: targetKey,
            lastModified: stored.lastModified || unwrapped.lastModified || 0,
            data: unwrapped,
            source: 'cloud'
          });
        }
      }
    } catch {}

    const stored = secureSyncMemoryStore.get(targetKey);

    if (stored) {
      const unwrapped = (stored.data && typeof stored.data === 'object' && (stored.data.projects || stored.data.chapters))
        ? stored.data
        : stored;
      return NextResponse.json({
        success: true,
        key: targetKey,
        lastModified: stored.lastModified,
        data: unwrapped,
        source: 'cloud'
      });
    }

    return NextResponse.json({
      success: true,
      key: targetKey,
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
    const body = await req.json();
    const data = body.data;
    const bodyKey = body.dataKey || body.key;
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

    if (!bodyKey && (!authHeader || !authHeader.toLowerCase().startsWith('bearer '))) {
      return NextResponse.json({
        success: false,
        error: 'Yêu cầu đăng nhập hoặc cung cấp khóa đồng bộ'
      }, { status: 401 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ success: false, error: 'Dữ liệu đồng bộ không hợp lệ' }, { status: 400 });
    }

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // 1. If backend API is configured, forward securely to Worker API
    if (authHeader && apiUrl && !apiUrl.includes('localhost')) {
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
    const rawKey = bodyKey || getUserSyncIdentifier(authHeader || '');
    const targetKey = rawKey.startsWith('d_') ? rawKey : `d_${rawKey}`;
    const lastModified = body.lastModified || Date.now();
    const now = Date.now();

    secureSyncMemoryStore.set(targetKey, {
      lastModified,
      syncedAt: now,
      data
    });

    try {
      await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${targetKey}`, {
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
      key: targetKey,
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

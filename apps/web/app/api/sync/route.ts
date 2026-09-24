import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';

// In-memory cache for fast retrieval across requests in the same process
const syncMemoryCache = new Map<string, { lastModified: number; data: any; updatedAt: number }>();

function getStorageDir(): string {
  try {
    const primaryDir = path.join(process.cwd(), '.novelist_storage', 'sync');
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
    return primaryDir;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), 'novelist_sync');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

function sanitizeKey(rawKey: string): string {
  const cleaned = (rawKey || 'default_user').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return cleaned.slice(0, 64) || 'default_user';
}

function getFilePath(key: string): string {
  const dir = getStorageDir();
  return path.join(dir, `${key}.json`);
}

// GET /api/sync?key=<syncKey>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawKey = searchParams.get('key') || searchParams.get('syncKey') || 'default_user';
    const key = sanitizeKey(rawKey);

    // 1. Check in-memory cache first
    const cached = syncMemoryCache.get(key);
    if (cached) {
      return NextResponse.json({
        success: true,
        key,
        lastModified: cached.lastModified,
        data: cached.data,
        source: 'memory'
      });
    }

    // 2. Check disk storage
    const filePath = getFilePath(key);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      syncMemoryCache.set(key, {
        lastModified: parsed.lastModified || Date.now(),
        data: parsed.data || parsed,
        updatedAt: Date.now()
      });
      return NextResponse.json({
        success: true,
        key,
        lastModified: parsed.lastModified || Date.now(),
        data: parsed.data || parsed,
        source: 'disk'
      });
    }

    return NextResponse.json({
      success: true,
      key,
      lastModified: 0,
      data: null,
      message: 'Chưa có bản đồng bộ nào cho mã này'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi khi tải dữ liệu đồng bộ'
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

    // 1. Save to in-memory cache
    syncMemoryCache.set(key, {
      lastModified,
      data,
      updatedAt: Date.now()
    });

    // 2. Save to disk storage
    try {
      const filePath = getFilePath(key);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (diskErr) {
      console.warn('Failed to write sync file to disk, relying on memory cache:', diskErr);
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
      error: error.message || 'Lỗi khi lưu dữ liệu đồng bộ'
    }, { status: 500 });
  }
}

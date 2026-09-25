import { Hono } from 'hono';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { nowTimestamp } from '../lib/auth';

type Variables = {
  db: any;
  user: AuthUser;
};

const sync = new Hono<{ Bindings: Env; Variables: Variables }>();

// All sync operations require valid JWT authentication
sync.use('*', authMiddleware);

// GET /api/sync
sync.get('/', async (c) => {
  const user = c.get('user');
  const kv = c.env.KV;

  if (kv) {
    const raw = await kv.get(`sync:${user.userId}`, 'json');
    if (raw) {
      return c.json({
        success: true,
        userId: user.userId,
        lastModified: (raw as any).lastModified || 0,
        data: (raw as any).data || raw,
        source: 'cloud'
      });
    }
  }

  return c.json({
    success: true,
    userId: user.userId,
    lastModified: 0,
    data: null,
    message: 'Chưa có bản đồng bộ nào cho tài khoản này'
  });
});

// POST /api/sync
sync.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const data = body.data;

  if (!data || typeof data !== 'object') {
    return c.json({ success: false, error: 'Dữ liệu đồng bộ không hợp lệ' }, 400);
  }

  const lastModified = body.lastModified || nowTimestamp();
  const payload = {
    userId: user.userId,
    lastModified,
    syncedAt: nowTimestamp(),
    data
  };

  const kv = c.env.KV;
  if (kv) {
    await kv.put(`sync:${user.userId}`, JSON.stringify(payload));
  }

  const projectsCount = Array.isArray(data.projects) ? data.projects.length : 0;
  const chaptersCount = Array.isArray(data.chapters) ? data.chapters.length : 0;
  const charactersCount = Array.isArray(data.characters) ? data.characters.length : 0;

  return c.json({
    success: true,
    userId: user.userId,
    lastModified,
    syncedAt: payload.syncedAt,
    stats: {
      projects: projectsCount,
      chapters: chaptersCount,
      characters: charactersCount
    }
  });
});

export default sync;

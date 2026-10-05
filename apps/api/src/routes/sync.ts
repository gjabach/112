import { Hono } from 'hono';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { nowTimestamp } from '../lib/auth';

type Variables = {
  db: any;
  user: AuthUser;
};

const sync = new Hono<{ Bindings: Env; Variables: Variables }>();

function unwrapWorkspace(raw: any): any {
  let current = raw;
  for (let i = 0; i < 4 && current?.data && typeof current.data === 'object'; i++) current = current.data;
  return current && typeof current === 'object' ? current : {};
}

function mergeList(local: any[] = [], incoming: any[] = []) {
  const map = new Map<string, any>();
  for (const item of local) if (item?.id) map.set(item.id, { ...item });
  for (const item of incoming) {
    if (!item?.id) continue;
    const existing = map.get(item.id);
    if (!existing || Number(item.updatedAt || item.createdAt || 0) >= Number(existing.updatedAt || existing.createdAt || 0)) {
      map.set(item.id, { ...existing, ...item });
    }
  }
  return Array.from(map.values());
}

function mergeSyncSnapshots(existingRaw: any, incomingRaw: any) {
  const existing = unwrapWorkspace(existingRaw);
  const incoming = unwrapWorkspace(incomingRaw);
  const chapterMap = new Map<string, any>();
  for (const chapter of Array.isArray(existing.chapters) ? existing.chapters : []) {
    if (chapter?.id) chapterMap.set(chapter.id, { ...chapter });
  }
  for (const chapter of Array.isArray(incoming.chapters) ? incoming.chapters : []) {
    if (!chapter?.id) continue;
    const current = chapterMap.get(chapter.id);
    if (!current) {
      chapterMap.set(chapter.id, { ...chapter });
      continue;
    }
    const currentUpdated = Number(current.updatedAt || current.createdAt || 0);
    const incomingUpdated = Number(chapter.updatedAt || chapter.createdAt || 0);
    const currentContentUpdated = Number(current.contentUpdatedAt || currentUpdated);
    const incomingContentUpdated = Number(chapter.contentUpdatedAt || incomingUpdated);
    const currentTitleUpdated = Number(current.titleUpdatedAt || currentUpdated);
    const incomingTitleUpdated = Number(chapter.titleUpdatedAt || incomingUpdated);
    const metadataSource = incomingUpdated >= currentUpdated ? chapter : current;
    chapterMap.set(chapter.id, {
      ...current,
      ...chapter,
      ...metadataSource,
      content: incomingContentUpdated > currentContentUpdated ? chapter.content : current.content,
      title: incomingTitleUpdated > currentTitleUpdated ? chapter.title : current.title,
      contentUpdatedAt: Math.max(currentContentUpdated, incomingContentUpdated),
      titleUpdatedAt: Math.max(currentTitleUpdated, incomingTitleUpdated),
      updatedAt: Math.max(currentUpdated, incomingUpdated)
    });
  }
  const mergedTombstones = { ...(existing.tombstones || {}), ...(incoming.tombstones || {}) };
  for (const id of Object.keys(mergedTombstones)) {
    mergedTombstones[id] = Math.max(Number(existing.tombstones?.[id] || 0), Number(incoming.tombstones?.[id] || 0));
    const chapter = chapterMap.get(id);
    if (chapter && mergedTombstones[id] >= Number(chapter.updatedAt || 0)) chapterMap.delete(id);
  }
  const now = nowTimestamp();
  return {
    ...existing,
    ...incoming,
    version: 2,
    projects: mergeList(existing.projects, incoming.projects),
    chapters: Array.from(chapterMap.values()),
    characters: mergeList(existing.characters, incoming.characters),
    entities: mergeList(existing.entities || existing.worldbuilding, incoming.entities || incoming.worldbuilding),
    timeline: mergeList(existing.timeline || existing.timelineEvents, incoming.timeline || incoming.timelineEvents),
    outline: mergeList(existing.outline || existing.outlines, incoming.outline || incoming.outlines),
    tombstones: mergedTombstones,
    lastModified: Math.max(Number(existing.lastModified || 0), Number(incoming.lastModified || 0), now)
  };
}

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

  const kv = c.env.KV;
  const existingPayload = kv ? await kv.get(`sync:${user.userId}`, 'json') : null;
  const mergedData = mergeSyncSnapshots((existingPayload as any)?.data || existingPayload, data);
  const lastModified = mergedData.lastModified || body.lastModified || nowTimestamp();
  const payload = {
    userId: user.userId,
    lastModified,
    syncedAt: nowTimestamp(),
    data: mergedData
  };

  if (kv) {
    await kv.put(`sync:${user.userId}`, JSON.stringify(payload));
  }

  const projectsCount = Array.isArray(mergedData.projects) ? mergedData.projects.length : 0;
  const chaptersCount = Array.isArray(mergedData.chapters) ? mergedData.chapters.length : 0;
  const charactersCount = Array.isArray(mergedData.characters) ? mergedData.characters.length : 0;

  return c.json({
    success: true,
    userId: user.userId,
    lastModified,
    syncedAt: payload.syncedAt,
    data: mergedData,
    stats: {
      projects: projectsCount,
      chapters: chaptersCount,
      characters: charactersCount
    }
  });
});

export default sync;

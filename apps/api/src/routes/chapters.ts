import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp } from '../lib/auth';
import { createChapterSchema, updateChapterSchema } from '@novelist/shared';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { countWords } from '../utils/validation';
import { deleteChapterAtomic, handleRecoveryCreation } from '../services/lifecycle';

type Variables = { db: any; user: AuthUser };
const chapters = new Hono<{ Bindings: Env; Variables: Variables }>();

export const CHAPTER_LOCK_TTL_MS = 60_000;

export type ChapterEditLock = {
  chapterId: string;
  userId: string;
  sessionId: string;
  deviceId: string;
  deviceLabel: string;
  lockToken: string;
  lockVersion: string;
  acquiredAt: number;
  heartbeatAt: number;
  expiresAt: number;
};

export const publicLock = (lock: ChapterEditLock) => ({
  version: lock.lockVersion,
  deviceLabel: lock.deviceLabel,
  acquiredAt: lock.acquiredAt,
  heartbeatAt: lock.heartbeatAt,
  expiresAt: lock.expiresAt
});

export async function readActiveLock(c: any, chapterId: string): Promise<ChapterEditLock | null> {
  const now = nowTimestamp();
  const row = await c.env.DB.prepare(`
    SELECT chapter_id AS chapterId, user_id AS userId, session_id AS sessionId,
           device_id AS deviceId, device_label AS deviceLabel, lock_token AS lockToken,
           lock_version AS lockVersion, acquired_at AS acquiredAt,
           heartbeat_at AS heartbeatAt, expires_at AS expiresAt
    FROM chapter_edit_locks
    WHERE chapter_id = ? AND expires_at > ?
  `).bind(chapterId, now).first();
  return (row as ChapterEditLock | null) || null;
}

async function getOwnedChapter(c: any, chapterId: string) {
  const db = c.get('db');
  const user = c.get('user');
  const rows = await db.select().from(schema.chapters).where(eq(schema.chapters.id, chapterId)).limit(1);
  if (rows.length === 0) return null;
  const chapter = rows[0];
  const projects = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  return projects.length > 0 ? chapter : null;
}

async function rejectIfLockedByAnother(c: any, chapterId: string) {
  const active = await readActiveLock(c, chapterId);
  if (!active) return null;
  const suppliedToken = c.req.header('X-Chapter-Lock-Token') || '';
  if (suppliedToken && suppliedToken === active.lockToken) return null;
  return c.json({ error: 'Chương đang được chỉnh sửa trên thiết bị khác', lock: publicLock(active) }, 423);
}

async function rejectIfAnyChangedChapterIsLocked(c: any, chapterIds: string[]) {
  for (const chapterId of [...new Set(chapterIds)]) {
    const response = await rejectIfLockedByAnother(c, chapterId);
    if (response) return response;
  }
  return null;
}

chapters.use('*', authMiddleware);

// GET /api/projects/:projectId/chapters
chapters.get('/projects/:projectId/chapters', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  // Verify ownership
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const result = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, projectId)).orderBy(asc(schema.chapters.orderIndex));
  const enriched = result.map((ch: any) => ({
    ...ch,
    charactersPresent: ch.charactersPresent ? JSON.parse(ch.charactersPresent) : []
  }));

  return c.json({ chapters: enriched });
});

// POST /api/projects/:projectId/chapters
chapters.post('/projects/:projectId/chapters', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const existingChapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, projectId));
  if (existingChapters.length >= 100) {
    return c.json({ error: 'Tài liệu đã đạt giới hạn tối đa 100 thẻ' }, 400);
  }

  const parsed = createChapterSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  if (parsed.data.parentId) {
    const parentChap = existingChapters.find((ch: any) => ch.id === parsed.data.parentId);
    if (!parentChap) {
      return c.json({ error: 'Thẻ cha không tồn tại' }, 400);
    }
    let parentDepth = 0;
    let curr: any = parentChap;
    const visited = new Set<string>();
    while (curr?.parentId && !visited.has(curr.id)) {
      visited.add(curr.id);
      parentDepth++;
      curr = existingChapters.find((ch: any) => ch.id === curr.parentId);
    }
    if (parentDepth >= 2) {
      return c.json({ error: 'Google Docs giới hạn phân cấp tối đa 3 cấp thẻ' }, 400);
    }
  }

  const id = generateId();
  const now = nowTimestamp();
  const wordCount = parsed.data.content ? countWords(parsed.data.content) : 0;

  const newChapter = {
    id,
    projectId,
    title: parsed.data.title,
    content: parsed.data.content || '',
    contentFormat: parsed.data.contentFormat || 'tiptap-json',
    summary: parsed.data.summary || null,
    wordCount,
    orderIndex: parsed.data.orderIndex,
    status: parsed.data.status || 'outline',
    parentId: parsed.data.parentId || null,
    notes: parsed.data.notes || null,
    pov: parsed.data.pov || null,
    location: parsed.data.location || null,
    charactersPresent: JSON.stringify(parsed.data.charactersPresent || []),
    emoji: parsed.data.emoji || null,
    createdAt: now,
    updatedAt: now,
    contentUpdatedAt: now,
    titleUpdatedAt: now
  };
  await db.insert(schema.chapters).values(newChapter);

  // Save revision
  await db.insert(schema.revisions).values({
    id: generateId(),
    entityType: 'chapter',
    entityId: id,
    content: parsed.data.content || '',
    wordCount,
    createdBy: user.userId,
    createdAt: now,
    label: 'Initial version'
  });

  return c.json({ id, chapter: { ...newChapter, charactersPresent: parsed.data.charactersPresent || [] } }, 201);
});

// POST /api/chapters/:id/lock - atomically acquire or explicitly take over an edit lock
chapters.post('/chapters/:id/lock', async (c) => {
  const user = c.get('user');
  const chapterId = c.req.param('id');
  const chapter = await getOwnedChapter(c, chapterId);
  if (!chapter) return c.json({ error: 'Chapter not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const sessionId = String(body.sessionId || '').slice(0, 160);
  const deviceId = String(body.deviceId || '').slice(0, 160);
  const deviceLabel = String(body.deviceLabel || 'Thiết bị khác').slice(0, 120);
  const force = body.force === true;
  const expectedLockVersion = String(body.expectedLockVersion || '');
  if (!sessionId || !deviceId) return c.json({ error: 'Thiếu thông tin phiên chỉnh sửa' }, 400);

  const now = nowTimestamp();
  const expiresAt = now + CHAPTER_LOCK_TTL_MS;
  const lockToken = crypto.randomUUID();
  const lockVersion = crypto.randomUUID();

  await c.env.DB.prepare(`
    INSERT INTO chapter_edit_locks (
      chapter_id, user_id, session_id, device_id, device_label,
      lock_token, lock_version, acquired_at, heartbeat_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chapter_id) DO UPDATE SET
      user_id = excluded.user_id,
      session_id = excluded.session_id,
      device_id = excluded.device_id,
      device_label = excluded.device_label,
      lock_token = excluded.lock_token,
      lock_version = excluded.lock_version,
      acquired_at = excluded.acquired_at,
      heartbeat_at = excluded.heartbeat_at,
      expires_at = excluded.expires_at
    WHERE chapter_edit_locks.expires_at <= ?
       OR chapter_edit_locks.session_id = ?
       OR (? = 1 AND chapter_edit_locks.lock_version = ?)
  `).bind(
    chapterId, user.userId, sessionId, deviceId, deviceLabel,
    lockToken, lockVersion, now, now, expiresAt,
    now, sessionId, force ? 1 : 0, expectedLockVersion
  ).run();

  const current = await readActiveLock(c, chapterId);
  if (!current || current.lockToken !== lockToken) {
    return c.json({ error: 'Chương đang được chỉnh sửa trên thiết bị khác', lock: current ? publicLock(current) : null }, 423);
  }

  return c.json({
    success: true,
    lock: { ...publicLock(current), token: current.lockToken },
    chapterVersion: {
      updatedAt: Number(chapter.updatedAt || 0),
      contentUpdatedAt: Number(chapter.contentUpdatedAt || chapter.updatedAt || 0),
      titleUpdatedAt: Number(chapter.titleUpdatedAt || chapter.updatedAt || 0)
    }
  });
});

// PATCH /api/chapters/:id/lock - heartbeat
chapters.patch('/chapters/:id/lock', async (c) => {
  const user = c.get('user');
  const chapterId = c.req.param('id');
  if (!await getOwnedChapter(c, chapterId)) return c.json({ error: 'Chapter not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const token = String(body.lockToken || c.req.header('X-Chapter-Lock-Token') || '');
  const now = nowTimestamp();
  const expiresAt = now + CHAPTER_LOCK_TTL_MS;
  const result = await c.env.DB.prepare(`
    UPDATE chapter_edit_locks
    SET heartbeat_at = ?, expires_at = ?
    WHERE chapter_id = ? AND user_id = ? AND lock_token = ? AND expires_at > ?
  `).bind(now, expiresAt, chapterId, user.userId, token, now).run();
  if (!result.meta.changes) {
    const current = await readActiveLock(c, chapterId);
    return c.json({ error: 'Quyền chỉnh sửa đã hết hạn hoặc được chuyển sang thiết bị khác', lock: current ? publicLock(current) : null }, 423);
  }
  return c.json({ success: true, expiresAt });
});

// DELETE /api/chapters/:id/lock - best-effort release
chapters.delete('/chapters/:id/lock', async (c) => {
  const user = c.get('user');
  const chapterId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const token = String(body.lockToken || c.req.header('X-Chapter-Lock-Token') || '');
  await c.env.DB.prepare('DELETE FROM chapter_edit_locks WHERE chapter_id = ? AND user_id = ? AND lock_token = ?')
    .bind(chapterId, user.userId, token).run();
  return c.json({ success: true });
});

// POST /api/chapters/:id/recoveries - idempotently preserve an offline/conflicting draft
chapters.post('/chapters/:id/recoveries', async (c) => {
  const sourceId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const result = await handleRecoveryCreation(c, sourceId, body);
  return c.json(result.data, result.status as any);
});

// POST /api/projects/:projectId/chapters/reorder - Contiguous reorder by array of chapterIds
chapters.post('/projects/:projectId/chapters/reorder', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const chapterIds: string[] = body.chapterIds || [];

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const currentChapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, projectId));
  const currentOrder = new Map(currentChapters.map((chapter: any) => [chapter.id, Number(chapter.orderIndex || 0)]));
  const changedIds = chapterIds.filter((chapterId, index) => currentOrder.get(chapterId) !== index);
  const lockedResponse = await rejectIfAnyChangedChapterIsLocked(c, changedIds);
  if (lockedResponse) return lockedResponse;

  const now = nowTimestamp();
  for (let i = 0; i < chapterIds.length; i++) {
    await db.update(schema.chapters).set({ orderIndex: i, updatedAt: now }).where(and(eq(schema.chapters.id, chapterIds[i]), eq(schema.chapters.projectId, projectId)));
  }

  return c.json({ success: true });
});

// GET /api/chapters/:id
const getChapterHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const result = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (result.length === 0) {
    const tomb = await db.select().from(schema.entityTombstones)
      .where(and(
        eq(schema.entityTombstones.userId, user.userId),
        eq(schema.entityTombstones.entityType, 'chapter'),
        eq(schema.entityTombstones.entityId, id)
      )).limit(1);
    if (tomb.length > 0) {
      return c.json({ error: 'Chương đã bị xóa', code: 'CHAPTER_DELETED', deletedAt: Number(tomb[0].deletedAt) }, 410);
    }
    return c.json({ error: 'Chapter not found' }, 404);
  }

  const chapter = result[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const activeLock = await readActiveLock(c, id);
  return c.json({
    chapter: {
      ...chapter,
      charactersPresent: chapter.charactersPresent ? JSON.parse(chapter.charactersPresent) : []
    },
    activeLock: activeLock ? publicLock(activeLock) : null
  });
};
chapters.get('/chapters/:id', getChapterHandler);
chapters.get('/:id', getChapterHandler);

// PATCH /api/chapters/:id
const patchChapterHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateChapterSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const suppliedToken = String(c.req.header('X-Chapter-Lock-Token') || body.lockToken || '');
  const lockedResponse = await rejectIfLockedByAnother(c, id);
  if (lockedResponse) return lockedResponse;

  const currentContentUpdatedAt = Number(chapter.contentUpdatedAt || chapter.updatedAt || 0);
  const currentTitleUpdatedAt = Number(chapter.titleUpdatedAt || chapter.updatedAt || 0);
  const contentChanged = parsed.data.content !== undefined && parsed.data.content !== (chapter.content || '');
  const titleChanged = parsed.data.title !== undefined && parsed.data.title !== chapter.title;
  const requireLock = contentChanged || titleChanged;

  if (requireLock) {
    const activeLock = await readActiveLock(c, id);
    if (!activeLock || activeLock.lockToken !== suppliedToken) {
      return c.json({
        error: 'Yêu cầu quyền chỉnh sửa hợp lệ trước khi cập nhật nội dung',
        lock: activeLock ? publicLock(activeLock) : null
      }, 423);
    }
  }

  if (contentChanged && parsed.data.baseContentUpdatedAt !== undefined && parsed.data.baseContentUpdatedAt !== currentContentUpdatedAt) {
    return c.json({
      error: 'Nội dung trên máy chủ đã thay đổi',
      conflict: { updatedAt: chapter.updatedAt, contentUpdatedAt: currentContentUpdatedAt, titleUpdatedAt: currentTitleUpdatedAt }
    }, 409);
  }
  if (titleChanged && parsed.data.baseTitleUpdatedAt !== undefined && parsed.data.baseTitleUpdatedAt !== currentTitleUpdatedAt) {
    return c.json({
      error: 'Tiêu đề trên máy chủ đã thay đổi',
      conflict: { updatedAt: chapter.updatedAt, contentUpdatedAt: currentContentUpdatedAt, titleUpdatedAt: currentTitleUpdatedAt }
    }, 409);
  }

  const now = nowTimestamp();
  const mutationTime = Math.max(now, Number(chapter.updatedAt || 0) + 1);
  const newContentUpdatedAt = contentChanged ? mutationTime : currentContentUpdatedAt;
  const newTitleUpdatedAt = titleChanged ? mutationTime : currentTitleUpdatedAt;
  const newContent = parsed.data.content !== undefined ? parsed.data.content : chapter.content;
  const newTitle = parsed.data.title !== undefined ? parsed.data.title : chapter.title;
  const newWordCount = parsed.data.content !== undefined ? countWords(parsed.data.content) : chapter.wordCount;
  const newFormat = parsed.data.contentFormat !== undefined ? parsed.data.contentFormat : chapter.contentFormat;
  const newSummary = parsed.data.summary !== undefined ? parsed.data.summary : chapter.summary;
  const newStatus = parsed.data.status !== undefined ? parsed.data.status : chapter.status;
  const newOrderIndex = parsed.data.orderIndex !== undefined ? parsed.data.orderIndex : chapter.orderIndex;
  const newNotes = parsed.data.notes !== undefined ? parsed.data.notes : chapter.notes;
  const newPov = parsed.data.pov !== undefined ? parsed.data.pov : chapter.pov;
  const newLocation = parsed.data.location !== undefined ? parsed.data.location : chapter.location;
  const newCharacters = parsed.data.charactersPresent !== undefined ? JSON.stringify(parsed.data.charactersPresent) : (chapter.charactersPresent || '[]');
  const newEmoji = parsed.data.emoji !== undefined ? parsed.data.emoji : chapter.emoji;

  let newParentId = chapter.parentId;
  if (parsed.data.parentId !== undefined) {
    newParentId = parsed.data.parentId;
    if (newParentId) {
      if (newParentId === id) {
        return c.json({ error: 'Không thể chọn chính thẻ này làm thẻ cha' }, 400);
      }
      const allChapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, chapter.projectId));
      // Circular reparenting check: newParentId must not be a descendant of id
      const getAllDescendantIds = (rootId: string): string[] => {
        const children = allChapters.filter((ch: any) => ch.parentId === rootId);
        const childIds = children.map((ch: any) => ch.id);
        const nestedIds = childIds.flatMap((cid: string) => getAllDescendantIds(cid));
        return [...childIds, ...nestedIds];
      };
      const descendantIds = new Set(getAllDescendantIds(id));
      if (descendantIds.has(newParentId)) {
        return c.json({ error: 'Quan hệ phân cấp vòng tròn không hợp lệ' }, 400);
      }

      // Check max 3 levels (Google Docs allows max 3 levels: depth 0, 1, 2)
      let parentDepth = 0;
      let curr = allChapters.find((ch: any) => ch.id === newParentId);
      if (!curr) {
        return c.json({ error: 'Thẻ cha không tồn tại' }, 400);
      }
      const visited = new Set<string>();
      while (curr?.parentId && !visited.has(curr.id)) {
        visited.add(curr.id);
        parentDepth++;
        curr = allChapters.find((ch: any) => ch.id === curr.parentId);
      }
      const getSubtreeHeight = (rootId: string): number => {
        const children = allChapters.filter((ch: any) => ch.parentId === rootId);
        if (children.length === 0) return 0;
        return 1 + Math.max(...children.map((ch: any) => getSubtreeHeight(ch.id)));
      };
      const subtreeHeight = getSubtreeHeight(id);
      if (parentDepth + 1 + subtreeHeight > 2) {
        return c.json({ error: 'Google Docs giới hạn phân cấp tối đa 3 cấp thẻ' }, 400);
      }
    }
  }

  const checkBaseContent = contentChanged && parsed.data.baseContentUpdatedAt !== undefined;
  const checkBaseTitle = titleChanged && parsed.data.baseTitleUpdatedAt !== undefined;

  // Atomic conditional update in database
  const updateResult = await c.env.DB.prepare(`
    UPDATE chapters
    SET title = ?, content = ?, word_count = ?, content_format = ?, summary = ?,
        status = ?, order_index = ?, parent_id = ?, notes = ?, pov = ?,
        location = ?, characters_present = ?, emoji = ?,
        updated_at = ?, content_updated_at = ?, title_updated_at = ?
    WHERE id = ?
      AND (? = 0 OR EXISTS (
        SELECT 1 FROM chapter_edit_locks
        WHERE chapter_id = ? AND user_id = ? AND lock_token = ? AND expires_at > ?
      ))
      AND (? = 0 OR content_updated_at = ?)
      AND (? = 0 OR title_updated_at = ?)
  `).bind(
    newTitle, newContent, newWordCount, newFormat, newSummary,
    newStatus, newOrderIndex, newParentId, newNotes, newPov,
    newLocation, newCharacters, newEmoji,
    mutationTime, newContentUpdatedAt, newTitleUpdatedAt,
    id,
    requireLock ? 1 : 0, id, user.userId, suppliedToken, now,
    checkBaseContent ? 1 : 0, Number(parsed.data.baseContentUpdatedAt || 0),
    checkBaseTitle ? 1 : 0, Number(parsed.data.baseTitleUpdatedAt || 0)
  ).run();

  if (!updateResult.meta.changes) {
    const current = await c.env.DB.prepare(`
      SELECT c.id, c.updated_at AS updatedAt, c.content_updated_at AS contentUpdatedAt, c.title_updated_at AS titleUpdatedAt,
             l.lock_token AS lockToken, l.device_label AS deviceLabel, l.expires_at AS expiresAt
      FROM chapters c
      LEFT JOIN chapter_edit_locks l ON l.chapter_id = c.id
      WHERE c.id = ?
    `).bind(id).first();

    if (!current) return c.json({ error: 'Chapter not found' }, 404);
    if (requireLock && (!current.lockToken || current.lockToken !== suppliedToken || Number(current.expiresAt || 0) <= now)) {
      const active = await readActiveLock(c, id);
      return c.json({ error: 'Quyền chỉnh sửa đã hết hạn hoặc được chuyển sang thiết bị khác', lock: active ? publicLock(active) : null }, 423);
    }
    return c.json({
      error: 'Xung đột phiên bản: nội dung trên máy chủ đã thay đổi',
      conflict: { updatedAt: current.updatedAt, contentUpdatedAt: current.contentUpdatedAt, titleUpdatedAt: current.titleUpdatedAt }
    }, 409);
  }

  // Auto-create revision every 10 minutes or if word count changed significantly
  const shouldCreateRevision = !chapter.content || Math.abs((newWordCount || 0) - (chapter.wordCount || 0)) > 100 || (now - chapter.updatedAt > 10 * 60 * 1000);
  if (shouldCreateRevision && newContent) {
    await db.insert(schema.revisions).values({
      id: generateId(),
      entityType: 'chapter',
      entityId: id,
      content: newContent,
      wordCount: newWordCount,
      createdBy: user.userId,
      createdAt: now,
      label: 'Auto-save'
    });
  }

  const savedRows = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  const saved = savedRows[0];
  return c.json({
    success: true,
    chapter: saved ? {
      ...saved,
      charactersPresent: saved.charactersPresent ? JSON.parse(saved.charactersPresent) : []
    } : null
  });
};
chapters.patch('/chapters/:id', patchChapterHandler);
chapters.patch('/:id', patchChapterHandler);

// DELETE /api/chapters/:id (Atomic D1 tombstone ledger and cascade delete)
const deleteChapterHandler = async (c: any) => {
  const id = c.req.param('id');
  const operationId = c.req.header('X-Operation-Id') || c.req.query('operationId');
  const suppliedLockToken = c.req.header('X-Chapter-Lock-Token');
  const result = await deleteChapterAtomic(c, id, { suppliedLockToken, operationId });
  return c.json(result.data, result.status as any);
};
chapters.delete('/chapters/:id', deleteChapterHandler);
chapters.delete('/:id', deleteChapterHandler);

// POST /api/chapters/:id/duplicate
const duplicateChapterHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const allChapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, chapter.projectId));
  if (allChapters.length >= 100) {
    return c.json({ error: 'Tài liệu đã đạt giới hạn tối đa 100 thẻ' }, 400);
  }

  const getAllDescendants = (rootId: string): any[] => {
    const children = allChapters
      .filter((ch: any) => ch.parentId === rootId)
      .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const result: any[] = [];
    for (const child of children) {
      result.push(child);
      result.push(...getAllDescendants(child.id));
    }
    return result;
  };
  const descendants = getAllDescendants(id);
  if (allChapters.length + 1 + descendants.length > 100) {
    return c.json({ error: 'Tài liệu đã đạt giới hạn tối đa 100 thẻ' }, 400);
  }

  const maxOrder = allChapters.length > 0 ? Math.max(...allChapters.map((ch: any) => ch.orderIndex || 0)) : 0;
  const now = nowTimestamp();
  const newRootId = generateId();
  const idMap = new Map<string, string>();
  idMap.set(id, newRootId);
  descendants.forEach((d: any) => {
    idMap.set(d.id, generateId());
  });

  const newRootChapter = {
    ...chapter,
    id: newRootId,
    title: `${chapter.title} (Bản sao)`,
    orderIndex: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
    contentUpdatedAt: now,
    titleUpdatedAt: now
  };
  await db.insert(schema.chapters).values(newRootChapter);

  for (let i = 0; i < descendants.length; i++) {
    const d = descendants[i];
    const newChildId = idMap.get(d.id)!;
    const newParentId = idMap.get(d.parentId) || d.parentId;
    await db.insert(schema.chapters).values({
      ...d,
      id: newChildId,
      orderIndex: maxOrder + 2 + i,
      parentId: newParentId,
      createdAt: now,
      updatedAt: now,
      contentUpdatedAt: now,
      titleUpdatedAt: now
    });
  }

  return c.json({ chapter: newRootChapter }, 201);
};
chapters.post('/chapters/:id/duplicate', duplicateChapterHandler);
chapters.post('/:id/duplicate', duplicateChapterHandler);

// POST /api/chapters/:id/reorder
const reorderSingleChapterHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const { newIndex } = await c.req.json();

  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const allChapters = await db.select().from(schema.chapters)
    .where(eq(schema.chapters.projectId, chapter.projectId))
    .orderBy(asc(schema.chapters.orderIndex));

  const filtered = allChapters.filter((ch: any) => ch.id !== id);
  const targetIndex = Math.max(0, Math.min(typeof newIndex === 'number' ? newIndex : 0, filtered.length));
  filtered.splice(targetIndex, 0, chapter);

  const changedIds = filtered.filter((ch: any, index: number) => Number(ch.orderIndex || 0) !== index).map((ch: any) => ch.id);
  const lockedResponse = await rejectIfAnyChangedChapterIsLocked(c, changedIds);
  if (lockedResponse) return lockedResponse;

  const now = nowTimestamp();
  for (let i = 0; i < filtered.length; i++) {
    const ch = filtered[i];
    if (ch.orderIndex !== i) {
      await db.update(schema.chapters).set({ orderIndex: i, updatedAt: now }).where(eq(schema.chapters.id, ch.id));
    }
  }

  return c.json({ success: true, newIndex: targetIndex });
};
chapters.post('/chapters/:id/reorder', reorderSingleChapterHandler);
chapters.post('/:id/reorder', reorderSingleChapterHandler);

// GET /api/chapters/:id/revisions
const revisionsHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const revisions = await db.select().from(schema.revisions).where(and(eq(schema.revisions.entityType, 'chapter'), eq(schema.revisions.entityId, id))).orderBy(asc(schema.revisions.createdAt));

  return c.json({ revisions });
};
chapters.get('/chapters/:id/revisions', revisionsHandler);
chapters.get('/:id/revisions', revisionsHandler);

export default chapters;

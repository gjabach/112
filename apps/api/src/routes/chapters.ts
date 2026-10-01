import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp } from '../lib/auth';
import { createChapterSchema, updateChapterSchema } from '@novelist/shared';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { countWords } from '../utils/validation';

type Variables = { db: any; user: AuthUser };
const chapters = new Hono<{ Bindings: Env; Variables: Variables }>();

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
    updatedAt: now
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

// POST /api/projects/:projectId/chapters/reorder - Contiguous reorder by array of chapterIds
chapters.post('/projects/:projectId/chapters/reorder', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const chapterIds: string[] = body.chapterIds || [];

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

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
  if (result.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = result[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  return c.json({
    chapter: {
      ...chapter,
      charactersPresent: chapter.charactersPresent ? JSON.parse(chapter.charactersPresent) : []
    }
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

  const updates: any = { updatedAt: nowTimestamp() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.content !== undefined) {
    updates.content = parsed.data.content;
    updates.wordCount = countWords(parsed.data.content);
  }
  if (parsed.data.contentFormat !== undefined) updates.contentFormat = parsed.data.contentFormat;
  if (parsed.data.summary !== undefined) updates.summary = parsed.data.summary;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.orderIndex !== undefined) updates.orderIndex = parsed.data.orderIndex;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.pov !== undefined) updates.pov = parsed.data.pov;
  if (parsed.data.location !== undefined) updates.location = parsed.data.location;
  if (parsed.data.charactersPresent !== undefined) updates.charactersPresent = JSON.stringify(parsed.data.charactersPresent);
  if (parsed.data.emoji !== undefined) updates.emoji = parsed.data.emoji;

  if (parsed.data.parentId !== undefined) {
    const newParentId = parsed.data.parentId;
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
    updates.parentId = newParentId;
  }

  await db.update(schema.chapters).set(updates).where(eq(schema.chapters.id, id));

  // Auto-create revision every 10 minutes or if word count changed significantly
  const shouldCreateRevision = !chapter.content || Math.abs((updates.wordCount || chapter.wordCount) - chapter.wordCount) > 100 || (nowTimestamp() - chapter.updatedAt > 10 * 60 * 1000);
  if (shouldCreateRevision && updates.content) {
    await db.insert(schema.revisions).values({
      id: generateId(),
      entityType: 'chapter',
      entityId: id,
      content: updates.content,
      wordCount: updates.wordCount || chapter.wordCount,
      createdBy: user.userId,
      createdAt: nowTimestamp(),
      label: 'Auto-save'
    });
  }

  return c.json({ success: true });
};
chapters.patch('/chapters/:id', patchChapterHandler);
chapters.patch('/:id', patchChapterHandler);

// DELETE /api/chapters/:id (with Cascade Delete and min 1 tab requirement)
const deleteChapterHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const allProjectChapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, chapter.projectId));
  if (allProjectChapters.length <= 1) {
    return c.json({ error: 'Tài liệu phải có tối thiểu 1 thẻ' }, 400);
  }

  const getAllDescendantIds = (rootId: string): string[] => {
    const children = allProjectChapters.filter((ch: any) => ch.parentId === rootId);
    const childIds = children.map((ch: any) => ch.id);
    const nestedIds = childIds.flatMap((cid: string) => getAllDescendantIds(cid));
    return [...childIds, ...nestedIds];
  };
  const toDeleteIds = Array.from(new Set([id, ...getAllDescendantIds(id)]));
  if (toDeleteIds.length >= allProjectChapters.length) {
    return c.json({ error: 'Tài liệu phải có tối thiểu 1 thẻ' }, 400);
  }

  for (const delId of toDeleteIds) {
    await db.delete(schema.scenes).where(eq(schema.scenes.chapterId, delId));
    await db.delete(schema.chapters).where(eq(schema.chapters.id, delId));
    await db.delete(schema.revisions).where(and(eq(schema.revisions.entityType, 'chapter'), eq(schema.revisions.entityId, delId)));
  }

  return c.json({ success: true });
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
    updatedAt: now
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
      updatedAt: now
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

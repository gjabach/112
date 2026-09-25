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

  const parsed = createChapterSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const id = generateId();
  const now = nowTimestamp();
  const wordCount = parsed.data.content ? countWords(parsed.data.content) : 0;

  await db.insert(schema.chapters).values({
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
    createdAt: now,
    updatedAt: now
  });

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

  return c.json({ id }, 201);
});

// GET /api/chapters/:id
chapters.get('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const result = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (result.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = result[0];
  // Verify project ownership
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  return c.json({
    chapter: {
      ...chapter,
      charactersPresent: chapter.charactersPresent ? JSON.parse(chapter.charactersPresent) : []
    }
  });
});

// PATCH /api/chapters/:id
chapters.patch('/:id', async (c) => {
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
  if (parsed.data.parentId !== undefined) updates.parentId = parsed.data.parentId;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.pov !== undefined) updates.pov = parsed.data.pov;
  if (parsed.data.location !== undefined) updates.location = parsed.data.location;
  if (parsed.data.charactersPresent !== undefined) updates.charactersPresent = JSON.stringify(parsed.data.charactersPresent);

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
});

// DELETE /api/chapters/:id
chapters.delete('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  await db.delete(schema.chapters).where(eq(schema.chapters.id, id));
  return c.json({ success: true });
});

// POST /api/chapters/:id/reorder
chapters.post('/:id/reorder', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const { newIndex } = await c.req.json();

  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Chapter not found' }, 404);

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  // Full contiguous reorder: retrieve all chapters, splice to new position, and update indexes
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
});

// GET /api/chapters/:id/revisions
chapters.get('/:id/revisions', async (c) => {
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
});

export default chapters;

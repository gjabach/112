import { Hono } from 'hono';
import { eq, and, desc, count } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp } from '../lib/auth';
import { createProjectSchema, updateProjectSchema } from '@novelist/shared';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { countWords } from '../utils/validation';

type Variables = {
  db: any;
  user: AuthUser;
};

const projects = new Hono<{ Bindings: Env; Variables: Variables }>();

projects.use('*', authMiddleware);

// GET /api/projects
projects.get('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const userProjects = await db.select().from(schema.projects).where(eq(schema.projects.userId, user.userId)).orderBy(desc(schema.projects.updatedAt));

  // Enrich with chapter counts and word counts
  const enriched = await Promise.all(userProjects.map(async (p: any) => {
    const chapters = await db.select({ wordCount: schema.chapters.wordCount }).from(schema.chapters).where(eq(schema.chapters.projectId, p.id));
    const totalWords = chapters.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0);
    return {
      ...p,
      settings: p.settings ? JSON.parse(p.settings) : null,
      wordCount: totalWords,
      chapterCount: chapters.length
    };
  }));

  return c.json({ projects: enriched });
});

// POST /api/projects
projects.post('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const id = generateId();
  const now = nowTimestamp();

  const newProject = {
    id,
    userId: user.userId,
    title: parsed.data.title,
    subtitle: parsed.data.subtitle || null,
    description: parsed.data.description || null,
    genre: parsed.data.genre || null,
    wordCountGoal: parsed.data.wordCountGoal || null,
    status: parsed.data.status || 'planning',
    settings: JSON.stringify({ font: 'Lora', theme: 'dark', editorPrefs: {} }),
    createdAt: now,
    updatedAt: now
  };

  await db.insert(schema.projects).values(newProject);

  // If template, create initial chapters based on template
  const template = parsed.data.template;
  if (template && template !== 'blank') {
    const templates: Record<string, string[]> = {
      'fantasy': ['Mở đầu - Lời tiên tri', 'Thế giới mới', 'Thử thách đầu tiên', 'Đồng minh & Kẻ thù', 'Bí mật cổ xưa', 'Trận chiến quyết định', 'Kết thúc & Khởi đầu mới'],
      'scifi': ['Tín hiệu lạ', 'Khám phá', 'Công nghệ nguy hiểm', 'Âm mưu', 'Vượt qua giới hạn', 'Sự thật về vũ trụ', 'Tương lai mới'],
      'romance': ['Gặp gỡ định mệnh', 'Hiểu lầm', 'Khoảnh khắc rung động', 'Trở ngại', 'Thổ lộ', 'Cao trào cảm xúc', 'Happy Ending'],
      'mystery': ['Vụ án', 'Hiện trường', 'Nghi phạm', 'Manh mối', 'Bẻ lái', 'Sự thật', 'Công lý'],
    };
    const chapterTitles = templates[template] || ['Chương 1'];
    for (let i = 0; i < chapterTitles.length; i++) {
      await db.insert(schema.chapters).values({
        id: generateId(),
        projectId: id,
        title: chapterTitles[i],
        content: '',
        contentFormat: 'tiptap-json',
        wordCount: 0,
        orderIndex: i,
        status: 'outline',
        createdAt: now + i,
        updatedAt: now + i
      });
    }
  } else {
    // Create first empty chapter
    await db.insert(schema.chapters).values({
      id: generateId(),
      projectId: id,
      title: 'Chương 1',
      content: '',
      contentFormat: 'tiptap-json',
      wordCount: 0,
      orderIndex: 0,
      status: 'outline',
      createdAt: now,
      updatedAt: now
    });
  }

  return c.json({ project: { ...newProject, settings: JSON.parse(newProject.settings), wordCount: 0, chapterCount: 1 } }, 201);
});

// GET /api/projects/:id
projects.get('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const result = await db.select().from(schema.projects).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.userId))).limit(1);
  if (result.length === 0) return c.json({ error: 'Project not found' }, 404);

  const project = result[0];
  const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, id));
  const totalWords = chapters.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0);

  return c.json({
    project: {
      ...project,
      settings: project.settings ? JSON.parse(project.settings) : null,
      wordCount: totalWords,
      chapterCount: chapters.length
    }
  });
});

// PATCH /api/projects/:id
projects.patch('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const existing = await db.select().from(schema.projects).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.userId))).limit(1);
  if (existing.length === 0) return c.json({ error: 'Project not found' }, 404);

  const updates: any = { updatedAt: nowTimestamp() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.subtitle !== undefined) updates.subtitle = parsed.data.subtitle;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.genre !== undefined) updates.genre = parsed.data.genre;
  if (parsed.data.wordCountGoal !== undefined) updates.wordCountGoal = parsed.data.wordCountGoal;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.coverImageUrl !== undefined) updates.coverImageUrl = parsed.data.coverImageUrl;
  if (parsed.data.settings !== undefined) updates.settings = JSON.stringify(parsed.data.settings);

  await db.update(schema.projects).set(updates).where(eq(schema.projects.id, id));

  return c.json({ success: true });
});

// DELETE /api/projects/:id
projects.delete('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.projects).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.userId))).limit(1);
  if (existing.length === 0) return c.json({ error: 'Project not found' }, 404);

  // Explicit cascade delete of all child entities to guarantee no orphaned data
  const projectChapters = await db.select({ id: schema.chapters.id }).from(schema.chapters).where(eq(schema.chapters.projectId, id));
  for (const ch of projectChapters) {
    await db.delete(schema.scenes).where(eq(schema.scenes.chapterId, ch.id));
  }

  await db.delete(schema.exportJobs).where(eq(schema.exportJobs.projectId, id));
  await db.delete(schema.timelineEvents).where(eq(schema.timelineEvents.projectId, id));
  await db.delete(schema.outlineNodes).where(eq(schema.outlineNodes.projectId, id));
  await db.delete(schema.worldEntities).where(eq(schema.worldEntities.projectId, id));
  await db.delete(schema.locations).where(eq(schema.locations.projectId, id));
  await db.delete(schema.characters).where(eq(schema.characters.projectId, id));
  await db.delete(schema.chapters).where(eq(schema.chapters.projectId, id));
  await db.delete(schema.projects).where(eq(schema.projects.id, id));

  return c.json({ success: true });
});

// POST /api/projects/:id/duplicate
projects.post('/:id/duplicate', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.projects).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.userId))).limit(1);
  if (existing.length === 0) return c.json({ error: 'Project not found' }, 404);

  const original = existing[0];
  const newId = generateId();
  const now = nowTimestamp();

  await db.insert(schema.projects).values({
    ...original,
    id: newId,
    title: `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now
  });

  // Duplicate chapters
  const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, id));
  for (const ch of chapters) {
    await db.insert(schema.chapters).values({
      ...ch,
      id: generateId(),
      projectId: newId,
      createdAt: now,
      updatedAt: now
    });
  }

  // Duplicate characters
  const chars = await db.select().from(schema.characters).where(eq(schema.characters.projectId, id));
  for (const char of chars) {
    await db.insert(schema.characters).values({
      ...char,
      id: generateId(),
      projectId: newId,
      createdAt: now,
      updatedAt: now
    });
  }

  return c.json({ projectId: newId }, 201);
});

// GET /api/projects/:id/stats
projects.get('/:id/stats', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, id));
  const characters = await db.select({ id: schema.characters.id }).from(schema.characters).where(eq(schema.characters.projectId, id));

  const totalWords = chapters.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0);
  const avgWords = chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0;

  // Writing sessions last 30 days
  const thirtyDaysAgo = nowTimestamp() - 30 * 24 * 60 * 60 * 1000;
  const sessions = await db.select().from(schema.writingSessions).where(and(eq(schema.writingSessions.projectId, id), eq(schema.writingSessions.userId, user.userId)));

  const recentSessions = sessions.filter((s: any) => s.startedAt >= thirtyDaysAgo);

  return c.json({
    stats: {
      totalWords,
      chapterCount: chapters.length,
      characterCount: characters.length,
      avgWordsPerChapter: avgWords,
      progress: project[0].wordCountGoal ? Math.min(100, Math.round((totalWords / project[0].wordCountGoal) * 100)) : 0,
      sessions: recentSessions,
      chapters: chapters.map((ch: any) => ({ id: ch.id, title: ch.title, wordCount: ch.wordCount, status: ch.status, orderIndex: ch.orderIndex }))
    }
  });
});

export default projects;

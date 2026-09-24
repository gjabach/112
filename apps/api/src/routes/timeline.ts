import { Hono } from 'hono';
import { eq, and, asc, desc } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp, decryptApiKey } from '../lib/auth';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';

type Variables = { db: any; user: AuthUser };
const timeline = new Hono<{ Bindings: Env; Variables: Variables }>();

timeline.use('*', authMiddleware);

// GET /api/projects/:projectId/timeline
timeline.get('/projects/:projectId/timeline', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  
  const era = c.req.query('era');
  const importance = c.req.query('importance');
  const characterId = c.req.query('characterId');
  const locationId = c.req.query('locationId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  let events = await db.select().from(schema.timelineEvents).where(eq(schema.timelineEvents.projectId, projectId)).orderBy(asc(schema.timelineEvents.orderIndex));

  // Filter in memory (D1 simple)
  if (era) events = events.filter((e: any) => e.era === era);
  if (importance) events = events.filter((e: any) => e.importance === importance);
  if (locationId) events = events.filter((e: any) => e.locationId === locationId);
  if (characterId) {
    events = events.filter((e: any) => {
      try {
        const ids = e.involvedCharacterIds ? JSON.parse(e.involvedCharacterIds) : [];
        return ids.includes(characterId);
      } catch { return false; }
    });
  }

  const enriched = events.map((e: any) => ({
    ...e,
    involvedCharacterIds: e.involvedCharacterIds ? JSON.parse(e.involvedCharacterIds) : []
  }));

  // Group by era
  const eras = [...new Set(events.map((e: any) => e.era).filter(Boolean))];
  const stats = {
    total: events.length,
    major: events.filter((e: any) => e.importance === 'major').length,
    minor: events.filter((e: any) => e.importance === 'minor').length,
    eras: eras.length
  };

  return c.json({ events: enriched, eras, stats });
});

// POST /api/projects/:projectId/timeline
timeline.post('/projects/:projectId/timeline', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const id = generateId();
  const now = nowTimestamp();

  // Get max orderIndex
  const existing = await db.select().from(schema.timelineEvents).where(eq(schema.timelineEvents.projectId, projectId));
  const maxOrder = existing.length > 0 ? Math.max(...existing.map((e: any) => e.orderIndex)) : -1;

  await db.insert(schema.timelineEvents).values({
    id,
    projectId,
    title: body.title,
    description: body.description || null,
    dateInStory: body.dateInStory || null,
    dateRealWorld: body.dateRealWorld || null,
    era: body.era || null,
    importance: body.importance || 'minor',
    involvedCharacterIds: JSON.stringify(body.involvedCharacterIds || []),
    locationId: body.locationId || null,
    chapterId: body.chapterId || null,
    orderIndex: body.orderIndex ?? maxOrder + 1,
    createdAt: now,
    updatedAt: now
  });

  return c.json({ id }, 201);
});

// PATCH /api/timeline/:id
timeline.patch('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await db.select().from(schema.timelineEvents).where(eq(schema.timelineEvents.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Event not found' }, 404);

  const event = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, event.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const updates: any = { updatedAt: nowTimestamp() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.dateInStory !== undefined) updates.dateInStory = body.dateInStory;
  if (body.dateRealWorld !== undefined) updates.dateRealWorld = body.dateRealWorld;
  if (body.era !== undefined) updates.era = body.era;
  if (body.importance !== undefined) updates.importance = body.importance;
  if (body.involvedCharacterIds !== undefined) updates.involvedCharacterIds = JSON.stringify(body.involvedCharacterIds);
  if (body.locationId !== undefined) updates.locationId = body.locationId;
  if (body.chapterId !== undefined) updates.chapterId = body.chapterId;
  if (body.orderIndex !== undefined) updates.orderIndex = body.orderIndex;

  await db.update(schema.timelineEvents).set(updates).where(eq(schema.timelineEvents.id, id));
  return c.json({ success: true });
});

// DELETE /api/timeline/:id
timeline.delete('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.timelineEvents).where(eq(schema.timelineEvents.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Event not found' }, 404);

  const event = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, event.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  await db.delete(schema.timelineEvents).where(eq(schema.timelineEvents.id, id));
  return c.json({ success: true });
});

// POST /api/projects/:projectId/timeline/reorder
timeline.post('/projects/:projectId/timeline/reorder', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const { orderedIds } = await c.req.json(); // [{id, orderIndex}]

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  for (const item of orderedIds) {
    await db.update(schema.timelineEvents).set({
      orderIndex: item.orderIndex,
      updatedAt: nowTimestamp()
    }).where(eq(schema.timelineEvents.id, item.id));
  }

  return c.json({ success: true });
});

// POST /api/projects/:projectId/timeline/check - AI check timeline consistency
timeline.post('/projects/:projectId/timeline/check', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const userRecord = await db.select().from(schema.users).where(eq(schema.users.id, user.userId)).limit(1);
  const u = userRecord[0];
  if (!u.aiApiKey) return c.json({ error: 'Chưa cấu hình AI API Key' }, 400);

  const apiKey = await decryptApiKey(u.aiApiKey, c.env.ENCRYPTION_KEY);
  const provider = u.aiProvider || 'openai';
  const model = u.aiModel || 'gpt-4o-mini';

  const { createAIProvider } = await import('@novelist/ai-core/src/providers');
  const aiProvider = createAIProvider(provider as any);

  const events = await db.select().from(schema.timelineEvents).where(eq(schema.timelineEvents.projectId, projectId)).orderBy(asc(schema.timelineEvents.orderIndex));
  const characters = await db.select().from(schema.characters).where(eq(schema.characters.projectId, projectId));

  const eventsText = events.map((e: any, i: number) => 
    `${i+1}. ${e.title} - Ngày trong truyện: ${e.dateInStory || 'không rõ'} - Kỷ nguyên: ${e.era || 'không rõ'} - Mức độ: ${e.importance} - Mô tả: ${e.description || ''}`
  ).join('\n');

  const systemPrompt = `Bạn là chuyên gia kiểm tra tính nhất quán dòng thời gian (timeline) cho tiểu thuyết.
Nhiệm vụ:
- Phát hiện mâu thuẫn thời gian, logic, nhân quả
- Kiểm tra nhân vật xuất hiện có hợp lý không
- Phát hiện sự kiện trước/sau không logic
- Gợi ý cách sửa

Trả về JSON: {"issues": [{"type": "time_paradox|character_age|causality|era_mismatch", "severity": "high|medium|low", "eventIds": ["id1", "id2"], "description": "...", "suggestion": "..."}], "summary": "..."}`;

  const userPrompt = `Dự án: ${project[0].title}
Thể loại: ${project[0].genre}

Nhân vật:
${characters.map((ch: any) => `- ${ch.name}: ${ch.age || ''} ${ch.background?.slice(0,100) || ''}`).join('\n')}

Timeline events theo thứ tự:
${eventsText}

Hãy kiểm tra tính nhất quán và trả về JSON.`;

  try {
    const result = await aiProvider.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 3000,
      apiKey
    });

    let parsed;
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = result.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else parsed = { raw: result };
    }

    return c.json({ check: parsed });
  } catch (err: any) {
    return c.json({ error: 'AI check failed: ' + err.message }, 500);
  }
});

// GET /api/projects/:projectId/timeline/eras - List unique eras
timeline.get('/projects/:projectId/timeline/eras', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const events = await db.select().from(schema.timelineEvents).where(eq(schema.timelineEvents.projectId, projectId));
  const eras = [...new Set(events.map((e: any) => e.era).filter(Boolean))];

  return c.json({ eras });
});

export default timeline;

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp, decryptApiKey } from '../lib/auth';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';

type Variables = { db: any; user: AuthUser };
const worldbuilding = new Hono<{ Bindings: Env; Variables: Variables }>();

worldbuilding.use('*', authMiddleware);

// POST /api/projects/:projectId/entities/generate - AI generate entity
worldbuilding.post('/projects/:projectId/entities/generate', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const { type, concept } = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const userRecord = await db.select().from(schema.users).where(eq(schema.users.id, user.userId)).limit(1);
  const u = userRecord[0];
  if (!u?.aiApiKey) return c.json({ error: 'Chưa cấu hình AI API Key' }, 400);

  const apiKey = await decryptApiKey(u.aiApiKey, c.env.ENCRYPTION_KEY);
  const provider = u.aiProvider || 'openai';
  const model = u.aiModel || 'gpt-4o-mini';

  const { createAIProvider } = await import('@novelist/ai-core/src/providers');
  const aiProvider = createAIProvider(provider as any);

  const systemPrompt = `Bạn là chuyên gia thiết kế thế giới (worldbuilding) cho tiểu thuyết.
Nhiệm vụ: Tạo một thực thể thế giới chi tiết theo loại "${type || 'lore'}" và ý tưởng đã cho.
Yêu cầu: Trả về JSON thuần (không markdown, không bọc code block):
{
  "name": "Tên thực thể",
  "description": "Mô tả chi tiết và lịch sử nguồn gốc",
  "attributes": { "key": "value" },
  "tags": ["tag1", "tag2"]
}`;

  const userPrompt = `Dự án: ${project[0].title}
Thể loại: ${project[0].genre || 'chung'}
Loại thực thể: ${type || 'lore'}
Ý tưởng ban đầu: ${concept || 'Một yếu tố độc đáo phù hợp thế giới này'}`;

  try {
    const raw = await aiProvider.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 1500,
      apiKey
    });

    let generated: any;
    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      generated = JSON.parse(cleaned);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) generated = JSON.parse(match[0]);
      else throw new Error('Không phân tích được phản hồi AI');
    }

    const id = generateId();
    const now = nowTimestamp();

    await db.insert(schema.worldEntities).values({
      id,
      projectId,
      type: type || 'custom',
      name: generated.name || 'Thực thể mới',
      description: generated.description || null,
      attributes: JSON.stringify(generated.attributes || {}),
      imageUrl: null,
      relatedEntityIds: JSON.stringify([]),
      tags: JSON.stringify(generated.tags || []),
      createdAt: now,
      updatedAt: now
    });

    const enriched = {
      id,
      projectId,
      type: type || 'custom',
      name: generated.name || 'Thực thể mới',
      description: generated.description || null,
      attributes: generated.attributes || {},
      imageUrl: null,
      relatedEntityIds: [],
      tags: generated.tags || [],
      createdAt: now,
      updatedAt: now
    };

    return c.json({ entity: enriched }, 201);
  } catch (err: any) {
    return c.json({ error: 'AI generation failed: ' + err.message }, 500);
  }
});

// GET /api/projects/:projectId/entities?type=...
worldbuilding.get('/projects/:projectId/entities', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const type = c.req.query('type');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  let query = db.select().from(schema.worldEntities).where(eq(schema.worldEntities.projectId, projectId));
  const result = await query;

  const filtered = type ? result.filter((e: any) => e.type === type) : result;
  const enriched = filtered.map((e: any) => ({
    ...e,
    attributes: e.attributes ? JSON.parse(e.attributes) : {},
    relatedEntityIds: e.relatedEntityIds ? JSON.parse(e.relatedEntityIds) : [],
    tags: e.tags ? JSON.parse(e.tags) : []
  }));

  return c.json({ entities: enriched });
});

// POST /api/projects/:projectId/entities
worldbuilding.post('/projects/:projectId/entities', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const id = generateId();
  const now = nowTimestamp();

  await db.insert(schema.worldEntities).values({
    id,
    projectId,
    type: body.type || 'custom',
    name: body.name,
    description: body.description || null,
    attributes: JSON.stringify(body.attributes || {}),
    imageUrl: body.imageUrl || null,
    relatedEntityIds: JSON.stringify(body.relatedEntityIds || []),
    tags: JSON.stringify(body.tags || []),
    createdAt: now,
    updatedAt: now
  });

  return c.json({ id }, 201);
});

// GET /api/entities/:id
const getEntityHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.worldEntities).where(eq(schema.worldEntities.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Entity not found' }, 404);

  const entity = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, entity.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  return c.json({
    entity: {
      ...entity,
      attributes: entity.attributes ? JSON.parse(entity.attributes) : {},
      relatedEntityIds: entity.relatedEntityIds ? JSON.parse(entity.relatedEntityIds) : [],
      tags: entity.tags ? JSON.parse(entity.tags) : []
    }
  });
};
worldbuilding.get('/entities/:id', getEntityHandler);
worldbuilding.get('/worldbuilding/:id', getEntityHandler);
worldbuilding.get('/:id', getEntityHandler);

// PATCH /api/entities/:id
const patchEntityHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await db.select().from(schema.worldEntities).where(eq(schema.worldEntities.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Entity not found' }, 404);

  const entity = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, entity.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const updates: any = { updatedAt: nowTimestamp() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.type !== undefined) updates.type = body.type;
  if (body.description !== undefined) updates.description = body.description;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
  if (body.attributes !== undefined) updates.attributes = JSON.stringify(body.attributes);
  if (body.relatedEntityIds !== undefined) updates.relatedEntityIds = JSON.stringify(body.relatedEntityIds);
  if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);

  await db.update(schema.worldEntities).set(updates).where(eq(schema.worldEntities.id, id));
  return c.json({ success: true });
};
worldbuilding.patch('/entities/:id', patchEntityHandler);
worldbuilding.patch('/worldbuilding/:id', patchEntityHandler);
worldbuilding.patch('/:id', patchEntityHandler);

// DELETE /api/entities/:id
const deleteEntityHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.worldEntities).where(eq(schema.worldEntities.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Entity not found' }, 404);

  const entity = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, entity.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  await db.delete(schema.worldEntities).where(eq(schema.worldEntities.id, id));
  return c.json({ success: true });
};
worldbuilding.delete('/entities/:id', deleteEntityHandler);
worldbuilding.delete('/worldbuilding/:id', deleteEntityHandler);
worldbuilding.delete('/:id', deleteEntityHandler);

// Locations
worldbuilding.get('/projects/:projectId/locations', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const locs = await db.select().from(schema.locations).where(eq(schema.locations.projectId, projectId));
  return c.json({ locations: locs.map((l: any) => ({ ...l, mapCoordinates: l.mapCoordinates ? JSON.parse(l.mapCoordinates) : null, customFields: l.customFields ? JSON.parse(l.customFields) : {}, tags: l.tags ? JSON.parse(l.tags) : [] })) });
});

export default worldbuilding;

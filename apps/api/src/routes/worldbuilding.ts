import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp } from '../lib/auth';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';

type Variables = { db: any; user: AuthUser };
const worldbuilding = new Hono<{ Bindings: Env; Variables: Variables }>();

worldbuilding.use('*', authMiddleware);

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

// PATCH /api/entities/:id
worldbuilding.patch('/:id', async (c) => {
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
});

// DELETE /api/entities/:id
worldbuilding.delete('/:id', async (c) => {
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
});

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

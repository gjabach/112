import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp } from '../lib/auth';
import { createCharacterSchema, updateCharacterSchema } from '@novelist/shared';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';

type Variables = { db: any; user: AuthUser };
const characters = new Hono<{ Bindings: Env; Variables: Variables }>();

characters.use('*', authMiddleware);

// GET /api/projects/:projectId/characters
characters.get('/projects/:projectId/characters', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const result = await db.select().from(schema.characters).where(eq(schema.characters.projectId, projectId));
  const enriched = result.map((char: any) => ({
    ...char,
    aliases: char.aliases ? JSON.parse(char.aliases) : [],
    relationships: char.relationships ? JSON.parse(char.relationships) : [],
    customFields: char.customFields ? JSON.parse(char.customFields) : {},
    tags: char.tags ? JSON.parse(char.tags) : []
  }));

  return c.json({ characters: enriched });
});

// POST /api/projects/:projectId/characters
characters.post('/projects/:projectId/characters', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const parsed = createCharacterSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const id = generateId();
  const now = nowTimestamp();

  await db.insert(schema.characters).values({
    id,
    projectId,
    name: parsed.data.name,
    aliases: JSON.stringify(parsed.data.aliases || []),
    role: parsed.data.role || null,
    avatarUrl: parsed.data.avatarUrl || null,
    age: parsed.data.age || null,
    gender: parsed.data.gender || null,
    occupation: parsed.data.occupation || null,
    appearance: parsed.data.appearance || null,
    personality: parsed.data.personality || null,
    background: parsed.data.background || null,
    motivation: parsed.data.motivation || null,
    characterArc: parsed.data.characterArc || null,
    fears: parsed.data.fears || null,
    desires: parsed.data.desires || null,
    strengths: parsed.data.strengths || null,
    weaknesses: parsed.data.weaknesses || null,
    speechPattern: parsed.data.speechPattern || null,
    secrets: parsed.data.secrets || null,
    relationships: JSON.stringify(parsed.data.relationships || []),
    customFields: JSON.stringify(parsed.data.customFields || {}),
    tags: JSON.stringify(parsed.data.tags || []),
    createdAt: now,
    updatedAt: now
  });

  return c.json({ id }, 201);
});

// GET /api/characters/:id
characters.get('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const result = await db.select().from(schema.characters).where(eq(schema.characters.id, id)).limit(1);
  if (result.length === 0) return c.json({ error: 'Character not found' }, 404);

  const char = result[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, char.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  return c.json({
    character: {
      ...char,
      aliases: char.aliases ? JSON.parse(char.aliases) : [],
      relationships: char.relationships ? JSON.parse(char.relationships) : [],
      customFields: char.customFields ? JSON.parse(char.customFields) : {},
      tags: char.tags ? JSON.parse(char.tags) : []
    }
  });
});

// PATCH /api/characters/:id
characters.patch('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateCharacterSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const existing = await db.select().from(schema.characters).where(eq(schema.characters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Character not found' }, 404);

  const char = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, char.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const updates: any = { updatedAt: nowTimestamp() };
  const fields = ['name', 'role', 'avatarUrl', 'age', 'gender', 'occupation', 'appearance', 'personality', 'background', 'motivation', 'characterArc', 'fears', 'desires', 'strengths', 'weaknesses', 'speechPattern', 'secrets'];
  for (const f of fields) {
    if ((parsed.data as any)[f] !== undefined) updates[f] = (parsed.data as any)[f];
  }
  if (parsed.data.aliases !== undefined) updates.aliases = JSON.stringify(parsed.data.aliases);
  if (parsed.data.relationships !== undefined) updates.relationships = JSON.stringify(parsed.data.relationships);
  if (parsed.data.customFields !== undefined) updates.customFields = JSON.stringify(parsed.data.customFields);
  if (parsed.data.tags !== undefined) updates.tags = JSON.stringify(parsed.data.tags);

  await db.update(schema.characters).set(updates).where(eq(schema.characters.id, id));
  return c.json({ success: true });
});

// DELETE /api/characters/:id
characters.delete('/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.characters).where(eq(schema.characters.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Character not found' }, 404);

  const char = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, char.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  await db.delete(schema.characters).where(eq(schema.characters.id, id));
  return c.json({ success: true });
});

// GET /api/projects/:projectId/characters/graph - relationship graph
characters.get('/projects/:projectId/characters/graph', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const chars = await db.select().from(schema.characters).where(eq(schema.characters.projectId, projectId));

  const nodes = chars.map((char: any) => ({
    id: char.id,
    label: char.name,
    role: char.role,
    avatarUrl: char.avatarUrl
  }));

  const edges: any[] = [];
  for (const char of chars) {
    const rels = char.relationships ? JSON.parse(char.relationships) : [];
    for (const rel of rels) {
      edges.push({
        source: char.id,
        target: rel.characterId,
        label: rel.type,
        description: rel.description
      });
    }
  }

  return c.json({ nodes, edges });
});

export default characters;

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { schema } from '../lib/db';
import { hashPassword, verifyPassword, createJWT, generateId, nowTimestamp, encryptApiKey } from '../lib/auth';
import type { Env } from '../index';
import { registerSchema, loginSchema } from '@novelist/shared';
import { authMiddleware } from '../middleware/auth';

type Variables = {
  db: any;
};

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { email, password, name } = parsed.data;
  const db = c.get('db');

  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: 'Email đã được sử dụng' }, 409);
  }

  const userId = generateId();
  const passwordHash = await hashPassword(password);
  const now = nowTimestamp();

  await db.insert(schema.users).values({
    id: userId,
    email,
    name,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    preferences: JSON.stringify({ theme: 'dark', fontFamily: 'Lora', fontSize: 18, editorWidth: 'medium', lineHeight: 1.8, autoSaveInterval: 5000, typewriterMode: false, focusMode: false })
  });

  const token = await createJWT({ userId, email }, c.env.JWT_SECRET);

  const sessionId = generateId();
  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    createdAt: now
  });

  c.header('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; ${c.env.ENVIRONMENT === 'production' ? 'Secure;' : ''}`);

  return c.json({
    user: { id: userId, email, name, createdAt: now },
    token
  }, 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;
  const db = c.get('db');

  const users = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (users.length === 0) {
    return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401);
  }

  const user = users[0];
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401);
  }

  const token = await createJWT({ userId: user.id, email: user.email }, c.env.JWT_SECRET);
  const now = nowTimestamp();

  const sessionId = generateId();
  await db.insert(schema.sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    createdAt: now
  });

  c.header('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; ${c.env.ENVIRONMENT === 'production' ? 'Secure;' : ''}`);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      aiProvider: user.aiProvider,
      aiModel: user.aiModel,
      preferences: user.preferences ? JSON.parse(user.preferences) : null,
      createdAt: user.createdAt
    },
    token
  });
});

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  c.header('Set-Cookie', `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;`);
  return c.json({ success: true });
});

// GET /api/auth/me
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  const cookieToken = c.req.header('Cookie')?.split(';').find(s => s.trim().startsWith('session='))?.split('=')[1];
  const token = authHeader?.replace('Bearer ', '') || cookieToken;

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { verifyJWT } = await import('../lib/auth');
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const db = c.get('db');
  const users = await db.select().from(schema.users).where(eq(schema.users.id, payload.userId)).limit(1);
  if (users.length === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user = users[0];
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      aiProvider: user.aiProvider,
      aiModel: user.aiModel,
      preferences: user.preferences ? JSON.parse(user.preferences) : null,
      createdAt: user.createdAt
    }
  });
});

// PATCH /api/auth/settings - Update AI settings
auth.patch('/settings', authMiddleware, async (c) => {
  const db = c.get('db');
  const user = c.get('user' as any) as { userId: string };
  const body = await c.req.json();

  const updates: any = { updatedAt: nowTimestamp() };

  if (body.aiProvider) updates.aiProvider = body.aiProvider;
  if (body.aiModel) updates.aiModel = body.aiModel;
  if (body.aiApiKey) {
    // Encrypt API key
    const encrypted = await encryptApiKey(body.aiApiKey, c.env.ENCRYPTION_KEY);
    updates.aiApiKey = encrypted;
  }
  if (body.name) updates.name = body.name;
  if (body.preferences) updates.preferences = JSON.stringify(body.preferences);

  await db.update(schema.users).set(updates).where(eq(schema.users.id, user.userId));

  return c.json({ success: true });
});

export default auth;

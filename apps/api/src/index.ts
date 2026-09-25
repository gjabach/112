import { Hono } from 'hono';
import { createDb } from './lib/db';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import chapterRoutes from './routes/chapters';
import characterRoutes from './routes/characters';
import aiRoutes from './routes/ai';
import worldbuildingRoutes from './routes/worldbuilding';
import exportRoutes from './routes/export';
import outlineRoutes from './routes/outline';
import timelineRoutes from './routes/timeline';
import syncRoutes from './routes/sync';
import { corsMiddleware } from './middleware/cors';

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  FRONTEND_URL: string;
}

const app = new Hono<{ Bindings: Env; Variables: { db: any } }>();

// Global middleware
app.use('*', corsMiddleware);
app.use('*', async (c, next) => {
  // Enforce foreign key constraints in D1
  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('PRAGMA foreign_keys = ON;').run();
    } catch {}
  }
  // Create DB instance per request
  const db = createDb(c.env.DB);
  c.set('db' as any, db);
  await next();
});

// Health check
app.get('/', (c) => c.json({ 
  name: 'Novelist API',
  version: '0.1.0',
  status: 'ok',
  timestamp: Date.now(),
  environment: c.env.ENVIRONMENT
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api', chapterRoutes); // includes /projects/:id/chapters and /chapters/:id
app.route('/api', characterRoutes); // includes /projects/:id/characters and /characters/:id
app.route('/api/ai', aiRoutes);
app.route('/api', worldbuildingRoutes); // worldbuilding & locations
app.route('/api/export', exportRoutes);
app.route('/api', outlineRoutes); // outline: /projects/:id/outline and /outline/:id
app.route('/api', timelineRoutes); // timeline: /projects/:id/timeline and /timeline/:id
app.route('/api/sync', syncRoutes); // cloud workspace sync

// Upload endpoint - returns presigned-like handling for R2
app.post('/api/upload', async (c) => {
  const userHeader = c.req.header('Authorization');
  if (!userHeader) return c.json({ error: 'Unauthorized' }, 401);

  const { verifyJWT } = await import('./lib/auth');
  const token = userHeader.replace('Bearer ', '');
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid token' }, 401);

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file) return c.json({ error: 'No file' }, 400);

    const ext = file.name.split('.').pop() || 'bin';
    const key = `uploads/${payload.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    if (c.env.R2) {
      await c.env.R2.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type }
      });
      return c.json({ url: `/api/files/${key}`, key });
    } else {
      // Local dev fallback - return fake URL
      return c.json({ url: `https://example.com/${key}`, key, note: 'R2 not configured in local dev' });
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// File serving from R2
app.get('/api/files/*', async (c) => {
  const key = c.req.path.replace('/api/files/', '');
  if (!c.env.R2) return c.json({ error: 'R2 not configured' }, 500);

  const object = await c.env.R2.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
});

// Stats
app.get('/api/stats/overview', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);
  const { verifyJWT } = await import('./lib/auth');
  const token = authHeader.replace('Bearer ', '');
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid token' }, 401);

  const db = (c as any).get('db');
  const { eq } = await import('drizzle-orm');
  const { schema } = await import('./lib/db');

  const projects = await db.select().from(schema.projects).where(eq(schema.projects.userId, payload.userId));
  
  let totalWords = 0;
  let totalChapters = 0;
  const projectIds = projects.map((p: any) => p.id);

  if (projectIds.length > 0) {
    const { inArray } = await import('drizzle-orm');
    const chs = await db.select({
      id: schema.chapters.id,
      wordCount: schema.chapters.wordCount
    }).from(schema.chapters).where(inArray(schema.chapters.projectId, projectIds));

    totalChapters = chs.length;
    totalWords = chs.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0);
  }

  return c.json({
    stats: {
      totalProjects: projects.length,
      totalWords,
      totalChapters
    }
  });
});

// 404
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;

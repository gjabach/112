import type { Context, Next } from 'hono';
import type { Env } from '../index';

export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const origin = c.req.header('Origin') || '';
  const frontendUrl = (c.env.FRONTEND_URL || '').trim();
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:3001',
    'https://novelist.pages.dev'
  ].filter(Boolean);

  const isVercelDomain = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin);
  const isAllowed = c.env.ENVIRONMENT === 'development'
    || allowedOrigins.includes(origin)
    || origin.endsWith('.pages.dev')
    || (frontendUrl && origin === frontendUrl)
    || (isVercelDomain && (frontendUrl.includes('vercel.app') || c.env.ENVIRONMENT === 'development' || allowedOrigins.some(o => o.includes('vercel.app'))));

  c.header('Vary', 'Origin');
  if (isAllowed && origin) {
    c.header('Access-Control-Allow-Origin', origin);
  } else if (!origin && c.env.ENVIRONMENT === 'development') {
    c.header('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Chapter-Lock-Token, If-Match, X-Request-Id, Accept');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
}


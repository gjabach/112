import type { Context, Next } from 'hono';
import type { Env } from '../index';

export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    c.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'https://novelist.pages.dev'
  ];

  // Allow all for dev, check in prod
  const isAllowed = c.env.ENVIRONMENT === 'development' || allowedOrigins.includes(origin) || origin.endsWith('.pages.dev');

  c.header('Access-Control-Allow-Origin', isAllowed ? origin || '*' : allowedOrigins[0]);
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
}

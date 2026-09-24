import type { Context, Next } from 'hono';
import { verifyJWT } from '../lib/auth';
import type { Env } from '../index';

export interface AuthUser {
  userId: string;
  email: string;
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user: AuthUser; db: any } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const cookieToken = c.req.header('Cookie')?.split(';').find(s => s.trim().startsWith('session='))?.split('=')[1];

  const token = authHeader?.replace('Bearer ', '') || cookieToken;

  if (!token) {
    return c.json({ error: 'Unauthorized - No token' }, 401);
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized - Invalid token' }, 401);
  }

  c.set('user', payload);
  await next();
}

export function optionalAuthMiddleware(c: Context<{ Bindings: Env; Variables: { user?: AuthUser } }>, next: Next) {
  // Try to parse token but don't fail if missing
  return (async () => {
    const authHeader = c.req.header('Authorization');
    const cookieToken = c.req.header('Cookie')?.split(';').find(s => s.trim().startsWith('session='))?.split('=')[1];
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    if (token) {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (payload) {
        c.set('user', payload);
      }
    }
    await next();
  })();
}

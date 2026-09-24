import { z } from 'zod';
import type { Context } from 'hono';

export async function validateJson<T>(c: Context, schema: z.ZodSchema<T>): Promise<{ data: T; error: null } | { data: null; error: Response }> {
  try {
    const json = await c.req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return {
        data: null,
        error: c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400) as Response
      };
    }
    return { data: parsed.data, error: null };
  } catch {
    return {
      data: null,
      error: c.json({ error: 'Invalid JSON' }, 400) as Response
    };
  }
}

export function countWords(text: string): number {
  if (!text) return 0;
  // Strip JSON if tiptap
  let plain = text;
  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object') {
      // Extract text from tiptap JSON
      plain = extractTextFromTiptap(json);
    }
  } catch {
    // not JSON, treat as plain/markdown
  }
  const words = plain.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

function extractTextFromTiptap(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractTextFromTiptap).join(' ');
  }
  return '';
}

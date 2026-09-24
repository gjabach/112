import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp || isNaN(Number(timestamp))) return 'Vừa xong';
  const now = Date.now();
  const diff = now - Number(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return formatDate(Number(timestamp));
}

export function countWords(text: string): number {
  if (!text) return 0;
  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object') {
      const plain = extractText(json);
      return plain.trim().split(/\s+/).filter(Boolean).length;
    }
  } catch {}
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractText).join(' ');
  }
  return '';
}

export function readingTime(words: number): string {
  const wpm = 200;
  const minutes = Math.ceil(words / wpm);
  if (minutes < 1) return '<1 phút đọc';
  return `${minutes} phút đọc`;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

function handleLocalApi(path: string, options: RequestInit = {}): any {
  if (typeof window === 'undefined') return {};
  const method = (options.method || 'GET').toUpperCase();
  let body: any = {};
  if (options.body) {
    try {
      body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch {}
  }
  const now = Date.now();

  const getStorage = (key: string, def: any = []) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : def;
    } catch {
      return def;
    }
  };
  const setStorage = (key: string, val: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  };

  // Auth - Register
  if (path === '/api/auth/register') {
    const users = getStorage('novelist_users', []);
    const existing = users.find((u: any) => u.email === body.email);
    if (existing) {
      throw new Error('Email đã được sử dụng');
    }
    const user = {
      id: 'usr_' + now,
      email: body.email,
      name: body.name || body.email.split('@')[0],
      createdAt: now
    };
    users.push({ ...user, password: body.password });
    setStorage('novelist_users', users);
    setStorage('novelist_current_user', user);
    return { user, token: 'token_' + user.id };
  }

  // Auth - Login
  if (path === '/api/auth/login') {
    const users = getStorage('novelist_users', []);
    const user = users.find((u: any) => u.email === body.email);
    if (!user || user.password !== body.password) {
      // Auto register for seamless experience if not found
      const newUser = {
        id: 'usr_' + now,
        email: body.email,
        name: body.email.split('@')[0],
        createdAt: now
      };
      users.push({ ...newUser, password: body.password });
      setStorage('novelist_users', users);
      setStorage('novelist_current_user', newUser);
      return { user: newUser, token: 'token_' + newUser.id };
    }
    const { password, ...safeUser } = user;
    setStorage('novelist_current_user', safeUser);
    return { user: safeUser, token: 'token_' + user.id };
  }

  // Auth - Me
  if (path === '/api/auth/me') {
    const user = getStorage('novelist_current_user', {
      id: 'usr_default',
      email: 'user@example.com',
      name: 'Tác giả'
    });
    return { user };
  }

  // Projects
  if (path === '/api/projects' && method === 'GET') {
    const raw = getStorage('novelist_projects', []);
    const sanitized = raw.map((p: any) => ({
      ...p,
      wordCount: p.wordCount ?? 0,
      chapterCount: p.chapterCount ?? 0,
      status: p.status || 'planning',
      genre: p.genre || 'fantasy',
      updatedAt: p.updatedAt || now,
      createdAt: p.createdAt || now
    }));
    return { projects: sanitized };
  }

  if (path === '/api/projects' && method === 'POST') {
    const projects = getStorage('novelist_projects', []);
    const newProj = {
      id: 'proj_' + now,
      title: body.title || 'Tiểu thuyết mới',
      subtitle: body.subtitle || '',
      description: body.description || '',
      genre: body.genre || 'fantasy',
      status: body.status || 'planning',
      wordCount: 0,
      chapterCount: 1,
      wordCountGoal: body.wordCountGoal || 50000,
      createdAt: now,
      updatedAt: now
    };
    projects.unshift(newProj);

    // Auto-create Chapter 1
    const chapters = getStorage('novelist_chapters', []);
    const firstChap = {
      id: 'chap_' + (now + 1),
      projectId: newProj.id,
      title: 'Chương 1: Mở đầu',
      orderIndex: 1,
      content: '',
      wordCount: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    };
    chapters.push(firstChap);
    setStorage('novelist_chapters', chapters);
    setStorage('novelist_projects', projects);
    return { project: newProj };
  }

  const projMatch = path.match(/^\/api\/projects\/([^\/]+)$/);
  if (projMatch) {
    const id = projMatch[1];
    const projects = getStorage('novelist_projects', []);
    if (method === 'GET') {
      const proj = projects.find((p: any) => p.id === id) || { id, title: 'Dự án', createdAt: now };
      return { project: proj };
    }
    if (method === 'PATCH') {
      const updated = projects.map((p: any) => (p.id === id ? { ...p, ...body, updatedAt: now } : p));
      setStorage('novelist_projects', updated);
      return { project: updated.find((p: any) => p.id === id) };
    }
    if (method === 'DELETE') {
      const filtered = projects.filter((p: any) => p.id !== id);
      setStorage('novelist_projects', filtered);
      return { success: true };
    }
  }

  const dupMatch = path.match(/^\/api\/projects\/([^\/]+)\/duplicate$/);
  if (dupMatch && method === 'POST') {
    const id = dupMatch[1];
    const projects = getStorage('novelist_projects', []);
    const orig = projects.find((p: any) => p.id === id);
    if (orig) {
      const cloned = { ...orig, id: 'proj_' + now, title: orig.title + ' (Bản sao)', createdAt: now, updatedAt: now };
      projects.unshift(cloned);
      setStorage('novelist_projects', projects);
      return { project: cloned };
    }
  }

  // Chapters
  const projChapMatch = path.match(/^\/api\/projects\/([^\/]+)\/chapters$/);
  if (projChapMatch) {
    const projectId = projChapMatch[1];
    const chapters = getStorage('novelist_chapters', []);
    if (method === 'GET') {
      const list = chapters
        .filter((c: any) => c.projectId === projectId)
        .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      return { chapters: list };
    }
    if (method === 'POST') {
      const newChap = {
        id: 'chap_' + now,
        projectId,
        title: body.title || 'Chương mới',
        orderIndex: body.orderIndex ?? chapters.length + 1,
        content: body.content || '',
        wordCount: 0,
        status: 'draft',
        createdAt: now,
        updatedAt: now
      };
      chapters.push(newChap);
      setStorage('novelist_chapters', chapters);
      return { chapter: newChap };
    }
  }

  const chapMatch = path.match(/^\/api\/chapters\/([^\/]+)$/);
  if (chapMatch) {
    const id = chapMatch[1];
    const chapters = getStorage('novelist_chapters', []);
    if (method === 'GET') {
      const chapter = chapters.find((c: any) => c.id === id) || { id, title: 'Chương 1', content: '', wordCount: 0 };
      return { chapter };
    }
    if (method === 'PATCH') {
      const updated = chapters.map((c: any) => (c.id === id ? { ...c, ...body, updatedAt: now } : c));
      setStorage('novelist_chapters', updated);
      return { chapter: updated.find((c: any) => c.id === id) };
    }
    if (method === 'DELETE') {
      const filtered = chapters.filter((c: any) => c.id !== id);
      setStorage('novelist_chapters', filtered);
      return { success: true };
    }
  }

  // Characters
  const projCharMatch = path.match(/^\/api\/projects\/([^\/]+)\/characters$/);
  if (projCharMatch) {
    const projectId = projCharMatch[1];
    const characters = getStorage('novelist_characters', []);
    if (method === 'GET') {
      return { characters: characters.filter((c: any) => c.projectId === projectId) };
    }
    if (method === 'POST') {
      const newChar = { id: 'char_' + now, projectId, ...body, createdAt: now, updatedAt: now };
      characters.push(newChar);
      setStorage('novelist_characters', characters);
      return { character: newChar };
    }
  }

  const charMatch = path.match(/^\/api\/characters\/([^\/]+)$/);
  if (charMatch) {
    const id = charMatch[1];
    const characters = getStorage('novelist_characters', []);
    if (method === 'PATCH') {
      const updated = characters.map((c: any) => (c.id === id ? { ...c, ...body, updatedAt: now } : c));
      setStorage('novelist_characters', updated);
      return { character: updated.find((c: any) => c.id === id) };
    }
    if (method === 'DELETE') {
      setStorage('novelist_characters', characters.filter((c: any) => c.id !== id));
      return { success: true };
    }
  }

  // Outline
  const projOutMatch = path.match(/^\/api\/projects\/([^\/]+)\/outline/);
  if (projOutMatch) {
    const projectId = projOutMatch[1];
    const nodes = getStorage('novelist_outline', []);
    if (method === 'GET') {
      return { nodes: nodes.filter((n: any) => n.projectId === projectId) };
    }
    if (method === 'POST') {
      const newNode = { id: 'node_' + now, projectId, ...body, createdAt: now };
      nodes.push(newNode);
      setStorage('novelist_outline', nodes);
      return { node: newNode };
    }
  }

  const outMatch = path.match(/^\/api\/outline\/([^\/]+)$/);
  if (outMatch) {
    const id = outMatch[1];
    const nodes = getStorage('novelist_outline', []);
    if (method === 'PATCH') {
      const updated = nodes.map((n: any) => (n.id === id ? { ...n, ...body } : n));
      setStorage('novelist_outline', updated);
      return { node: updated.find((n: any) => n.id === id) };
    }
    if (method === 'DELETE') {
      setStorage('novelist_outline', nodes.filter((n: any) => n.id !== id));
      return { success: true };
    }
  }

  // Timeline
  const projTimeMatch = path.match(/^\/api\/projects\/([^\/]+)\/timeline/);
  if (projTimeMatch) {
    const projectId = projTimeMatch[1];
    const events = getStorage('novelist_timeline', []);
    if (method === 'GET') {
      return { events: events.filter((e: any) => e.projectId === projectId) };
    }
    if (method === 'POST') {
      const newEvent = { id: 'evt_' + now, projectId, ...body, createdAt: now };
      events.push(newEvent);
      setStorage('novelist_timeline', events);
      return { event: newEvent };
    }
  }

  const timeMatch = path.match(/^\/api\/timeline\/([^\/]+)$/);
  if (timeMatch) {
    const id = timeMatch[1];
    const events = getStorage('novelist_timeline', []);
    if (method === 'PATCH') {
      const updated = events.map((e: any) => (e.id === id ? { ...e, ...body } : e));
      setStorage('novelist_timeline', updated);
      return { event: updated.find((e: any) => e.id === id) };
    }
    if (method === 'DELETE') {
      setStorage('novelist_timeline', events.filter((e: any) => e.id !== id));
      return { success: true };
    }
  }

  // Worldbuilding
  const projWorldMatch = path.match(/^\/api\/projects\/([^\/]+)\/worldbuilding/);
  if (projWorldMatch) {
    const projectId = projWorldMatch[1];
    const items = getStorage('novelist_worldbuilding', []);
    if (method === 'GET') {
      return { items: items.filter((i: any) => i.projectId === projectId) };
    }
    if (method === 'POST') {
      const newItem = { id: 'item_' + now, projectId, ...body, createdAt: now };
      items.push(newItem);
      setStorage('novelist_worldbuilding', items);
      return { item: newItem };
    }
  }

  // Export history & jobs
  if (path.includes('/export/')) {
    return { jobs: [], success: true };
  }

  return { success: true };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const isLocalApiUrl = !process.env.NEXT_PUBLIC_API_URL || API_URL.includes('localhost');

  if (isLocalApiUrl) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers as any || {}) }
      });
      if (res.ok) return await res.json();
    } catch {
      return handleLocalApi(path, options);
    }
    return handleLocalApi(path, options);
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.message?.includes('fetch') || err.name === 'TypeError') {
      return handleLocalApi(path, options);
    }
    throw err;
  }
}

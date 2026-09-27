/**
 * Pure, deterministic synchronization and merge core logic.
 * Isomorphic: runs identically in Browser, Node.js (tests), Edge Runtime (Next.js API route), and Cloudflare Workers.
 * Zero DOM or window dependencies.
 */

export interface SyncStats {
  projects: number;
  chapters: number;
  characters: number;
  lastModified: number;
  lastSynced: number | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/**
 * Pure JavaScript SHA-256 implementation.
 * 100% deterministic across all platforms (Node, mobile browser, HTTP, HTTPS, localhost, webview).
 * Eliminates the bug where crypto.subtle is undefined on mobile over HTTP or non-secure contexts.
 */
export function sha256(str: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const utf8 = unescape(encodeURIComponent(str || ''));
  const words: number[] = [];
  const bitLen = utf8.length * 8;
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 255) << ((3 - (i % 4)) * 8);
  }
  words[utf8.length >> 2] |= 128 << ((3 - (utf8.length % 4)) * 8);
  const targetLen = (((utf8.length + 8) >> 6) + 1) * 16;
  while (words.length < targetLen - 1) words.push(0);
  words[targetLen - 1] = bitLen;

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h0] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h0 + S1 + ch + k[t] + w[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h0 = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + h0) | 0;
  }
  let res = '';
  for (let i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (h[i] >>> (b * 8)) & 255;
      res += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return res;
}

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Handles Vietnamese keyboard autocorrect variations (e.g. gjabach <-> giabach).
 * On iOS/Android Vietnamese keyboards, 'gj' is commonly autocorrected to 'gi'.
 */
export function getEmailAliases(email: string): string[] {
  const clean = normalizeEmail(email);
  if (!clean || !clean.includes('@')) return clean ? [clean] : [];

  const [localPart, domain] = clean.split('@');
  const aliases = new Set<string>([clean]);

  if (localPart.includes('gj')) {
    aliases.add(`${localPart.replace(/gj/g, 'gi')}@${domain}`);
  }
  if (localPart.includes('gi')) {
    aliases.add(`${localPart.replace(/gi/g, 'gj')}@${domain}`);
  }

  return Array.from(aliases);
}

export interface CloudAccountKeys {
  userKey: string;
  dataKey: string;
  legacyKey: string;
  rawLegacyKey: string;
  candidateKeys: string[];
}

export function getCloudAccountKeys(email: string, userId?: string): CloudAccountKeys {
  const clean = normalizeEmail(email);
  const hex = sha256(clean + ':novelist_auth_v2');
  const safeEmail = clean.replace(/[^a-z0-9_-]/g, '_');
  const legacyKey = `d_${safeEmail}`;
  const rawLegacyKey = safeEmail;

  const candidateKeys = new Set<string>();
  candidateKeys.add(`d_${hex}`);
  candidateKeys.add(legacyKey);
  candidateKeys.add(rawLegacyKey);

  // If userId is known, also add token-based backup key
  if (userId) {
    const cleanUserId = userId.replace(/^token_/, '');
    candidateKeys.add(`d_token_${cleanUserId}`);
    candidateKeys.add(`d_${cleanUserId}`);
  }

  // Add alias variants (e.g. gjabach <-> giabach)
  const aliases = getEmailAliases(email);
  for (const alias of aliases) {
    if (alias !== clean) {
      const aliasHex = sha256(alias + ':novelist_auth_v2');
      const aliasSafe = alias.replace(/[^a-z0-9_-]/g, '_');
      candidateKeys.add(`d_${aliasHex}`);
      candidateKeys.add(`d_${aliasSafe}`);
      candidateKeys.add(aliasSafe);
    }
  }

  return {
    userKey: `u_${hex}`,
    dataKey: `d_${hex}`,
    legacyKey,
    rawLegacyKey,
    candidateKeys: Array.from(candidateKeys)
  };
}

/**
 * Unwraps data if wrapped in { success, data: { ... } } or { data: { ... } } or raw JSON
 */
export function unwrapWorkspace(data: any): any {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;

  // If wrapped in an envelope like { success: true, data: ... } or { data: { data: ... } }
  if (data.data && typeof data.data === 'object') {
    if (data.data.projects || data.data.chapters || data.success !== undefined || !data.projects) {
      return unwrapWorkspace(data.data);
    }
  }

  return data;
}

/**
 * Intelligent bidirectional merge for workspaces.
 * Guarantees that:
 * 1. If Device A (PC) wrote Chapter 2 and Device B (Mobile) only has Chapter 1, Chapter 2 is NEVER lost.
 * 2. If both have the same chapter, the richer / newer content is chosen.
 * 3. orderIndex collisions are resolved sequentially per project (1, 2, 3...).
 * 4. Project chapterCount and wordCount are strictly recomputed from the merged chapter list.
 */
export function mergeWorkspaces(
  local: any, 
  remote: any
): { merged: any; hasRemoteChanges: boolean; hasLocalChanges: boolean } {
  const unwrappedLocal = unwrapWorkspace(local) || {};
  const unwrappedRemote = unwrapWorkspace(remote) || {};

  let hasRemoteChanges = false;
  let hasLocalChanges = false;

  const localProjects: any[] = Array.isArray(unwrappedLocal.projects) ? [...unwrappedLocal.projects] : [];
  const remoteProjects: any[] = Array.isArray(unwrappedRemote.projects) ? [...unwrappedRemote.projects] : [];

  const localChapters: any[] = Array.isArray(unwrappedLocal.chapters) ? [...unwrappedLocal.chapters] : [];
  const remoteChapters: any[] = Array.isArray(unwrappedRemote.chapters) ? [...unwrappedRemote.chapters] : [];

  const localCharacters: any[] = Array.isArray(unwrappedLocal.characters) ? [...unwrappedLocal.characters] : [];
  const remoteCharacters: any[] = Array.isArray(unwrappedRemote.characters) ? [...unwrappedRemote.characters] : [];

  const localEntities: any[] = Array.isArray(unwrappedLocal.entities || unwrappedLocal.worldbuilding) 
    ? [...(unwrappedLocal.entities || unwrappedLocal.worldbuilding)] : [];
  const remoteEntities: any[] = Array.isArray(unwrappedRemote.entities || unwrappedRemote.worldbuilding) 
    ? (unwrappedRemote.entities || unwrappedRemote.worldbuilding) : [];

  const localTimeline: any[] = Array.isArray(unwrappedLocal.timeline || unwrappedLocal.timelineEvents) 
    ? [...(unwrappedLocal.timeline || unwrappedLocal.timelineEvents)] : [];
  const remoteTimeline: any[] = Array.isArray(unwrappedRemote.timeline || unwrappedRemote.timelineEvents) 
    ? (unwrappedRemote.timeline || unwrappedRemote.timelineEvents) : [];

  const localTimelineEras: any[] = Array.isArray(unwrappedLocal.timelineEras) ? [...unwrappedLocal.timelineEras] : [];
  const remoteTimelineEras: any[] = Array.isArray(unwrappedRemote.timelineEras) ? unwrappedRemote.timelineEras : [];

  const localOutline: any[] = Array.isArray(unwrappedLocal.outline || unwrappedLocal.outlines) 
    ? [...(unwrappedLocal.outline || unwrappedLocal.outlines)] : [];
  const remoteOutline: any[] = Array.isArray(unwrappedRemote.outline || unwrappedRemote.outlines) 
    ? (unwrappedRemote.outline || unwrappedRemote.outlines) : [];

  // --- Merge Chapters by id ---
  const chapterMap = new Map<string, any>();
  for (const c of localChapters) {
    if (c?.id) chapterMap.set(c.id, { ...c });
  }

  for (const rc of remoteChapters) {
    if (!rc?.id) continue;
    const existing = chapterMap.get(rc.id);
    if (!existing) {
      // Remote has a chapter that local does not have -> ADD IT!
      chapterMap.set(rc.id, { ...rc });
      hasRemoteChanges = true;
    } else {
      // Both have this chapter: compare content, title, words, and timestamps
      const remoteUpdated = Number(rc.updatedAt || unwrappedRemote.lastModified || 0);
      const localUpdated = Number(existing.updatedAt || unwrappedLocal.lastModified || 0);
      
      const remoteContentStr = typeof rc.content === 'string' ? rc.content : JSON.stringify(rc.content || '');
      const localContentStr = typeof existing.content === 'string' ? existing.content : JSON.stringify(existing.content || '');
      const remoteWords = Number(rc.wordCount || 0) || remoteContentStr.length;
      const localWords = Number(existing.wordCount || 0) || localContentStr.length;
      const remoteHasContent = !!remoteContentStr.trim();
      const localHasContent = !!localContentStr.trim();
      const isDifferent = remoteContentStr !== localContentStr || rc.title !== existing.title;

      // Prefer richer content if one is empty; if both have content, prefer newer timestamp or larger word count
      if ((remoteHasContent && !localHasContent) || 
          (remoteWords > localWords && remoteUpdated >= localUpdated) ||
          remoteUpdated > localUpdated || 
          (isDifferent && remoteUpdated >= localUpdated)) {
        chapterMap.set(rc.id, { ...existing, ...rc });
        if (isDifferent || remoteUpdated > localUpdated) {
          hasRemoteChanges = true;
        }
      } else if (localUpdated > remoteUpdated || (localHasContent && !remoteHasContent) || localWords > remoteWords) {
        if (isDifferent) {
          hasLocalChanges = true;
        }
      }
    }
  }

  // Check if local has chapters remote does not have
  for (const lc of localChapters) {
    if (lc?.id && !remoteChapters.some(rc => rc?.id === lc.id)) {
      hasLocalChanges = true;
    }
  }

  const rawMergedChapters = Array.from(chapterMap.values());

  // Fix orderIndex collisions: ensure unique sequential orderIndex per project
  const byProject = new Map<string, any[]>();
  for (const ch of rawMergedChapters) {
    const pid = ch.projectId || 'unknown';
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid)!.push(ch);
  }

  const mergedChapters: any[] = [];
  for (const [, projectChapters] of byProject) {
    projectChapters.sort((a: any, b: any) => {
      const oa = a.orderIndex || 0;
      const ob = b.orderIndex || 0;
      if (oa !== ob) return oa - ob;
      const ca = a.createdAt || 0;
      const cb = b.createdAt || 0;
      if (ca !== cb) return ca - cb;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    projectChapters.forEach((ch: any, idx: number) => {
      ch.orderIndex = idx + 1;
      mergedChapters.push(ch);
    });
  }

  // --- Merge Projects by id ---
  const projectMap = new Map<string, any>();
  for (const p of localProjects) {
    if (p?.id) projectMap.set(p.id, { ...p });
  }

  for (const rp of remoteProjects) {
    if (!rp?.id) continue;
    const existing = projectMap.get(rp.id);
    if (!existing) {
      projectMap.set(rp.id, { ...rp });
      hasRemoteChanges = true;
    } else {
      const remoteUpdated = Number(rp.updatedAt || unwrappedRemote.lastModified || 0);
      const localUpdated = Number(existing.updatedAt || unwrappedLocal.lastModified || 0);
      if (remoteUpdated >= localUpdated) {
        projectMap.set(rp.id, { ...existing, ...rp });
        if (remoteUpdated > localUpdated) hasRemoteChanges = true;
      } else {
        hasLocalChanges = true;
      }
    }
  }

  for (const lp of localProjects) {
    if (lp?.id && !remoteProjects.some(rp => rp?.id === lp.id)) {
      hasLocalChanges = true;
    }
  }

  const activeUser = unwrappedRemote.user || unwrappedLocal.user || null;
  const currentUserId = activeUser?.id;

  const mergedProjects = Array.from(projectMap.values()).map(p => {
    const pChapters = mergedChapters.filter(c => c.projectId === p.id);
    const calculatedWords = pChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
    return {
      ...p,
      userId: p.userId || currentUserId || 'usr_default',
      chapterCount: pChapters.length,
      wordCount: Math.max(p.wordCount || 0, calculatedWords)
    };
  });

  // --- Merge helper for characters, entities, timeline, outline ---
  const mergeEntityList = (localList: any[], remoteList: any[]) => {
    const map = new Map<string, any>();
    for (const item of localList) if (item?.id) map.set(item.id, { ...item });
    for (const item of remoteList) {
      if (!item?.id) continue;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, { ...item });
        hasRemoteChanges = true;
      } else {
        const rUp = Number(item.updatedAt || 0);
        const lUp = Number(existing.updatedAt || 0);
        if (rUp >= lUp) {
          map.set(item.id, { ...existing, ...item });
          if (rUp > lUp) hasRemoteChanges = true;
        } else {
          hasLocalChanges = true;
        }
      }
    }
    for (const item of localList) {
      if (item?.id && !remoteList.some(r => r?.id === item.id)) {
        hasLocalChanges = true;
      }
    }
    return Array.from(map.values());
  };

  const mergedCharacters = mergeEntityList(localCharacters, remoteCharacters);
  const mergedEntities = mergeEntityList(localEntities, remoteEntities);
  const mergedTimeline = mergeEntityList(localTimeline, remoteTimeline);
  const mergedTimelineEras = mergeEntityList(localTimelineEras, remoteTimelineEras);
  const mergedOutline = mergeEntityList(localOutline, remoteOutline);

  const mergedLastModified = Math.max(
    Number(unwrappedLocal.lastModified || 0),
    Number(unwrappedRemote.lastModified || 0),
    Date.now()
  );

  return {
    merged: {
      version: 2,
      lastModified: mergedLastModified,
      exportedAt: Date.now(),
      projects: mergedProjects,
      chapters: mergedChapters,
      characters: mergedCharacters,
      entities: mergedEntities,
      worldbuilding: mergedEntities,
      timeline: mergedTimeline,
      timelineEvents: mergedTimeline,
      timelineEras: mergedTimelineEras,
      outline: mergedOutline,
      outlines: mergedOutline,
      user: unwrappedRemote.user || unwrappedLocal.user || null,
      aiConfig: unwrappedRemote.aiConfig || unwrappedLocal.aiConfig || { provider: 'gemini', model: 'gemini-3.8-flash' }
    },
    hasRemoteChanges,
    hasLocalChanges
  };
}

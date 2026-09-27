/**
 * Cloudflare Pages Functions API route for /api/sync
 * Provides same-origin synchronization API on Cloudflare Pages deployments (pages.dev).
 * Bypasses Brave Shields, AdBlockers, and CORS restrictions on mobile browsers.
 */

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(str: string): string {
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

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function getCloudAccountKeys(email: string, userId?: string) {
  const clean = normalizeEmail(email);
  const hex = sha256(clean + ':novelist_auth_v2');
  const safeEmail = clean.replace(/[^a-z0-9_-]/g, '_');
  const legacyKey = `d_${safeEmail}`;
  const rawLegacyKey = safeEmail;

  const candidateKeys = new Set<string>();
  candidateKeys.add(`d_${hex}`);
  candidateKeys.add(legacyKey);
  candidateKeys.add(rawLegacyKey);

  if (userId) {
    const cleanUserId = userId.replace(/^token_/, '');
    candidateKeys.add(`d_token_${cleanUserId}`);
    candidateKeys.add(`d_${cleanUserId}`);
  }

  return {
    userKey: `u_${hex}`,
    dataKey: `d_${hex}`,
    legacyKey,
    rawLegacyKey,
    candidateKeys: Array.from(candidateKeys)
  };
}

function unwrapWorkspace(data: any): any {
  if (!data) return null;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return null; }
  }
  if (!data || typeof data !== 'object') return null;
  if (data.data && typeof data.data === 'object') {
    if (data.data.projects || data.data.chapters || data.success !== undefined || !data.projects) {
      return unwrapWorkspace(data.data);
    }
  }
  return data;
}

function mergeWorkspaces(local: any, remote: any) {
  const unwrappedLocal = unwrapWorkspace(local) || {};
  const unwrappedRemote = unwrapWorkspace(remote) || {};

  let hasRemoteChanges = false;
  let hasLocalChanges = false;

  const localProjects: any[] = Array.isArray(unwrappedLocal.projects) ? [...unwrappedLocal.projects] : [];
  const remoteProjects: any[] = Array.isArray(unwrappedRemote.projects) ? [...unwrappedRemote.projects] : [];
  const localChapters: any[] = Array.isArray(unwrappedLocal.chapters) ? [...unwrappedLocal.chapters] : [];
  const remoteChapters: any[] = Array.isArray(unwrappedRemote.chapters) ? [...unwrappedRemote.chapters] : [];

  const chapterMap = new Map<string, any>();
  for (const c of localChapters) {
    if (c?.id) chapterMap.set(c.id, { ...c });
  }

  for (const rc of remoteChapters) {
    if (!rc?.id) continue;
    const existing = chapterMap.get(rc.id);
    if (!existing) {
      chapterMap.set(rc.id, { ...rc });
      hasRemoteChanges = true;
    } else {
      const remoteUpdated = Number(rc.updatedAt || unwrappedRemote.lastModified || 0);
      const localUpdated = Number(existing.updatedAt || unwrappedLocal.lastModified || 0);
      const remoteContentStr = typeof rc.content === 'string' ? rc.content : JSON.stringify(rc.content || '');
      const localContentStr = typeof existing.content === 'string' ? existing.content : JSON.stringify(existing.content || '');
      const remoteWords = Number(rc.wordCount || 0) || remoteContentStr.length;
      const localWords = Number(existing.wordCount || 0) || localContentStr.length;
      const remoteHasContent = !!remoteContentStr.trim();
      const localHasContent = !!localContentStr.trim();
      const isDifferent = remoteContentStr !== localContentStr || rc.title !== existing.title;

      if (!localHasContent && remoteHasContent) {
        chapterMap.set(rc.id, { ...existing, ...rc });
        hasRemoteChanges = true;
      } else if (localHasContent && !remoteHasContent) {
        hasLocalChanges = true;
      } else {
        if (remoteWords > localWords) {
          chapterMap.set(rc.id, { ...existing, ...rc });
          hasRemoteChanges = true;
        } else if (localWords > remoteWords) {
          hasLocalChanges = true;
        } else {
          if (remoteUpdated > localUpdated || (isDifferent && remoteUpdated >= localUpdated)) {
            chapterMap.set(rc.id, { ...existing, ...rc });
            if (isDifferent) hasRemoteChanges = true;
          } else if (localUpdated > remoteUpdated) {
            if (isDifferent) hasLocalChanges = true;
          }
        }
      }
    }
  }

  for (const lc of localChapters) {
    if (lc?.id && !remoteChapters.some(rc => rc?.id === lc.id)) {
      hasLocalChanges = true;
    }
  }

  const rawMergedChapters = Array.from(chapterMap.values());
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

  const projectMap = new Map<string, any>();
  for (const p of localProjects) if (p?.id) projectMap.set(p.id, { ...p });
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

  const activeUser = unwrappedRemote.user || unwrappedLocal.user || null;
  const currentUserId = activeUser?.id;

  const mergedProjects = Array.from(projectMap.values()).map(p => {
    const pChapters = mergedChapters.filter(c => c.projectId === p.id);
    const calculatedWords = pChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
    return {
      ...p,
      userId: p.userId || currentUserId || 'usr_default',
      chapterCount: (localChapters.length > 0 || remoteChapters.length > 0) ? pChapters.length : (p.chapterCount || pChapters.length),
      wordCount: Math.max(p.wordCount || 0, calculatedWords)
    };
  });

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
      characters: unwrappedRemote.characters || unwrappedLocal.characters || [],
      entities: unwrappedRemote.entities || unwrappedLocal.entities || [],
      worldbuilding: unwrappedRemote.worldbuilding || unwrappedLocal.worldbuilding || [],
      timeline: unwrappedRemote.timeline || unwrappedLocal.timeline || [],
      timelineEvents: unwrappedRemote.timelineEvents || unwrappedLocal.timelineEvents || [],
      timelineEras: unwrappedRemote.timelineEras || unwrappedLocal.timelineEras || [],
      outline: unwrappedRemote.outline || unwrappedLocal.outline || [],
      outlines: unwrappedRemote.outlines || unwrappedLocal.outlines || [],
      user: unwrappedRemote.user || unwrappedLocal.user || null,
      aiConfig: unwrappedRemote.aiConfig || unwrappedLocal.aiConfig || { provider: 'gemini', model: 'gemini-3.8-flash' }
    },
    hasRemoteChanges,
    hasLocalChanges
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('key') || url.searchParams.get('dataKey') || '';
    const queryEmail = normalizeEmail(url.searchParams.get('email') || '');
    const authHeader = request.headers.get('Authorization') || '';
    const tokenIdentifier = authHeader ? authHeader.replace(/^Bearer\s+/i, '').slice(-32) : '';

    if (!queryKey && !queryEmail && !tokenIdentifier) {
      return new Response(JSON.stringify({ success: false, error: 'Yêu cầu đăng nhập hoặc cung cấp khóa' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const candidateKeys = new Set<string>();
    if (queryKey) {
      candidateKeys.add(queryKey.startsWith('d_') ? queryKey : `d_${queryKey}`);
      candidateKeys.add(queryKey.replace(/^d_/, ''));
    }
    if (queryEmail) {
      const keys = getCloudAccountKeys(queryEmail, tokenIdentifier || undefined);
      keys.candidateKeys.forEach(k => candidateKeys.add(k));
    }
    if (tokenIdentifier) {
      candidateKeys.add(`d_token_${tokenIdentifier}`);
      candidateKeys.add(`d_${tokenIdentifier}`);
    }

    const fetchedCandidates: any[] = [];
    const fetchPromises = Array.from(candidateKeys).map(async (k) => {
      try {
        const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 2) {
            const parsed = JSON.parse(text);
            const unwrapped = unwrapWorkspace(parsed);
            if (unwrapped) fetchedCandidates.push(unwrapped);
          }
        }
      } catch {}
    });

    await Promise.allSettled(fetchPromises);

    if (fetchedCandidates.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        lastModified: 0,
        data: null,
        message: 'Chưa có bản đồng bộ nào cho tài khoản này'
      }), { headers: corsHeaders });
    }

    let unifiedRemote = fetchedCandidates[0];
    for (let i = 1; i < fetchedCandidates.length; i++) {
      const { merged } = mergeWorkspaces(unifiedRemote, fetchedCandidates[i]);
      unifiedRemote = merged;
    }

    return new Response(JSON.stringify({
      success: true,
      lastModified: unifiedRemote.lastModified || Date.now(),
      data: unifiedRemote,
      source: 'cloudflare-pages-function'
    }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost({ request }: { request: Request }) {
  try {
    const body: any = await request.json();
    const data = body.data;
    const bodyKey = body.dataKey || body.key;
    const authHeader = request.headers.get('Authorization') || '';
    const tokenIdentifier = authHeader ? authHeader.replace(/^Bearer\s+/i, '').slice(-32) : '';

    if (!bodyKey && !tokenIdentifier) {
      return new Response(JSON.stringify({ success: false, error: 'Yêu cầu đăng nhập hoặc cung cấp khóa' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    if (!data || typeof data !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Dữ liệu không hợp lệ' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const email = normalizeEmail(data?.user?.email || (typeof body?.email === 'string' ? body.email : ''));
    const cloudKeys = email ? getCloudAccountKeys(email, tokenIdentifier || undefined) : null;
    const rawKey = bodyKey || tokenIdentifier;
    const targetKey = rawKey.startsWith('d_') ? rawKey : `d_${rawKey}`;
    const now = Date.now();

    let existingCloudData: any = null;
    const keysToCheck = cloudKeys ? cloudKeys.candidateKeys : [targetKey];
    for (const k of keysToCheck) {
      try {
        const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 2) {
            existingCloudData = unwrapWorkspace(JSON.parse(text));
            if (existingCloudData) break;
          }
        }
      } catch {}
    }

    let finalDataToStore = data;
    if (existingCloudData) {
      const { merged } = mergeWorkspaces(existingCloudData, data);
      finalDataToStore = merged;
    }

    finalDataToStore.lastModified = Math.max(Number(data.lastModified || 0), Number(existingCloudData?.lastModified || 0), now);
    finalDataToStore.syncedAt = now;

    const targetKeysToPersist = new Set<string>();
    targetKeysToPersist.add(targetKey);
    if (cloudKeys) {
      targetKeysToPersist.add(cloudKeys.dataKey);
      targetKeysToPersist.add(cloudKeys.legacyKey);
      targetKeysToPersist.add(cloudKeys.rawLegacyKey);
    }
    if (tokenIdentifier) {
      targetKeysToPersist.add(`d_token_${tokenIdentifier}`);
      targetKeysToPersist.add(`d_${tokenIdentifier}`);
    }

    const payloadStr = JSON.stringify(finalDataToStore);
    const putPromises = Array.from(targetKeysToPersist).map(k =>
      fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr
      }).catch(() => {})
    );
    await Promise.allSettled(putPromises);

    return new Response(JSON.stringify({
      success: true,
      key: targetKey,
      lastModified: finalDataToStore.lastModified,
      syncedAt: now,
      data: finalDataToStore
    }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
}

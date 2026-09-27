'use client';

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

export function getUserEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    const userStr = localStorage.getItem('novelist_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.email) return user.email.trim().toLowerCase();
    }
    const authStr = localStorage.getItem('auth-storage');
    if (authStr) {
      const auth = JSON.parse(authStr);
      if (auth.state?.user?.email) return auth.state.user.email.trim().toLowerCase();
    }
    const remEmail = localStorage.getItem('novelist_remember_email');
    if (remEmail && remEmail.includes('@')) {
      return remEmail.trim().toLowerCase();
    }
    const savedKey = localStorage.getItem('novelist_sync_key');
    if (savedKey && savedKey.includes('@')) {
      return savedKey.trim().toLowerCase();
    }
  } catch {}
  return '';
}

export function getCloudAccountKeys(email: string) {
  const clean = (email || '').trim().toLowerCase();
  const hex = sha256(clean + ':novelist_auth_v2');
  const legacyKey = clean.replace(/[^a-z0-9_-]/g, '_');
  return { 
    userKey: `u_${hex}`, 
    dataKey: `d_${hex}`,
    legacyKey
  };
}

export function getSyncKey(): string {
  if (typeof window === 'undefined') return 'default_user';
  const email = getUserEmail();
  if (email) return email.replace(/[^a-z0-9_-]/g, '_');
  const saved = localStorage.getItem('novelist_sync_key');
  if (saved && saved.trim()) return saved.trim();
  return 'default_user';
}

export function setSyncKey(newKey: string): string {
  if (typeof window === 'undefined') return newKey;
  const clean = (newKey || 'default_user').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  localStorage.setItem('novelist_sync_key', clean);
  return clean;
}

export function isAutoSyncEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('novelist_auto_sync') !== 'false';
}

export function setAutoSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('novelist_auto_sync', enabled ? 'true' : 'false');
}

function getStoredJson(key: string, fallback: any = []) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function exportFullWorkspace() {
  if (typeof window === 'undefined') return null;
  const lastModifiedStr = localStorage.getItem('novelist_last_modified');
  const lastModified = lastModifiedStr ? parseInt(lastModifiedStr, 10) : Date.now();

  return {
    version: 2,
    lastModified,
    exportedAt: Date.now(),
    projects: getStoredJson('novelist_projects', []),
    chapters: getStoredJson('novelist_chapters', []),
    characters: getStoredJson('novelist_characters', []),
    entities: getStoredJson('novelist_worldbuilding', getStoredJson('novelist_entities', [])),
    timeline: getStoredJson('novelist_timeline', getStoredJson('novelist_timeline_events', [])),
    timelineEras: getStoredJson('novelist_timeline_eras', []),
    outline: getStoredJson('novelist_outline', getStoredJson('novelist_outlines', [])),
    user: getStoredJson('novelist_current_user', null),
    aiConfig: {
      provider: localStorage.getItem('ai_provider') || 'gemini',
      model: localStorage.getItem('ai_model') || 'gemini-3.8-flash'
    }
  };
}

/**
 * Smart two-way merge for projects, chapters, characters, worldbuilding, timeline, and outline.
 * Ensures that if PC wrote Chapter 2 and Mobile only has Chapter 1, Chapter 2 is ADDED,
 * and neither device's work is ever deleted or overwritten.
 */
export function mergeWorkspaces(local: any, remote: any): { merged: any; hasRemoteChanges: boolean; hasLocalChanges: boolean } {
  // Unwrap remote data if wrapped in { success, data: { ... } } or similar
  const unwrappedRemote = (remote && remote.data && typeof remote.data === 'object' && (remote.data.projects || remote.data.chapters))
    ? remote.data
    : (remote || {});

  const localObj = local || {};
  let hasRemoteChanges = false;
  let hasLocalChanges = false;

  const localProjects: any[] = Array.isArray(localObj.projects) ? [...localObj.projects] : [];
  const remoteProjects: any[] = Array.isArray(unwrappedRemote.projects) ? unwrappedRemote.projects : [];

  const localChapters: any[] = Array.isArray(localObj.chapters) ? [...localObj.chapters] : [];
  const remoteChapters: any[] = Array.isArray(unwrappedRemote.chapters) ? unwrappedRemote.chapters : [];

  const localCharacters: any[] = Array.isArray(localObj.characters) ? [...localObj.characters] : [];
  const remoteCharacters: any[] = Array.isArray(unwrappedRemote.characters) ? unwrappedRemote.characters : [];

  const localEntities: any[] = Array.isArray(localObj.entities || localObj.worldbuilding) ? [...(localObj.entities || localObj.worldbuilding)] : [];
  const remoteEntities: any[] = Array.isArray(unwrappedRemote.entities || unwrappedRemote.worldbuilding) ? (unwrappedRemote.entities || unwrappedRemote.worldbuilding) : [];

  const localTimeline: any[] = Array.isArray(localObj.timeline || localObj.timelineEvents) ? [...(localObj.timeline || localObj.timelineEvents)] : [];
  const remoteTimeline: any[] = Array.isArray(unwrappedRemote.timeline || unwrappedRemote.timelineEvents) ? (unwrappedRemote.timeline || unwrappedRemote.timelineEvents) : [];

  const localTimelineEras: any[] = Array.isArray(localObj.timelineEras) ? [...localObj.timelineEras] : [];
  const remoteTimelineEras: any[] = Array.isArray(unwrappedRemote.timelineEras) ? unwrappedRemote.timelineEras : [];

  const localOutline: any[] = Array.isArray(localObj.outline || localObj.outlines) ? [...(localObj.outline || localObj.outlines)] : [];
  const remoteOutline: any[] = Array.isArray(unwrappedRemote.outline || unwrappedRemote.outlines) ? (unwrappedRemote.outline || unwrappedRemote.outlines) : [];

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
      // Both have this chapter: take newer updatedAt or non-empty content
      const remoteUpdated = rc.updatedAt || unwrappedRemote.lastModified || 0;
      const localUpdated = existing.updatedAt || localObj.lastModified || 0;
      
      const remoteHasContent = !!(rc.content && (typeof rc.content === 'string' ? rc.content.trim() : Object.keys(rc.content).length > 0));
      const localHasContent = !!(existing.content && (typeof existing.content === 'string' ? existing.content.trim() : Object.keys(existing.content).length > 0));

      if ((remoteHasContent && !localHasContent) || remoteUpdated > localUpdated) {
        chapterMap.set(rc.id, { ...existing, ...rc });
        hasRemoteChanges = true;
      } else if (localUpdated > remoteUpdated || (localHasContent && !remoteHasContent)) {
        hasLocalChanges = true;
      }
    }
  }

  // Check if local has chapters remote does not have
  for (const lc of localChapters) {
    if (lc?.id && !remoteChapters.some(rc => rc?.id === lc.id)) {
      hasLocalChanges = true;
    }
  }

  const mergedChapters = Array.from(chapterMap.values()).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

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
      const remoteUpdated = rp.updatedAt || unwrappedRemote.lastModified || 0;
      const localUpdated = existing.updatedAt || localObj.lastModified || 0;
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

  const currentUser = getStoredJson('novelist_current_user', null);
  const currentUserId = currentUser?.id;

  const mergedProjects = Array.from(projectMap.values()).map(p => {
    const pChapters = mergedChapters.filter(c => c.projectId === p.id);
    const wordCount = pChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
    return {
      ...p,
      // Ensure userId is valid so it shows up for the active author
      userId: p.userId || currentUserId || 'usr_default',
      chapterCount: pChapters.length,
      wordCount: Math.max(p.wordCount || 0, wordCount)
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
        const rUp = item.updatedAt || 0;
        const lUp = existing.updatedAt || 0;
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
    localObj.lastModified || 0,
    unwrappedRemote.lastModified || 0,
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
      user: unwrappedRemote.user || localObj.user || null,
      aiConfig: unwrappedRemote.aiConfig || localObj.aiConfig || { provider: 'gemini', model: 'gemini-3.8-flash' }
    },
    hasRemoteChanges,
    hasLocalChanges
  };
}

export function importFullWorkspace(data: any, merge: boolean = true): boolean {
  if (typeof window === 'undefined' || !data || typeof data !== 'object') return false;

  try {
    let finalData = data;
    if (merge) {
      const local = exportFullWorkspace();
      const { merged } = mergeWorkspaces(local, data);
      finalData = merged;
    }

    if (Array.isArray(finalData.projects)) {
      localStorage.setItem('novelist_projects', JSON.stringify(finalData.projects));
    }
    if (Array.isArray(finalData.chapters)) {
      localStorage.setItem('novelist_chapters', JSON.stringify(finalData.chapters));
    }
    if (Array.isArray(finalData.characters)) {
      localStorage.setItem('novelist_characters', JSON.stringify(finalData.characters));
    }

    const entities = finalData.entities || finalData.worldbuilding;
    if (Array.isArray(entities)) {
      localStorage.setItem('novelist_worldbuilding', JSON.stringify(entities));
      localStorage.setItem('novelist_entities', JSON.stringify(entities));
    }

    const timeline = finalData.timeline || finalData.timelineEvents;
    if (Array.isArray(timeline)) {
      localStorage.setItem('novelist_timeline', JSON.stringify(timeline));
      localStorage.setItem('novelist_timeline_events', JSON.stringify(timeline));
    }

    if (Array.isArray(finalData.timelineEras)) {
      localStorage.setItem('novelist_timeline_eras', JSON.stringify(finalData.timelineEras));
    }

    const outline = finalData.outline || finalData.outlines;
    if (outline) {
      localStorage.setItem('novelist_outline', JSON.stringify(outline));
      localStorage.setItem('novelist_outlines', JSON.stringify(outline));
    }

    if (finalData.user) {
      localStorage.setItem('novelist_current_user', JSON.stringify(finalData.user));
    }

    if (finalData.aiConfig) {
      if (finalData.aiConfig.provider) localStorage.setItem('ai_provider', finalData.aiConfig.provider);
      if (finalData.aiConfig.model) localStorage.setItem('ai_model', finalData.aiConfig.model);
    }

    if (finalData.lastModified) {
      localStorage.setItem('novelist_last_modified', String(finalData.lastModified));
    }
    localStorage.setItem('novelist_last_synced', String(Date.now()));

    // Notify active UI components across the application
    window.dispatchEvent(new CustomEvent('novelist-sync-updated', { detail: { data: finalData } }));
    return true;
  } catch (err) {
    console.error('Failed to import workspace:', err);
    return false;
  }
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function broadcastSyncStatus(status: SyncStatus, message?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('novelist-sync-status', { 
    detail: { status, message, timestamp: Date.now() } 
  }));
}

export async function pushSync(): Promise<{ success: boolean; stats?: any; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };

  try {
    const workspace = exportFullWorkspace();
    if (!workspace) return { success: false, error: 'No data to sync' };

    const email = getUserEmail();
    const token = getAuthToken();
    const { dataKey, legacyKey } = email ? getCloudAccountKeys(email) : { dataKey: 'd_default_user', legacyKey: 'default_user' };

    broadcastSyncStatus('syncing', 'Đang lưu lên đám mây...');

    // 1. Try local/configured API endpoint if token available
    if (token) {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            key: dataKey,
            dataKey: dataKey,
            lastModified: workspace.lastModified,
            data: workspace
          }),
          keepalive: true
        });
      } catch {}
    }

    // 2. Persist to account cloud store for seamless multi-device access (PC <-> Mobile)
    if (email && email.includes('@')) {
      try {
        await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${dataKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workspace),
          keepalive: true
        });
      } catch (err) {
        // Fallback to legacy key if needed
        try {
          await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${legacyKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workspace),
            keepalive: true
          });
        } catch {}
      }
    }

    localStorage.setItem('novelist_last_synced', String(Date.now()));
    broadcastSyncStatus('synced', 'Đã lưu đám mây an toàn');

    return {
      success: true,
      stats: {
        projects: workspace.projects?.length || 0,
        chapters: workspace.chapters?.length || 0,
        characters: workspace.characters?.length || 0
      }
    };
  } catch (err: any) {
    broadcastSyncStatus('error', err.message || 'Lỗi lưu đám mây');
    return { success: false, error: err.message || 'Lỗi mạng khi lưu đám mây' };
  }
}

export async function pullSync(force: boolean = false): Promise<{ success: boolean; updated: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, updated: false, error: 'Not in browser' };

  try {
    const email = getUserEmail();
    if (!email || !email.includes('@')) {
      return { success: true, updated: false };
    }

    broadcastSyncStatus('syncing', 'Đang kiểm tra cập nhật đám mây...');

    let remoteData: any = null;
    const { dataKey, legacyKey } = getCloudAccountKeys(email);

    // 1. Try cloud store for latest multi-device workspace
    try {
      const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${dataKey}`);
      if (res.ok) {
        remoteData = await res.json();
      }
    } catch {}

    // Fallback to legacy key if primary returned nothing
    if (!remoteData) {
      try {
        const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${legacyKey}`);
        if (res.ok) {
          remoteData = await res.json();
        }
      } catch {}
    }

    // 2. Try server API if not found or in addition
    if (!remoteData) {
      const token = getAuthToken();
      if (token) {
        try {
          const res = await fetch(`/api/sync?key=${encodeURIComponent(dataKey)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) remoteData = json.data;
          }
        } catch {}
      }
    }

    if (!remoteData || typeof remoteData !== 'object') {
      broadcastSyncStatus('synced', 'Dữ liệu mới nhất');
      return { success: true, updated: false };
    }

    // Smart two-way merge
    const local = exportFullWorkspace();
    const { merged, hasRemoteChanges, hasLocalChanges } = mergeWorkspaces(local, remoteData);

    let updated = false;
    if (hasRemoteChanges || force) {
      updated = importFullWorkspace(merged, false);
    }

    // If local had changes that cloud didn't have (e.g. mobile wrote a note while offline), push merged up
    if (hasLocalChanges) {
      pushSync().catch(() => {});
    }

    localStorage.setItem('novelist_last_synced', String(Date.now()));
    broadcastSyncStatus('synced', updated ? 'Đã cập nhật dữ liệu mới' : 'Dữ liệu mới nhất');

    return { success: true, updated };
  } catch (err: any) {
    broadcastSyncStatus('error', err.message || 'Lỗi tải đồng bộ');
    return { success: false, updated: false, error: err.message };
  }
}

let debouncePushTimer: any = null;
export function triggerAutoPush(delayMs: number = 2000) {
  if (typeof window === 'undefined' || !isAutoSyncEnabled()) return;

  if (debouncePushTimer) clearTimeout(debouncePushTimer);
  debouncePushTimer = setTimeout(() => {
    pushSync().catch(() => {});
  }, delayMs);
}

let autoSyncInitialized = false;

export function resetAutoSyncState() {
  autoSyncInitialized = false;
  if (debouncePushTimer) {
    clearTimeout(debouncePushTimer);
    debouncePushTimer = null;
  }
}

export function initAutoSync() {
  if (typeof window === 'undefined' || autoSyncInitialized) return;
  autoSyncInitialized = true;

  // 1. Initial pull on load to catch up with changes made on other devices (e.g. PC or Phone)
  pullSync().catch(() => {});

  // 2. Pull when window gains focus or tab becomes visible (user switches back to tab on phone/PC)
  window.addEventListener('focus', () => {
    pullSync().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullSync().catch(() => {});
    }
  });

  // 3. Periodic check every 25 seconds
  setInterval(() => {
    if (document.visibilityState === 'visible' && isAutoSyncEnabled()) {
      pullSync().catch(() => {});
    }
  }, 25000);

  // 4. Save any pending changes before unload
  window.addEventListener('beforeunload', () => {
    if (isAutoSyncEnabled()) {
      pushSync().catch(() => {});
    }
  });
}

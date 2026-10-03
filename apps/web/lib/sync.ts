'use client';

import {
  sha256,
  normalizeEmail,
  getEmailAliases,
  getCloudAccountKeys,
  unwrapWorkspace,
  mergeWorkspaces,
  type SyncStats,
  type SyncStatus,
  type CloudAccountKeys
} from './sync-core';

export {
  sha256,
  normalizeEmail,
  getEmailAliases,
  getCloudAccountKeys,
  unwrapWorkspace,
  mergeWorkspaces,
  type SyncStats,
  type SyncStatus,
  type CloudAccountKeys
};

// Cross-tab broadcast channel for immediate multi-tab synchronization on the same device
let crossTabChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    crossTabChannel = new BroadcastChannel('novelist_sync_channel');
    crossTabChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_REFRESH') {
        const local = exportFullWorkspace();
        window.dispatchEvent(new CustomEvent('novelist-sync-updated', { detail: { data: local, fromCrossTab: true } }));
      }
    };
  } catch {}
}

export function getUserEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    const userStr = localStorage.getItem('novelist_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.email) return normalizeEmail(user.email);
    }
    const authStr = localStorage.getItem('auth-storage');
    if (authStr) {
      const auth = JSON.parse(authStr);
      if (auth.state?.user?.email) return normalizeEmail(auth.state.user.email);
    }
  } catch {}
  return '';
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

export function recordTombstone(id: string, cascadeIds?: string[]): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const raw = localStorage.getItem('novelist_tombstones');
    const tombstones: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    tombstones[id] = now;
    if (Array.isArray(cascadeIds)) {
      for (const cid of cascadeIds) {
        if (cid) tombstones[cid] = now;
      }
    }
    localStorage.setItem('novelist_tombstones', JSON.stringify(tombstones));
  } catch {}
}

export function exportFullWorkspace() {
  if (typeof window === 'undefined') return null;
  const lastModifiedStr = localStorage.getItem('novelist_last_modified');
  const lastModified = lastModifiedStr ? parseInt(lastModifiedStr, 10) : Date.now();

  const rawChapters = getStoredJson('novelist_chapters', []);
  const sanitizedChapters = Array.isArray(rawChapters) ? rawChapters.map((c: any) => ({
    ...c,
    updatedAt: Number(c.updatedAt || c.createdAt || lastModified)
  })) : [];

  const rawProjects = getStoredJson('novelist_projects', []);
  const sanitizedProjects = Array.isArray(rawProjects) ? rawProjects.map((p: any) => ({
    ...p,
    updatedAt: Number(p.updatedAt || p.createdAt || lastModified)
  })) : [];

  return {
    version: 2,
    lastModified,
    exportedAt: Date.now(),
    projects: sanitizedProjects,
    chapters: sanitizedChapters,
    characters: getStoredJson('novelist_characters', []),
    entities: getStoredJson('novelist_worldbuilding', getStoredJson('novelist_entities', [])),
    timeline: getStoredJson('novelist_timeline', getStoredJson('novelist_timeline_events', [])),
    timelineEras: getStoredJson('novelist_timeline_eras', []),
    outline: getStoredJson('novelist_outline', getStoredJson('novelist_outlines', [])),
    wikiArticles: getStoredJson('novelist_wiki_articles', []),
    tombstones: getStoredJson('novelist_tombstones', {}),
    user: getStoredJson('novelist_current_user', null),
    aiConfig: {
      provider: localStorage.getItem('ai_provider') || 'gemini',
      model: localStorage.getItem('ai_model') || 'gemini-3.8-flash'
    }
  };
}

export function importFullWorkspace(data: any, merge: boolean = true): boolean {
  if (typeof window === 'undefined' || !data || typeof data !== 'object') return false;

  try {
    // Flush active editor content trước khi ghi đè localStorage
    // để đảm bảo những phím gõ mới nhất được lưu trước
    window.dispatchEvent(new CustomEvent('novelist-flush-save'));

    let finalData = data;
    if (merge) {
      const local = exportFullWorkspace();
      const { merged } = mergeWorkspaces(local, data);
      finalData = merged;
    }

    // Fix orderIndex collisions: group chapters by sibling level (projectId + '::' + (parentId || 'root'))
    // to ensure sequential orderIndex per sibling group, respecting the document tab hierarchy.
    if (Array.isArray(finalData.chapters)) {
      const byParentGroup = new Map<string, any[]>();
      for (const ch of finalData.chapters) {
        const parentKey = ch.parentId ? String(ch.parentId) : 'root';
        const groupKey = `${ch.projectId || 'unknown'}::${parentKey}`;
        if (!byParentGroup.has(groupKey)) byParentGroup.set(groupKey, []);
        byParentGroup.get(groupKey)!.push(ch);
      }
      for (const [, siblingChapters] of byParentGroup) {
        siblingChapters.sort((a: any, b: any) => {
          const oa = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
          const ob = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
          if (oa !== ob) return oa - ob;
          const ca = a.createdAt || 0;
          const cb = b.createdAt || 0;
          if (ca !== cb) return ca - cb;
          return String(a.id || '').localeCompare(String(b.id || ''));
        });
        siblingChapters.forEach((ch: any, idx: number) => {
          ch.orderIndex = idx + 1;
        });
      }
    }

    // Recalculate project chapterCount and wordCount accurately
    if (Array.isArray(finalData.projects) && Array.isArray(finalData.chapters)) {
      finalData.projects = finalData.projects.map((p: any) => {
        const pChapters = finalData.chapters.filter((c: any) => c.projectId === p.id);
        const totalWords = pChapters.reduce((acc: number, c: any) => acc + (c.wordCount || 0), 0);
        return {
          ...p,
          chapterCount: pChapters.length,
          wordCount: totalWords
        };
      });
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

    if (Array.isArray(finalData.wikiArticles)) {
      localStorage.setItem('novelist_wiki_articles', JSON.stringify(finalData.wikiArticles));
    }

    if (finalData.user) {
      localStorage.setItem('novelist_current_user', JSON.stringify(finalData.user));
    }

    if (finalData.aiConfig) {
      if (finalData.aiConfig.provider) localStorage.setItem('ai_provider', finalData.aiConfig.provider);
      if (finalData.aiConfig.model) localStorage.setItem('ai_model', finalData.aiConfig.model);
    }

    if (finalData.tombstones && typeof finalData.tombstones === 'object') {
      localStorage.setItem('novelist_tombstones', JSON.stringify(finalData.tombstones));
    }

    if (finalData.lastModified) {
      localStorage.setItem('novelist_last_modified', String(finalData.lastModified));
    }
    localStorage.setItem('novelist_last_synced', String(Date.now()));

    // Broadcast update across active React components and other browser tabs
    window.dispatchEvent(new CustomEvent('novelist-sync-updated', { detail: { data: finalData } }));
    crossTabChannel?.postMessage({ type: 'SYNC_REFRESH', timestamp: Date.now() });

    return true;
  } catch (err) {
    console.error('Failed to import workspace:', err);
    return false;
  }
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  const directToken = localStorage.getItem('token');
  if (directToken) return directToken;
  try {
    const authStr = localStorage.getItem('auth-storage');
    if (authStr) {
      const auth = JSON.parse(authStr);
      if (auth.state?.token) return auth.state.token;
    }
  } catch {}
  return '';
}

function broadcastSyncStatus(status: SyncStatus, message?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('novelist-sync-status', { 
    detail: { status, message, timestamp: Date.now() } 
  }));
}

let isPushing = false;

/**
 * Push workspace to cloud.
 * CRITICAL ARCHITECTURAL SAFETY (Strict LWW):
 * 1. Exports current workspace where every item has its true updatedAt.
 * 2. Multi-tier transport: Same-origin /api/sync (primary) + direct KVDB (backup).
 * 3. Absorbs any server-side canonical merged changes safely.
 */
export async function pushSync(): Promise<{ success: boolean; stats?: any; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };
  if (isPushing) return { success: true };
  isPushing = true;

  try {
    const local = exportFullWorkspace();
    if (!local) return { success: false, error: 'No data to sync' };

    const email = getUserEmail();
    if (!email || !email.includes('@')) {
      return { success: true };
    }

    const token = getAuthToken();
    const tokenIdentifier = token ? token.replace(/^Bearer\s+/i, '').replace(/^token_/, '').slice(-32) : undefined;
    const { dataKey, legacyKey, rawLegacyKey, candidateKeys } = getCloudAccountKeys(email, tokenIdentifier);

    broadcastSyncStatus('syncing', 'Đang lưu lên đám mây...');

    const workspace = exportFullWorkspace() || local;
    const chapterCount = Array.isArray(workspace.chapters) ? workspace.chapters.length : 0;
    const projectCount = Array.isArray(workspace.projects) ? workspace.projects.length : 0;

    const workspaceJson = JSON.stringify(workspace);
    let anySuccess = false;

    // 1. PRIMARY: Push to same-origin /api/sync
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: dataKey,
          dataKey: dataKey,
          email,
          lastModified: workspace.lastModified,
          data: workspace
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json && json.success) {
          anySuccess = true;
          if (json.data && Array.isArray(json.data.chapters)) {
            // Absorb any canonical updates that server unified
            importFullWorkspace(json.data, false);
          }
        }
      }
    } catch (e) {
      console.warn('[Sync Push] Same-origin /api/sync failed:', e);
    }

    // 2. SECONDARY: Direct KVDB backup
    if (email && email.includes('@')) {
      const keysToPersist = Array.from(new Set([dataKey, legacyKey].filter(Boolean)));
      const pushPromises = keysToPersist.map(k => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        return fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: workspaceJson,
          signal: controller.signal
        }).then(r => {
          clearTimeout(timeoutId);
          if (r.ok) anySuccess = true;
          return r.ok;
        }).catch(err => {
          clearTimeout(timeoutId);
          return false;
        });
      });
      await Promise.allSettled(pushPromises);
    }

    if (anySuccess) {
      localStorage.setItem('novelist_last_synced', String(Date.now()));
      broadcastSyncStatus('synced', `Đã lưu ${chapterCount} chương lên đám mây`);
      return {
        success: true,
        stats: {
          projects: projectCount,
          chapters: chapterCount,
          characters: Array.isArray(workspace.characters) ? workspace.characters.length : 0
        }
      };
    } else {
      broadcastSyncStatus('error', 'Không thể kết nối đến đám mây để lưu');
      return { success: false, error: 'Không thể kết nối đến đám mây để lưu' };
    }
  } catch (err: any) {
    broadcastSyncStatus('error', err.message || 'Lỗi lưu đám mây');
    return { success: false, error: err.message || 'Lỗi mạng khi lưu đám mây' };
  } finally {
    isPushing = false;
  }
}

let isPulling = false;

/**
 * Pull workspace from cloud.
 * STRICT LWW MERGE:
 * Concurrently queries same-origin /api/sync and KVDB.
 * Merges with local workspace via pure Last-Write-Wins.
 * If local has newer edits, automatically pushes them up so other devices receive them.
 */
export async function pullSync(force: boolean = false): Promise<{ success: boolean; updated: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, updated: false, error: 'Not in browser' };
  if (isPulling) return { success: true, updated: false };
  isPulling = true;

  try {
    const email = getUserEmail();
    if (!email || !email.includes('@')) {
      return { success: true, updated: false };
    }

    broadcastSyncStatus('syncing', 'Đang kiểm tra cập nhật đám mây...');

    const token = getAuthToken();
    const tokenIdentifier = token ? token.replace(/^Bearer\s+/i, '').replace(/^token_/, '').slice(-32) : undefined;
    const { dataKey, legacyKey, rawLegacyKey, candidateKeys } = getCloudAccountKeys(email, tokenIdentifier);

    const candidates: Array<{ data: any; source: string; chaptersCount: number; lastModified: number }> = [];

    const addCandidate = (rawData: any, source: string) => {
      const unwrapped = unwrapWorkspace(rawData);
      if (unwrapped && (Array.isArray(unwrapped.chapters) || Array.isArray(unwrapped.projects))) {
        const chCount = Array.isArray(unwrapped.chapters) ? unwrapped.chapters.length : 0;
        const mod = Number(unwrapped.lastModified || 0);
        candidates.push({ data: unwrapped, source, chaptersCount: chCount, lastModified: mod });
      }
    };

    // 1. PRIMARY: Query same-origin server API route /api/sync
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/sync?key=${encodeURIComponent(dataKey)}&email=${encodeURIComponent(email)}`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json && json.success && json.data) {
          addCandidate(json.data, 'same-origin-/api/sync');
        }
      }
    } catch (e) {
      console.warn('[Sync Pull] /api/sync primary fetch failed, trying direct:', e);
    }

    // 2. BACKUP: Direct cloud store lookup (KVDB) across candidate keys only if primary API didn't return candidates
    if (candidates.length === 0) {
      const keysToCheck = Array.from(new Set([dataKey, legacyKey, rawLegacyKey, ...candidateKeys].filter(Boolean)));
      const kvdbFetches = keysToCheck.map(k => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        return fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`, {
          signal: controller.signal
        })
          .then(async res => {
            clearTimeout(timeoutId);
            if (res.ok) {
              const text = await res.text();
              if (text && text.trim().length > 2) {
                try {
                  const parsed = JSON.parse(text);
                  addCandidate(parsed, `direct-kvdb-${k}`);
                } catch {}
              }
            }
          })
          .catch(err => {
            clearTimeout(timeoutId);
          });
      });

      await Promise.allSettled(kvdbFetches);
    }

    if (candidates.length === 0) {
      const local = exportFullWorkspace();
      const hasLocalData = local && ((Array.isArray(local.projects) && local.projects.length > 0) || (Array.isArray(local.chapters) && local.chapters.length > 0));
      if (hasLocalData) {
        pushSync().catch(() => {});
        broadcastSyncStatus('synced', 'Đã khởi tạo bản lưu đám mây');
        return { success: true, updated: false };
      }
      broadcastSyncStatus('idle');
      return { success: true, updated: false };
    }

    // 3. Unify candidates with strict LWW
    candidates.sort((a, b) => {
      if (b.lastModified !== a.lastModified) return b.lastModified - a.lastModified;
      return b.chaptersCount - a.chaptersCount;
    });

    let unifiedRemote = candidates[0].data;
    for (let i = 1; i < candidates.length; i++) {
      const { merged } = mergeWorkspaces(unifiedRemote, candidates[i].data);
      unifiedRemote = merged;
    }

    // 4. Strict LWW merge between local and unified remote
    const local = exportFullWorkspace();
    const { merged, hasRemoteChanges, hasLocalChanges } = mergeWorkspaces(local, unifiedRemote);

    let updated = false;
    if (hasRemoteChanges || force) {
      updated = importFullWorkspace(merged, false);
    }

    // If local had changes that cloud didn't have, push the canonical merged state up
    if (hasLocalChanges) {
      pushSync().catch(() => {});
    }

    localStorage.setItem('novelist_last_synced', String(Date.now()));
    broadcastSyncStatus('synced', `Đã cập nhật ${Array.isArray(merged.chapters) ? merged.chapters.length : 0} chương`);

    return { success: true, updated: true };
  } catch (err: any) {
    broadcastSyncStatus('error', err.message || 'Lỗi tải đồng bộ');
    return { success: false, updated: false, error: err.message };
  } finally {
    isPulling = false;
  }
}

/**
 * Universal Bidirectional Sync:
 * 1. Flushes active editor draft so pending keystrokes are saved to localStorage with Date.now().
 * 2. Performs strict LWW pull & merge.
 * 3. Pushes canonical result up to cloud.
 */
export async function syncBidirectional(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };

  broadcastSyncStatus('syncing', 'Đang đồng bộ dữ liệu hai chiều...');

  // Flush active editor if currently editing
  window.dispatchEvent(new CustomEvent('novelist-flush-save'));
  await new Promise(r => setTimeout(r, 60));

  const pullRes = await pullSync(true);
  const pushRes = await pushSync();

  const success = pullRes.success || pushRes.success;
  if (success) {
    broadcastSyncStatus('synced', 'Đồng bộ hai chiều hoàn tất');
  } else {
    broadcastSyncStatus('error', pullRes.error || pushRes.error || 'Lỗi đồng bộ');
  }

  return { success, error: pullRes.error || pushRes.error };
}

let debouncePushTimer: any = null;
export function triggerAutoPush(delayMs: number = 1000) {
  if (typeof window === 'undefined' || !isAutoSyncEnabled()) return;

  if (debouncePushTimer) clearTimeout(debouncePushTimer);
  debouncePushTimer = setTimeout(() => {
    pushSync().catch(() => {});
  }, delayMs);
}

let autoSyncInitialized = false;
let autoSyncPaused = false;

export function pauseAutoSync() {
  autoSyncPaused = true;
}

export function resumeAutoSync() {
  autoSyncPaused = false;
}

export function isAutoSyncPaused(): boolean {
  return autoSyncPaused;
}

export function resetAutoSyncState() {
  autoSyncInitialized = false;
  autoSyncPaused = false;
  if (debouncePushTimer) {
    clearTimeout(debouncePushTimer);
    debouncePushTimer = null;
  }
}

export function initAutoSync() {
  if (typeof window === 'undefined' || autoSyncInitialized) return;
  autoSyncInitialized = true;

  // 1. Initial pull on load to catch up with changes made on other devices (PC or Phone)
  pullSync().catch(() => {});

  // 2. Pull when window gains focus or tab becomes visible
  window.addEventListener('focus', () => {
    if (!autoSyncPaused) {
      pullSync().catch(() => {});
    }
  });

  const handleMobileHide = () => {
    if (isAutoSyncEnabled()) {
      window.dispatchEvent(new CustomEvent('novelist-flush-save'));
      pushSync().catch(() => {});
    }
  };

  // Push on pagehide or visibilitychange to hidden (crucial for mobile iOS/Android lifecycle)
  window.addEventListener('pagehide', handleMobileHide);
  window.addEventListener('beforeunload', handleMobileHide);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!autoSyncPaused) {
        pullSync().catch(() => {});
      }
    } else if (document.visibilityState === 'hidden') {
      handleMobileHide();
    }
  });

  // 3. Multi-Tab synchronization listener
  window.addEventListener('storage', (e) => {
    if (e.key === 'novelist_chapters' || e.key === 'novelist_projects' || e.key === 'novelist_last_modified') {
      const current = exportFullWorkspace();
      window.dispatchEvent(new CustomEvent('novelist-sync-updated', { detail: { data: current, fromStorage: true } }));
    }
  });

  // 4. Real-time active polling interval: every 8 seconds when active
  // Keeps PC and Phone synchronized without saturating API rate limits
  setInterval(() => {
    if (document.visibilityState === 'visible' && isAutoSyncEnabled() && !autoSyncPaused) {
      pullSync().catch(() => {});
    }
  }, 8000);
}

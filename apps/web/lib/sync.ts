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

export function importFullWorkspace(data: any, merge: boolean = true): boolean {
  if (typeof window === 'undefined' || !data || typeof data !== 'object') return false;

  try {
    let finalData = data;
    if (merge) {
      const local = exportFullWorkspace();
      const { merged } = mergeWorkspaces(local, data);
      finalData = merged;
    }

    // Fix orderIndex collisions: ensure unique sequential orderIndex per project
    if (Array.isArray(finalData.chapters)) {
      const byProject = new Map<string, any[]>();
      for (const ch of finalData.chapters) {
        const pid = ch.projectId || 'unknown';
        if (!byProject.has(pid)) byProject.set(pid, []);
        byProject.get(pid)!.push(ch);
      }
      for (const [, projectChapters] of byProject) {
        // Sort by existing orderIndex, then by createdAt, then by ID
        projectChapters.sort((a: any, b: any) => {
          const oa = a.orderIndex || 0;
          const ob = b.orderIndex || 0;
          if (oa !== ob) return oa - ob;
          const ca = a.createdAt || 0;
          const cb = b.createdAt || 0;
          if (ca !== cb) return ca - cb;
          return String(a.id || '').localeCompare(String(b.id || ''));
        });
        // Re-assign sequential orderIndex
        projectChapters.forEach((ch: any, idx: number) => {
          ch.orderIndex = idx + 1;
        });
      }
    }

    // Always recalculate project chapterCount and wordCount
    if (Array.isArray(finalData.projects) && Array.isArray(finalData.chapters)) {
      finalData.projects = finalData.projects.map((p: any) => {
        const pChapters = finalData.chapters.filter((c: any) => c.projectId === p.id);
        const totalWords = pChapters.reduce((acc: number, c: any) => acc + (c.wordCount || 0), 0);
        return {
          ...p,
          chapterCount: pChapters.length > 0 ? pChapters.length : (p.chapterCount || 0),
          wordCount: Math.max(p.wordCount || 0, totalWords)
        };
      });
    }

    console.log(`[Sync Import] Importing workspace: ${Array.isArray(finalData.projects) ? finalData.projects.length : 0} projects, ${Array.isArray(finalData.chapters) ? finalData.chapters.length : 0} chapters`);
    if (Array.isArray(finalData.chapters)) {
      finalData.chapters.forEach((c: any) => console.log(`  [Import] Chapter: ${c.id} - ${c.title} (orderIndex: ${c.orderIndex}, words: ${c.wordCount || 0})`));
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

/**
 * Push workspace to cloud.
 * CRITICAL ARCHITECTURAL SAFETY:
 * 1. Pre-merge: Fetches current remote snapshot first and performs a local merge so that
 *    an outdated client snapshot NEVER erases chapters written on another device (e.g. PC wrote Chapter 2).
 * 2. Multi-tier transport: Pushes to same-origin /api/sync (primary, bypasses mobile adblockers)
 *    AND direct KVDB keys (backup).
 * 3. Verifies that at least one transport succeeds before reporting 'synced'.
 */
export async function pushSync(): Promise<{ success: boolean; stats?: any; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };

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

    // 1. PRE-MERGE: Check if cloud already has chapters we don't have yet
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

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
          const { merged, hasRemoteChanges } = mergeWorkspaces(local, json.data);
          if (hasRemoteChanges) {
            console.log('[Sync Push Pre-Merge] Absorbed newer remote chapters before pushing');
            importFullWorkspace(merged, false);
          }
        }
      }
    } catch {
      // If pre-merge check fails (e.g. offline), proceed with current workspace
    }

    // Refresh workspace snapshot after pre-merge
    const workspace = exportFullWorkspace() || local;
    workspace.lastModified = Date.now();
    workspace.exportedAt = Date.now();

    const chapterCount = Array.isArray(workspace.chapters) ? workspace.chapters.length : 0;
    const projectCount = Array.isArray(workspace.projects) ? workspace.projects.length : 0;
    console.log(`[Sync Push] email=${email}, key=${dataKey}, projects=${projectCount}, chapters=${chapterCount}`);
    if (workspace.chapters) {
      workspace.chapters.forEach((c: any) => console.log(`  [Push] Chapter: ${c.id} - ${c.title}`));
    }

    const workspaceJson = JSON.stringify(workspace);
    let anySuccess = false;

    // 2. PRIMARY: Push to same-origin /api/sync
    // Same-origin calls to /api/sync are NEVER blocked by Brave Shields, AdBlock, or CORS on mobile!
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

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
        keepalive: true
      });

      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json && json.success) {
          anySuccess = true;
          console.log('[Sync Push] Successfully pushed via same-origin /api/sync');
          // If server performed a smart merge with other devices, absorb the merged result
          if (json.data && Array.isArray(json.data.chapters) && json.data.chapters.length > chapterCount) {
            console.log('[Sync Push] Server merged additional chapters, updating local cache');
            importFullWorkspace(json.data, false);
          }
        }
      }
    } catch (e) {
      console.warn('[Sync Push] Same-origin /api/sync failed:', e);
    }

    // 3. SECONDARY: Also persist directly to KVDB cloud store across candidate keys
    if (email && email.includes('@')) {
      const keysToPersist = Array.from(new Set([dataKey, legacyKey, rawLegacyKey, ...candidateKeys].filter(Boolean)));
      const pushPromises = keysToPersist.map(k =>
        fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: workspaceJson,
          keepalive: true
        }).then(r => {
          if (r.ok) {
            anySuccess = true;
            console.log(`[Sync Push] Direct PUT succeeded for ${k}`);
          }
          return r.ok;
        }).catch(err => {
          console.warn(`[Sync Push] Direct PUT failed for ${k}:`, err);
          return false;
        })
      );
      await Promise.allSettled(pushPromises);
    }

    if (anySuccess) {
      localStorage.setItem('novelist_last_synced', String(Date.now()));
      localStorage.setItem('novelist_last_modified', String(workspace.lastModified));
      broadcastSyncStatus('synced', `Đã lưu ${chapterCount} chương lên đám mây`);
      console.log(`[Sync Push] Success! Pushed ${chapterCount} chapters to cloud.`);
      return {
        success: true,
        stats: {
          projects: projectCount,
          chapters: chapterCount,
          characters: Array.isArray(workspace.characters) ? workspace.characters.length : 0
        }
      };
    } else {
      console.warn('[Sync Push] All sync targets failed to persist data');
      broadcastSyncStatus('error', 'Không thể kết nối đến đám mây để lưu');
      return { success: false, error: 'Không thể kết nối đến đám mây để lưu' };
    }
  } catch (err: any) {
    console.error('[Sync Push] Error:', err);
    broadcastSyncStatus('error', err.message || 'Lỗi lưu đám mây');
    return { success: false, error: err.message || 'Lỗi mạng khi lưu đám mây' };
  }
}

/**
 * Pull workspace from cloud.
 * MULTI-CANDIDATE DISCOVERY & BIDIRECTIONAL SMART MERGE:
 * Concurrently queries same-origin /api/sync and all candidate keys in KVDB.
 * Compares and unifies all remote versions, merges with local state, and updates UI.
 */
export async function pullSync(force: boolean = false): Promise<{ success: boolean; updated: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, updated: false, error: 'Not in browser' };

  try {
    const email = getUserEmail();
    if (!email || !email.includes('@')) {
      return { success: true, updated: false };
    }

    broadcastSyncStatus('syncing', 'Đang kiểm tra cập nhật đám mây...');

    const token = getAuthToken();
    const tokenIdentifier = token ? token.replace(/^Bearer\s+/i, '').replace(/^token_/, '').slice(-32) : undefined;
    const { dataKey, legacyKey, rawLegacyKey, candidateKeys } = getCloudAccountKeys(email, tokenIdentifier);

    // Query candidates across all possible keys
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
    // Same-origin calls to /api/sync are NEVER blocked by Brave Shields or mobile privacy blockers!
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/sync?key=${encodeURIComponent(dataKey)}&email=${encodeURIComponent(email)}`, { headers });
      const ct = res.headers.get('content-type') || '';
      // Ensure response is JSON (not SPA index.html or error page)
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json && json.success && json.data) {
          addCandidate(json.data, 'same-origin-/api/sync');
          console.log(`[Sync Pull] Successfully pulled from /api/sync: ${Array.isArray(json.data.chapters) ? json.data.chapters.length : 0} chapters`);
        }
      }
    } catch (e) {
      console.warn('[Sync Pull] /api/sync primary fetch failed, trying direct:', e);
    }

    // 2. BACKUP: Direct cloud store lookup (KVDB) across candidate keys
    const keysToCheck = Array.from(new Set([dataKey, legacyKey, rawLegacyKey, ...candidateKeys].filter(Boolean)));
    const kvdbFetches = keysToCheck.map(k =>
      fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`)
        .then(async res => {
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 2) {
              try {
                const parsed = JSON.parse(text);
                addCandidate(parsed, `direct-kvdb-${k}`);
                console.log(`[Sync Pull] Pulled candidate from direct kvdb ${k}: ${Array.isArray(parsed.chapters || parsed.data?.chapters) ? (parsed.chapters || parsed.data?.chapters).length : 0} chapters`);
              } catch {}
            }
          }
        })
        .catch(err => {
          console.warn(`[Sync Pull] Direct kvdb ${k} fetch failed:`, err);
        })
    );

    await Promise.allSettled(kvdbFetches);

    if (candidates.length === 0) {
      console.warn('[Sync Pull] No remote data candidate could be reached');
      broadcastSyncStatus('error', 'Chưa thể kết nối tới đám mây');
      return { success: false, updated: false, error: 'Không thể kết nối đến đám mây' };
    }

    // 3. Smart-merge ALL candidates together into unifiedRemote
    // Candidates are sorted: highest lastModified first; if equal, candidate with more chapters wins
    candidates.sort((a, b) => {
      if (b.lastModified !== a.lastModified) return b.lastModified - a.lastModified;
      return b.chaptersCount - a.chaptersCount;
    });

    let unifiedRemote = candidates[0].data;
    for (let i = 1; i < candidates.length; i++) {
      const { merged } = mergeWorkspaces(unifiedRemote, candidates[i].data);
      unifiedRemote = merged;
    }

    console.log(`[Sync Pull] Unified remote snapshot: ${Array.isArray(unifiedRemote.chapters) ? unifiedRemote.chapters.length : 0} chapters, modified=${unifiedRemote.lastModified}`);

    // 4. Smart two-way merge between local workspace and unified remote
    const local = exportFullWorkspace();
    const { merged, hasRemoteChanges, hasLocalChanges } = mergeWorkspaces(local, unifiedRemote);

    const localChapterCount = Array.isArray(local?.chapters) ? local.chapters.length : 0;
    const mergedChapterCount = Array.isArray(merged.chapters) ? merged.chapters.length : 0;
    const localProjectCount = Array.isArray(local?.projects) ? local.projects.length : 0;
    const mergedProjectCount = Array.isArray(merged.projects) ? merged.projects.length : 0;

    const dataDiffers = mergedChapterCount !== localChapterCount
      || mergedProjectCount !== localProjectCount
      || hasRemoteChanges;

    let updated = false;
    if (dataDiffers || force) {
      // Pass false for merge param since we already merged above
      updated = importFullWorkspace(merged, false);
    }

    // If local had changes that cloud didn't have, push the unified merged state up
    if (hasLocalChanges) {
      pushSync().catch(() => {});
    }

    localStorage.setItem('novelist_last_synced', String(Date.now()));
    broadcastSyncStatus('synced', `Đã cập nhật ${mergedChapterCount} chương`);

    return { success: true, updated: true };
  } catch (err: any) {
    console.error('[Sync Pull] Error:', err);
    broadcastSyncStatus('error', err.message || 'Lỗi tải đồng bộ');
    return { success: false, updated: false, error: err.message };
  }
}

let debouncePushTimer: any = null;
export function triggerAutoPush(delayMs: number = 1500) {
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

  const handleMobileHide = () => {
    if (isAutoSyncEnabled()) {
      pushSync().catch(() => {});
    }
  };

  // Push on pagehide or visibilitychange to hidden (crucial for mobile iOS/Android lifecycle)
  window.addEventListener('pagehide', handleMobileHide);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullSync().catch(() => {});
    } else if (document.visibilityState === 'hidden') {
      handleMobileHide();
    }
  });

  // 3. Periodic check every 8 seconds for responsive cross-device updates
  setInterval(() => {
    if (document.visibilityState === 'visible' && isAutoSyncEnabled()) {
      pullSync().catch(() => {});
    }
  }, 8000);

  // 4. Save any pending changes before unload
  window.addEventListener('beforeunload', handleMobileHide);
}

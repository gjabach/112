'use client';

export interface SyncStats {
  projects: number;
  chapters: number;
  characters: number;
  lastModified: number;
  lastSynced: number | null;
}

export function getSyncKey(): string {
  if (typeof window === 'undefined') return 'default_user';
  const saved = localStorage.getItem('novelist_sync_key');
  if (saved && saved.trim()) return saved.trim();

  // Try from current user
  try {
    const userStr = localStorage.getItem('novelist_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.email) {
        const clean = user.email.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        localStorage.setItem('novelist_sync_key', clean);
        return clean;
      }
    }
  } catch {}

  const defaultKey = 'default_user';
  localStorage.setItem('novelist_sync_key', defaultKey);
  return defaultKey;
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
    users: getStoredJson('novelist_users', []),
    aiConfig: {
      provider: localStorage.getItem('ai_provider') || 'gemini',
      model: localStorage.getItem('ai_model') || 'gemini-3.5-flash',
      apiKey: localStorage.getItem('ai_api_key') || ''
    }
  };
}

export function importFullWorkspace(data: any): boolean {
  if (typeof window === 'undefined' || !data || typeof data !== 'object') return false;

  try {
    if (Array.isArray(data.projects)) {
      localStorage.setItem('novelist_projects', JSON.stringify(data.projects));
    }
    if (Array.isArray(data.chapters)) {
      localStorage.setItem('novelist_chapters', JSON.stringify(data.chapters));
    }
    if (Array.isArray(data.characters)) {
      localStorage.setItem('novelist_characters', JSON.stringify(data.characters));
    }

    const entities = data.entities || data.worldbuilding;
    if (Array.isArray(entities)) {
      localStorage.setItem('novelist_worldbuilding', JSON.stringify(entities));
      localStorage.setItem('novelist_entities', JSON.stringify(entities));
    }

    const timeline = data.timeline || data.timelineEvents;
    if (Array.isArray(timeline)) {
      localStorage.setItem('novelist_timeline', JSON.stringify(timeline));
      localStorage.setItem('novelist_timeline_events', JSON.stringify(timeline));
    }

    if (Array.isArray(data.timelineEras)) {
      localStorage.setItem('novelist_timeline_eras', JSON.stringify(data.timelineEras));
    }

    const outline = data.outline || data.outlines;
    if (outline) {
      localStorage.setItem('novelist_outline', JSON.stringify(outline));
      localStorage.setItem('novelist_outlines', JSON.stringify(outline));
    }

    if (data.user) {
      localStorage.setItem('novelist_current_user', JSON.stringify(data.user));
    }
    if (data.users && Array.isArray(data.users)) {
      localStorage.setItem('novelist_users', JSON.stringify(data.users));
    }

    if (data.aiConfig) {
      if (data.aiConfig.provider) localStorage.setItem('ai_provider', data.aiConfig.provider);
      if (data.aiConfig.model) localStorage.setItem('ai_model', data.aiConfig.model);
      if (data.aiConfig.apiKey) localStorage.setItem('ai_api_key', data.aiConfig.apiKey);
    }

    if (data.lastModified) {
      localStorage.setItem('novelist_last_modified', String(data.lastModified));
    }
    localStorage.setItem('novelist_last_synced', String(Date.now()));

    // Notify active UI components across the application
    window.dispatchEvent(new CustomEvent('novelist-sync-updated', { detail: { data } }));
    return true;
  } catch (err) {
    console.error('Failed to import workspace:', err);
    return false;
  }
}

export async function pushSync(): Promise<{ success: boolean; stats?: any; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };

  try {
    const key = getSyncKey();
    const workspace = exportFullWorkspace();
    if (!workspace) return { success: false, error: 'No data to sync' };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        lastModified: workspace.lastModified,
        data: workspace
      })
    });

    const json = await res.json();
    if (json.success) {
      localStorage.setItem('novelist_last_synced', String(Date.now()));
      return { success: true, stats: json.stats };
    } else {
      return { success: false, error: json.error || 'Lỗi lưu trên máy chủ' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi mạng khi đồng bộ' };
  }
}

export async function pullSync(force: boolean = false): Promise<{ success: boolean; updated: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, updated: false, error: 'Not in browser' };

  try {
    const key = getSyncKey();
    const res = await fetch(`/api/sync?key=${encodeURIComponent(key)}`);
    const json = await res.json();

    if (!json.success || !json.data) {
      return { success: true, updated: false };
    }

    const serverLastModified = json.lastModified || json.data.lastModified || 0;
    const localLastModifiedStr = localStorage.getItem('novelist_last_modified');
    const localLastModified = localLastModifiedStr ? parseInt(localLastModifiedStr, 10) : 0;

    // Check if server is newer or force sync requested
    if (force || serverLastModified > localLastModified) {
      const imported = importFullWorkspace(json.data);
      return { success: true, updated: imported };
    }

    return { success: true, updated: false };
  } catch (err: any) {
    return { success: false, updated: false, error: err.message || 'Lỗi mạng khi tải đồng bộ' };
  }
}

let debouncePushTimer: any = null;
export function triggerAutoPush(delayMs: number = 2500) {
  if (typeof window === 'undefined' || !isAutoSyncEnabled()) return;

  if (debouncePushTimer) clearTimeout(debouncePushTimer);
  debouncePushTimer = setTimeout(() => {
    pushSync().catch(() => {});
  }, delayMs);
}

let autoSyncInitialized = false;
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

  // 3. Periodic check every 45 seconds
  setInterval(() => {
    if (document.visibilityState === 'visible' && isAutoSyncEnabled()) {
      pullSync().catch(() => {});
    }
  }, 45000);

  // 4. Save any pending changes before unload
  window.addEventListener('beforeunload', () => {
    if (isAutoSyncEnabled()) {
      pushSync().catch(() => {});
    }
  });
}

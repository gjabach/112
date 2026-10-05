'use client';

import { API_URL, apiFetchRemote, countWords } from './utils';
import { refreshCachedProjectStats, notifyWorkspaceChanged, readWorkspaceCache } from './workspace-cache';

export const CHAPTER_LOCK_HEARTBEAT_MS = 20_000;

export interface PublicChapterLock {
  version: string;
  deviceLabel: string;
  acquiredAt: number;
  heartbeatAt: number;
  expiresAt: number;
}

export interface OwnedChapterLock extends PublicChapterLock {
  token: string;
}

export interface ChapterVersion {
  updatedAt: number;
  contentUpdatedAt: number;
  titleUpdatedAt: number;
}

export interface DeviceIdentity {
  deviceId: string;
  sessionId: string;
  deviceLabel: string;
}

export interface PendingChapterDraft {
  chapterId: string;
  content: string;
  title: string;
  baseVersion: ChapterVersion;
  savedLocallyAt: number;
}

const PENDING_DRAFTS_KEY = 'novelist_pending_chapter_drafts';

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

export type ApiConnectionStatus = 'checking' | 'reachable' | 'available' | 'unconfigured' | 'unreachable' | 'auth-required' | 'server-error';

let cachedConnectionStatus: ApiConnectionStatus = 'checking';
let lastCapabilityCheckTime = 0;

export async function probeApiCapabilities(force = false): Promise<{ available: boolean; status: ApiConnectionStatus; message?: string }> {
  if (typeof window === 'undefined') {
    const hasConfig = Boolean(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL);
    return { available: hasConfig, status: hasConfig ? 'reachable' : 'unconfigured' };
  }

  const now = Date.now();
  if (!force && cachedConnectionStatus !== 'checking' && now - lastCapabilityCheckTime < 10_000) {
    const isReachable = cachedConnectionStatus === 'reachable' || cachedConnectionStatus === 'available';
    return { available: isReachable, status: cachedConnectionStatus };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('/api/capabilities', { signal: controller.signal });
    clearTimeout(timeoutId);
    lastCapabilityCheckTime = now;

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.configured && data.available) {
        cachedConnectionStatus = 'reachable';
        return { available: true, status: 'reachable' };
      } else if (!data.configured) {
        cachedConnectionStatus = 'unconfigured';
        return { available: false, status: 'unconfigured', message: 'Dịch vụ đồng bộ chưa được cấu hình' };
      } else {
        cachedConnectionStatus = 'unreachable';
        return { available: false, status: 'unreachable', message: 'Không thể kết nối máy chủ' };
      }
    }

    if (res.status === 401 || res.status === 403) {
      cachedConnectionStatus = 'auth-required';
      return { available: false, status: 'auth-required', message: 'Yêu cầu xác thực tài khoản' };
    }

    if (res.status === 503) {
      cachedConnectionStatus = 'unconfigured';
      return { available: false, status: 'unconfigured', message: 'Dịch vụ đồng bộ chưa sẵn sàng' };
    }

    if (res.status >= 500) {
      cachedConnectionStatus = 'server-error';
      return { available: false, status: 'server-error', message: 'Máy chủ phản hồi lỗi' };
    }
  } catch {
    cachedConnectionStatus = 'unreachable';
    return { available: false, status: 'unreachable' };
  }

  cachedConnectionStatus = 'reachable';
  return { available: true, status: 'reachable' };
}

export function hasRemoteChapterApi(): boolean {
  if (typeof window === 'undefined') return Boolean(API_URL || process.env.API_URL);
  if (API_URL) return true;
  return cachedConnectionStatus !== 'unconfigured';
}

export function getConnectionStatus(): ApiConnectionStatus {
  return cachedConnectionStatus;
}

export function setConnectionStatus(status: ApiConnectionStatus): void {
  cachedConnectionStatus = status;
}

export function getDeviceIdentity(): DeviceIdentity {
  let deviceId = localStorage.getItem('novelist_device_id');
  if (!deviceId) {
    deviceId = randomId();
    localStorage.setItem('novelist_device_id', deviceId);
  }
  let sessionId = sessionStorage.getItem('novelist_editor_session_id');
  if (!sessionId) {
    sessionId = randomId();
    sessionStorage.setItem('novelist_editor_session_id', sessionId);
  }

  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox'
        : /Safari\//.test(ua) ? 'Safari'
          : 'Trình duyệt';
  return { deviceId, sessionId, deviceLabel: `${mobile ? 'Điện thoại' : 'Máy tính'} · ${browser}` };
}

export async function acquireChapterLock(chapterId: string, identity: DeviceIdentity, force = false, expectedLockVersion = '') {
  return apiFetchRemote(`/api/chapters/${chapterId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ ...identity, force, expectedLockVersion })
  }) as Promise<{ success: true; lock: OwnedChapterLock; chapterVersion: ChapterVersion }>;
}

export async function heartbeatChapterLock(chapterId: string, token: string) {
  return apiFetchRemote(`/api/chapters/${chapterId}/lock`, {
    method: 'PATCH',
    headers: { 'X-Chapter-Lock-Token': token },
    body: JSON.stringify({ lockToken: token })
  }) as Promise<{ success: true; expiresAt: number }>;
}

export async function releaseChapterLock(chapterId: string, token: string) {
  if (!token) return;
  return apiFetchRemote(`/api/chapters/${chapterId}/lock`, {
    method: 'DELETE',
    keepalive: true,
    headers: { 'X-Chapter-Lock-Token': token },
    body: JSON.stringify({ lockToken: token })
  }).catch(() => undefined);
}

export function persistLocalChapterDraft(
  chapterId: string,
  content: string,
  title: string,
  version: Partial<ChapterVersion> = {},
  extra: { localRevision?: number; operationId?: string; projectId?: string } = {}
): { success: boolean; error?: string } {
  const now = Date.now();
  try {
    const tombstones = readWorkspaceCache('novelist_tombstones', {});
    if (tombstones[chapterId] || (extra.projectId && tombstones[extra.projectId])) {
      return { success: false, error: 'Chương đã bị xóa' };
    }
    const raw = localStorage.getItem('novelist_chapters');
    const parsedChapters = raw ? JSON.parse(raw) : [];
    const chapters = Array.isArray(parsedChapters) ? parsedChapters : [];
    let found = false;
    const updated = chapters.map((chapter: any) => {
      if (chapter.id !== chapterId) return chapter;
      found = true;
      const contentChanged = content !== (chapter.content || '');
      const titleChanged = title !== (chapter.title || '');
      return {
        ...chapter,
        title,
        content,
        wordCount: countWords(content),
        updatedAt: now,
        contentUpdatedAt: contentChanged ? now : Number(version.contentUpdatedAt || chapter.contentUpdatedAt || chapter.updatedAt || now),
        titleUpdatedAt: titleChanged ? now : Number(version.titleUpdatedAt || chapter.titleUpdatedAt || chapter.updatedAt || now)
      };
    });
    if (found) {
      localStorage.setItem('novelist_chapters', JSON.stringify(updated));
      const target = updated.find((chapter: any) => chapter.id === chapterId);
      const projectRaw = localStorage.getItem('novelist_projects');
      const projects = projectRaw ? JSON.parse(projectRaw) : [];
      if (target?.projectId && Array.isArray(projects)) {
        const projectWords = updated
          .filter((chapter: any) => chapter.projectId === target.projectId)
          .reduce((sum: number, chapter: any) => sum + Number(chapter.wordCount || 0), 0);
        localStorage.setItem('novelist_projects', JSON.stringify(projects.map((project: any) => (
          project.id === target.projectId ? { ...project, wordCount: projectWords, updatedAt: now } : project
        ))));
      }
      localStorage.setItem('novelist_last_modified', String(now));
    }
    const pendingRaw = localStorage.getItem(PENDING_DRAFTS_KEY);
    const pending = pendingRaw ? JSON.parse(pendingRaw) : {};
    const baseVersion = {
      updatedAt: Number(version.updatedAt || 0),
      contentUpdatedAt: Number(version.contentUpdatedAt || version.updatedAt || 0),
      titleUpdatedAt: Number(version.titleUpdatedAt || version.updatedAt || 0)
    };
    pending[chapterId] = {
      chapterId,
      content,
      title,
      baseVersion,
      savedLocallyAt: now,
      localRevision: extra.localRevision ?? 0,
      operationId: extra.operationId || `op_${now}_${Math.random().toString(36).slice(2, 7)}`,
      projectId: extra.projectId || (found ? updated.find((c: any) => c.id === chapterId)?.projectId : '')
    };
    localStorage.setItem(PENDING_DRAFTS_KEY, JSON.stringify(pending));
    refreshCachedProjectStats();
    notifyWorkspaceChanged();
    return { success: true };
  } catch (err: any) {
    console.error('[ChapterLock] Error persisting local draft:', err);
    return { success: false, error: err?.message || 'Không thể ghi vào bộ nhớ thiết bị' };
  }
}

export function exportDraftFromMemory(chapterId: string, content: string, title: string) {
  if (typeof window === 'undefined') return;
  const backup = {
    chapterId,
    title,
    content,
    capturedAt: Date.now(),
    deviceIdentity: getDeviceIdentity()
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `emergency-draft-${chapterId}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getPendingChapterDraft(chapterId: string): PendingChapterDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_DRAFTS_KEY);
    const drafts = raw ? JSON.parse(raw) : {};
    const draft = drafts?.[chapterId];
    return draft && typeof draft.content === 'string' ? draft as PendingChapterDraft : null;
  } catch {
    return null;
  }
}

export function clearPendingChapterDraft(chapterId: string, expected?: { content: string; title: string }) {
  try {
    const raw = localStorage.getItem(PENDING_DRAFTS_KEY);
    const drafts = raw ? JSON.parse(raw) : {};
    const current = drafts?.[chapterId];
    if (!current) return;
    if (expected && (current.content !== expected.content || current.title !== expected.title)) return;
    delete drafts[chapterId];
    localStorage.setItem(PENDING_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {}
}

export function cacheRemoteChapter(chapter: any) {
  if (!chapter?.id) return;
  try {
    // Tombstone gate: do NOT cache if chapter has already been deleted
    const rawTombstones = localStorage.getItem('novelist_tombstones');
    const tombstones = rawTombstones ? JSON.parse(rawTombstones) : {};
    if (tombstones?.[chapter.id] || tombstones?.[chapter.projectId]) return;

    const pending = getPendingChapterDraft(chapter.id);
    if (pending && (pending.content !== chapter.content || pending.title !== chapter.title)) return;

    const raw = localStorage.getItem('novelist_chapters');
    const chapters = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(chapters)) return;
    const normalized = {
      ...chapter,
      contentUpdatedAt: Number(chapter.contentUpdatedAt || chapter.updatedAt || Date.now()),
      titleUpdatedAt: Number(chapter.titleUpdatedAt || chapter.updatedAt || Date.now())
    };
    const index = chapters.findIndex((item: any) => item.id === chapter.id);
    if (index >= 0) chapters[index] = normalized;
    else chapters.push(normalized);
    localStorage.setItem('novelist_chapters', JSON.stringify(chapters));
    refreshCachedProjectStats();
    notifyWorkspaceChanged();
  } catch {}
}

export interface PendingRecovery {
  recoveryId: string;
  chapterId: string;
  content: string;
  title: string;
  deviceLabel: string;
  capturedAt: number;
}

const PENDING_RECOVERIES_KEY = 'novelist_pending_recoveries';
const recoveryRequests = new Map<string, Promise<any>>();

export function savePendingRecovery(draft: PendingRecovery) {
  // Disabled: Recovery cards are deprecated and removed.
}

export function removePendingRecovery(recoveryId: string) {
  try {
    const raw = localStorage.getItem(PENDING_RECOVERIES_KEY);
    const items: PendingRecovery[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(PENDING_RECOVERIES_KEY, JSON.stringify((Array.isArray(items) ? items : []).filter(item => item.recoveryId !== recoveryId)));
  } catch {}
}

export async function createRecoveryChapter(draft: PendingRecovery) {
  // Disabled: Recovery cards are deprecated and removed.
  removePendingRecovery(draft.recoveryId);
  clearPendingChapterDraft(draft.chapterId, { content: draft.content, title: draft.title });
  return { success: false, disabled: true };
}

export async function retryPendingRecoveries(): Promise<number> {
  try {
    localStorage.removeItem(PENDING_RECOVERIES_KEY);
  } catch {}
  return 0;
}

export function createRecoveryId(sessionId: string, chapterId: string) {
  return `recovery_${sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${chapterId.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 150);
}

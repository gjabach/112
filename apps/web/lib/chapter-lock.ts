'use client';

import { API_URL, apiFetchRemote, countWords } from './utils';

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

export function hasRemoteChapterApi(): boolean {
  return Boolean(API_URL);
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

export function persistLocalChapterDraft(chapterId: string, content: string, title: string, version: Partial<ChapterVersion> = {}) {
  const now = Date.now();
  try {
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
    pending[chapterId] = { chapterId, content, title, baseVersion, savedLocallyAt: now };
    localStorage.setItem(PENDING_DRAFTS_KEY, JSON.stringify(pending));
  } catch {}
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
  try {
    const raw = localStorage.getItem(PENDING_RECOVERIES_KEY);
    const items: PendingRecovery[] = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(items) ? items.filter(item => item.recoveryId !== draft.recoveryId) : [];
    next.push(draft);
    localStorage.setItem(PENDING_RECOVERIES_KEY, JSON.stringify(next));
  } catch {}
}

export function removePendingRecovery(recoveryId: string) {
  try {
    const raw = localStorage.getItem(PENDING_RECOVERIES_KEY);
    const items: PendingRecovery[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(PENDING_RECOVERIES_KEY, JSON.stringify((Array.isArray(items) ? items : []).filter(item => item.recoveryId !== recoveryId)));
  } catch {}
}

export async function createRecoveryChapter(draft: PendingRecovery) {
  const existingRequest = recoveryRequests.get(draft.recoveryId);
  if (existingRequest) return existingRequest;
  const request = (async () => {
    savePendingRecovery(draft);
    const response = await apiFetchRemote(`/api/chapters/${draft.chapterId}/recoveries`, {
      method: 'POST',
      body: JSON.stringify(draft)
    });
    removePendingRecovery(draft.recoveryId);
    clearPendingChapterDraft(draft.chapterId, { content: draft.content, title: draft.title });
    if (response?.chapter) cacheRemoteChapter(response.chapter);
    return response;
  })();
  recoveryRequests.set(draft.recoveryId, request);
  try {
    return await request;
  } finally {
    recoveryRequests.delete(draft.recoveryId);
  }
}

export async function retryPendingRecoveries(): Promise<number> {
  let items: PendingRecovery[] = [];
  try {
    const raw = localStorage.getItem(PENDING_RECOVERIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    items = Array.isArray(parsed) ? parsed : [];
  } catch {}
  let completed = 0;
  for (const draft of items) {
    try {
      await createRecoveryChapter(draft);
      completed += 1;
    } catch {
      // Keep the draft for the next online event.
    }
  }
  return completed;
}

export function createRecoveryId(sessionId: string, chapterId: string) {
  return `recovery_${sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${chapterId.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 150);
}

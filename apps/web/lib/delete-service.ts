import { apiFetch } from './utils';
import { pushSync, unprotectChapterFromSync } from './sync';

export interface DeleteChapterOptions {
  projectId: string;
  chapterId: string;
  lockToken?: string;
  operationId?: string;
}

export interface DeleteChapterResponse {
  success: boolean;
  deletedIds: string[];
  alreadyDeleted?: boolean;
  error?: string;
}

export function archiveDraft(chapterId: string, content: string, title: string, reason = 'deleted') {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('novelist_archived_drafts');
    const drafts = raw ? JSON.parse(raw) : [];
    const item = {
      archiveId: `arch_${chapterId}_${Date.now()}`,
      chapterId,
      content,
      title,
      archivedAt: Date.now(),
      reason
    };
    const list = Array.isArray(drafts) ? drafts : [];
    list.unshift(item);
    // Retain recent archived drafts safely without resurrecting into workspace
    localStorage.setItem('novelist_archived_drafts', JSON.stringify(list.slice(0, 100)));
  } catch {}
}

export async function deleteChapterWithSync(options: DeleteChapterOptions): Promise<DeleteChapterResponse> {
  const { chapterId, projectId, lockToken, operationId } = options;
  if (typeof window === 'undefined') return { success: false, deletedIds: [], error: 'Not in browser' };

  const opId = operationId || `del_cli_${chapterId}_${Date.now()}`;

  // 1. Pre-delete: Unprotect chapter in active sync and stop dirty recovery
  unprotectChapterFromSync(chapterId);

  // 2. Archive any unsaved pending drafts for this chapter before retiring
  try {
    const rawDrafts = localStorage.getItem('novelist_pending_chapter_drafts');
    const drafts = rawDrafts ? JSON.parse(rawDrafts) : {};
    if (drafts?.[chapterId]) {
      const d = drafts[chapterId];
      archiveDraft(chapterId, d.content, d.title, 'chapter_deleted');
      delete drafts[chapterId];
      localStorage.setItem('novelist_pending_chapter_drafts', JSON.stringify(drafts));
    }
  } catch {}

  // 3. Send SINGLE atomic DELETE request to server. Server cascades to all descendants!
  const headers: Record<string, string> = {
    'X-Operation-Id': opId
  };
  if (lockToken) {
    headers['X-Chapter-Lock-Token'] = lockToken;
  }

  let serverRes: any;
  try {
    serverRes = await apiFetch(`/api/chapters/${chapterId}`, {
      method: 'DELETE',
      headers
    });
  } catch (err: any) {
    return { success: false, deletedIds: [], error: err.message || 'Lỗi khi xóa chương' };
  }

  const deletedIds: string[] = Array.isArray(serverRes?.deletedIds)
    ? serverRes.deletedIds
    : [chapterId];

  const now = Number(serverRes?.deletedAt || Date.now());

  // 4. Update local cache & record durable tombstones locally
  try {
    // Record tombstones
    const rawTombstones = localStorage.getItem('novelist_tombstones');
    const tombstones = rawTombstones ? JSON.parse(rawTombstones) : {};
    for (const delId of deletedIds) {
      tombstones[delId] = now;
      unprotectChapterFromSync(delId);
    }
    if (serverRes?.tombstones && typeof serverRes.tombstones === 'object') {
      Object.assign(tombstones, serverRes.tombstones);
    }
    localStorage.setItem('novelist_tombstones', JSON.stringify(tombstones));

    // Remove from novelist_chapters
    const rawChapters = localStorage.getItem('novelist_chapters');
    const chapters = rawChapters ? JSON.parse(rawChapters) : [];
    const delSet = new Set(deletedIds);
    const remainingChapters = Array.isArray(chapters) ? chapters.filter((c: any) => !delSet.has(c.id)) : [];
    localStorage.setItem('novelist_chapters', JSON.stringify(remainingChapters));

    // Recalculate project stats in novelist_projects
    const rawProjects = localStorage.getItem('novelist_projects');
    const projects = rawProjects ? JSON.parse(rawProjects) : [];
    if (Array.isArray(projects)) {
      const projChapters = remainingChapters.filter((c: any) => c.projectId === projectId);
      const totalWords = projChapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);
      const updatedProjects = projects.map((p: any) => p.id === projectId ? {
        ...p,
        chapterCount: projChapters.length,
        wordCount: totalWords,
        updatedAt: now
      } : p);
      localStorage.setItem('novelist_projects', JSON.stringify(updatedProjects));
    }

    // Broadcast event across tabs/windows
    window.dispatchEvent(new CustomEvent('novelist-chapters-deleted', {
      detail: { projectId, deletedIds, deletedAt: now, operationId: opId }
    }));
  } catch (e) {
    console.error('[deleteChapterWithSync] Cache cleanup error:', e);
  }

  // 5. Trigger cloud sync push to propagate tombstones to cloud and peer devices
  pushSync().catch(() => {});

  return {
    success: true,
    deletedIds,
    alreadyDeleted: Boolean(serverRes?.alreadyDeleted)
  };
}

import { apiFetch } from './utils';
import { pushSync, unprotectChapterFromSync } from './sync';
import { refreshCachedProjectStats, notifyWorkspaceChanged } from './workspace-cache';

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

  // Send one atomic DELETE request. The API cascades to all descendants.
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
  if (!serverRes?.success) {
    return { success: false, deletedIds: [], error: serverRes?.error || 'Lỗi khi xóa chương' };
  }

  const deletedIds: string[] = Array.isArray(serverRes?.deletedIds) && serverRes.deletedIds.length > 0
    ? serverRes.deletedIds
    : [chapterId];

  const now = Number(serverRes?.deletedAt || Date.now());

  // Update the cache only after deletion has been acknowledged.
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

    // Retire drafts only after deletion succeeds, including the entire subtree.
    const rawDrafts = localStorage.getItem('novelist_pending_chapter_drafts');
    const drafts = rawDrafts ? JSON.parse(rawDrafts) : {};
    for (const delId of deletedIds) {
      if (!drafts[delId]) continue;
      archiveDraft(delId, drafts[delId].content, drafts[delId].title, 'chapter_deleted');
      delete drafts[delId];
    }
    localStorage.setItem('novelist_pending_chapter_drafts', JSON.stringify(drafts));

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
      const updatedProjects = projects.map((p: any) => p.id === projectId ? {
        ...p,
        updatedAt: now
      } : p);
      localStorage.setItem('novelist_projects', JSON.stringify(updatedProjects));
    }
    refreshCachedProjectStats();
    localStorage.setItem('novelist_last_modified', String(now));
    notifyWorkspaceChanged();

    // Broadcast event across tabs/windows
    window.dispatchEvent(new CustomEvent('novelist-chapters-deleted', {
      detail: { projectId, deletedIds, deletedAt: now, operationId: opId }
    }));
  } catch (e) {
    console.error('[deleteChapterWithSync] Cache cleanup error:', e);
  }

  // Propagate tombstones to cloud and peer devices.
  pushSync().catch(() => {});

  return {
    success: true,
    deletedIds,
    alreadyDeleted: Boolean(serverRes?.alreadyDeleted)
  };
}

export interface DeleteProjectOptions {
  projectId: string;
  operationId?: string;
}

export interface DeleteProjectResponse {
  success: boolean;
  deletedIds: string[];
  alreadyDeleted?: boolean;
  error?: string;
}

export async function deleteProjectWithSync(options: DeleteProjectOptions): Promise<DeleteProjectResponse> {
  const { projectId, operationId } = options;
  if (typeof window === 'undefined') return { success: false, deletedIds: [], error: 'Not in browser' };

  const opId = operationId || `del_proj_${projectId}_${Date.now()}`;
  const headers: Record<string, string> = {
    'X-Operation-Id': opId
  };

  let serverRes: any;
  try {
    serverRes = await apiFetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      headers
    });
  } catch (err: any) {
    return { success: false, deletedIds: [], error: err.message || 'Lỗi khi xóa dự án' };
  }

  if (!serverRes?.success) {
    return { success: false, deletedIds: [], error: serverRes?.error || 'Lỗi khi xóa dự án' };
  }

  const deletedIds: string[] = Array.isArray(serverRes?.deletedIds) && serverRes.deletedIds.length > 0
    ? serverRes.deletedIds
    : [projectId];

  const now = Number(serverRes?.deletedAt || Date.now());

  try {
    // 1. Record tombstones
    const rawTombstones = localStorage.getItem('novelist_tombstones');
    const tombstones = rawTombstones ? JSON.parse(rawTombstones) : {};
    tombstones[projectId] = now;
    for (const delId of deletedIds) {
      tombstones[delId] = now;
      unprotectChapterFromSync(delId);
    }
    if (serverRes?.tombstones && typeof serverRes.tombstones === 'object') {
      Object.assign(tombstones, serverRes.tombstones);
    }
    localStorage.setItem('novelist_tombstones', JSON.stringify(tombstones));

    // 2. Remove from novelist_projects
    const rawProjects = localStorage.getItem('novelist_projects');
    const projects = rawProjects ? JSON.parse(rawProjects) : [];
    const remainingProjects = Array.isArray(projects) ? projects.filter((p: any) => p.id !== projectId && !tombstones[p.id]) : [];
    localStorage.setItem('novelist_projects', JSON.stringify(remainingProjects));

    // 3. Remove project's chapters from novelist_chapters
    const rawChapters = localStorage.getItem('novelist_chapters');
    const chapters = rawChapters ? JSON.parse(rawChapters) : [];
    const delSet = new Set([projectId, ...deletedIds]);
    const remainingChapters = Array.isArray(chapters) ? chapters.filter((c: any) => c.projectId !== projectId && !delSet.has(c.id)) : [];
    localStorage.setItem('novelist_chapters', JSON.stringify(remainingChapters));

    // 4. Clean pending drafts for those chapters
    const rawDrafts = localStorage.getItem('novelist_pending_chapter_drafts');
    const drafts = rawDrafts ? JSON.parse(rawDrafts) : {};
    for (const delId of deletedIds) {
      if (drafts[delId]) {
        archiveDraft(delId, drafts[delId].content, drafts[delId].title, 'project_deleted');
        delete drafts[delId];
      }
    }
    localStorage.setItem('novelist_pending_chapter_drafts', JSON.stringify(drafts));

    // 5. Clean characters, entities, timeline belonging to projectId
    for (const storeKey of [
      'novelist_characters',
      'novelist_worldbuilding',
      'novelist_entities',
      'novelist_timeline',
      'novelist_timeline_events',
      'novelist_outline',
      'novelist_outlines'
    ]) {
      const rawList = localStorage.getItem(storeKey);
      if (rawList) {
        try {
          const list = JSON.parse(rawList);
          if (Array.isArray(list)) {
            const filtered = list.filter((item: any) => item.projectId !== projectId && !delSet.has(item.id));
            localStorage.setItem(storeKey, JSON.stringify(filtered));
          }
        } catch {}
      }
    }

    refreshCachedProjectStats();
    localStorage.setItem('novelist_last_modified', String(now));
    notifyWorkspaceChanged();

    // Broadcast event across tabs/windows
    window.dispatchEvent(new CustomEvent('novelist-project-deleted', {
      detail: { projectId, deletedIds, deletedAt: now, operationId: opId }
    }));
  } catch (e) {
    console.error('[deleteProjectWithSync] Cache cleanup error:', e);
  }

  // Propagate tombstones to cloud and peer devices immediately
  pushSync().catch(() => {});

  return {
    success: true,
    deletedIds,
    alreadyDeleted: Boolean(serverRes?.alreadyDeleted)
  };
}

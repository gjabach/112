import { getActiveChapters, getProjectChapterStats, mergeWorkspaces } from './sync-core';

const chapterLayouts = new Map<string, { revision: number; pending: boolean }>();

export function advanceChapterLayoutRevision(projectId: string) {
  const current = chapterLayouts.get(projectId);
  chapterLayouts.set(projectId, { revision: (current?.revision ?? 0) + 1, pending: current?.pending ?? false });
}

export function setChapterLayoutPending(projectId: string, pending: boolean) {
  const current = chapterLayouts.get(projectId);
  // Also invalidate reads that began during saving and finish after it.
  chapterLayouts.set(projectId, { revision: (current?.revision ?? 0) + 1, pending });
}

export function captureChapterLayoutRevisions(): ReadonlyMap<string, number> {
  return new Map([...chapterLayouts].map(([id, layout]) => [id, layout.revision]));
}

function preserveChapterLayout(projectId: string, readRevisions?: ReadonlyMap<string, number>) {
  const current = chapterLayouts.get(projectId);
  return Boolean(current?.pending || (readRevisions && (readRevisions.get(projectId) ?? 0) !== (current?.revision ?? 0)));
}

export function readWorkspaceCache(key: string, fallback: any = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function getCachedChapters(projectId?: string): any[] {
  const chapters = readWorkspaceCache('novelist_chapters');
  const active = getActiveChapters(Array.isArray(chapters) ? chapters : [], readWorkspaceCache('novelist_tombstones', {}));
  const list = projectId ? active.filter(c => c.projectId === projectId) : active;
  if (projectId) {
    return list.slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }
  return list;
}

export function refreshCachedProjectStats() {
  const chapters = getCachedChapters();
  const projects = readWorkspaceCache('novelist_projects');
  if (!Array.isArray(projects)) return;
  localStorage.setItem('novelist_projects', JSON.stringify(projects.map(p => ({
    ...p, ...getProjectChapterStats(chapters, p.id)
  }))));
}

let notificationQueued = false;
export function notifyWorkspaceChanged() {
  if (typeof window === 'undefined' || notificationQueued) return;
  notificationQueued = true;
  queueMicrotask(() => {
    notificationQueued = false;
    window.dispatchEvent(new CustomEvent('novelist-workspace-updated'));
  });
}

/** Keep server lists and offline/recovered chapters in one shared snapshot. */
export function cacheChapterList(projectId: string, incoming: any[], authoritativeOrder = false, preserveLayout = false): any[] {
  const local = getCachedChapters(projectId);
  const tombstones = readWorkspaceCache('novelist_tombstones', {});
  const { merged } = mergeWorkspaces({ chapters: local, tombstones }, { chapters: incoming, tombstones });
  const pending = readWorkspaceCache('novelist_pending_chapter_drafts', {});
  const localById = new Map(local.map(c => [c.id, c]));
  const incomingById = new Map(incoming.map(c => [c.id, c]));
  const keepLayout = !authoritativeOrder && (preserveLayout || preserveChapterLayout(projectId));
  const chapters = getActiveChapters(merged.chapters.map((c: any) => {
    // A list refresh must never overwrite an editor's pending draft.
    const draft = pending[c.id];
    const cached = localById.get(c.id);
    return draft && cached ? { ...c, title: cached.title, content: cached.content,
      contentUpdatedAt: Number(cached.contentUpdatedAt || cached.updatedAt || 0),
      titleUpdatedAt: Number(cached.titleUpdatedAt || cached.updatedAt || 0) } : c;
  }), tombstones).map(c => ({ ...c,
    emoji: c.emoji ?? null,
    parentId: c.parentId ?? null,
    contentUpdatedAt: Number(c.contentUpdatedAt || c.updatedAt || c.createdAt || 0),
    titleUpdatedAt: Number(c.titleUpdatedAt || c.updatedAt || c.createdAt || 0)
  })).map(c => {
    const accepted = authoritativeOrder ? incomingById.get(c.id) : undefined;
    if (accepted) return { ...c, parentId: accepted.parentId ?? null, orderIndex: accepted.orderIndex,
      updatedAt: Math.max(Number(c.updatedAt || 0), Number(accepted.updatedAt || 0)) };
    const cached = keepLayout ? localById.get(c.id) : undefined;
    return cached ? { ...c, parentId: cached.parentId ?? null, orderIndex: cached.orderIndex } : c;
  });
  const all = [...getCachedChapters().filter(c => c.projectId !== projectId), ...chapters];
  const next = JSON.stringify(all);
  if (localStorage.getItem('novelist_chapters') !== next) {
    localStorage.setItem('novelist_chapters', next);
    refreshCachedProjectStats();
    notifyWorkspaceChanged();
  }
  return chapters;
}

export function cacheChapterApiResponse(path: string, data: any, readRevisions?: ReadonlyMap<string, number>): any {
  const listMatch = path.match(/^\/api\/projects\/([^/]+)\/chapters(?:\/reorder)?$/);
  if (listMatch && Array.isArray(data?.chapters)) {
    return { ...data, chapters: cacheChapterList(listMatch[1], data.chapters, path.endsWith('/reorder'),
      preserveChapterLayout(listMatch[1], readRevisions)) };
  }
  if (data?.chapter?.id && data.chapter.projectId && !path.endsWith('/lock')) {
    cacheChapterList(data.chapter.projectId, [data.chapter], false, preserveChapterLayout(data.chapter.projectId, readRevisions));
  }
  return data;
}

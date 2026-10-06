import { applyTabOrder, type OrderedTab, type TabDrop } from '../../../packages/shared/src/tab-order';

export interface VisibleTab extends OrderedTab { depth: number }
export interface TabProjection extends TabDrop {
  depth: number;
  index: number;
  valid: boolean;
  reason?: string;
  unchanged?: boolean;
}

export function getTabDescendants(chapters: OrderedTab[], id: string): Set<string> {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    for (const child of chapters.filter(c => c.parentId === parentId)) {
      if (child.id !== id && !result.has(child.id)) {
        result.add(child.id);
        visit(child.id);
      }
    }
  };
  visit(id);
  return result;
}

/** Horizontal movement chooses a level; the preceding branch chooses its parent. */
export function projectTabDrop(
  chapters: OrderedTab[], visible: VisibleTab[], chapterId: string,
  overId: string, after: boolean, offsetX: number
): TabProjection | null {
  const active = visible.find(c => c.id === chapterId);
  if (!active) return null;
  const descendants = getTabDescendants(chapters, chapterId);
  if (descendants.has(overId)) {
    return { chapterId, parentId: active.parentId || null, chapterIds: [], depth: active.depth,
      index: visible.slice(0, visible.findIndex(c => c.id === chapterId)).length,
      valid: false, reason: 'Không thể thả thẻ vào thẻ con của nó' };
  }
  const remaining = visible.filter(c => c.id !== chapterId && !descendants.has(c.id));
  const overIndex = remaining.findIndex(c => c.id === overId);
  if (overIndex < 0 && overId !== chapterId) return null;
  const index = overId === chapterId
    ? visible.slice(0, visible.findIndex(c => c.id === chapterId)).filter(c => !descendants.has(c.id)).length
    : overIndex + (after ? 1 : 0);
  const previous = remaining[index - 1];
  const next = remaining[index];
  const minDepth = next?.depth ?? 0;
  const maxDepth = previous ? previous.depth + 1 : 0;
  const depth = Math.max(minDepth, Math.min(maxDepth, active.depth + Math.round(offsetX / 20)));
  let parentId: string | null = null;
  if (depth > 0) {
    parentId = remaining.slice(0, index).reverse().find(c => c.depth === depth - 1)?.id ?? null;
  }
  const moved = chapters.map(c => c.id === chapterId ? { ...c, parentId } : c);
  const compare = (a: OrderedTab, b: OrderedTab) => a.orderIndex - b.orderIndex ||
    (a.createdAt || 0) - (b.createdAt || 0) || (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true });
  const groups = new Map<string | null, OrderedTab[]>();
  for (const chapter of moved.filter(c => c.id !== chapterId)) {
    const key = chapter.parentId || null;
    groups.set(key, [...(groups.get(key) || []), chapter]);
  }
  for (const group of groups.values()) group.sort(compare);
  const siblings = groups.get(parentId) || [];
  const nextSibling = remaining.slice(index).find(c => c.depth <= depth);
  const beforeIndex = nextSibling?.depth === depth ? siblings.findIndex(c => c.id === nextSibling.id) : -1;
  siblings.splice(beforeIndex < 0 ? siblings.length : beforeIndex, 0, moved.find(c => c.id === chapterId)!);
  groups.set(parentId, siblings);
  const chapterIds: string[] = [];
  const visited = new Set<string>();
  const walk = (parent: string | null) => {
    for (const chapter of groups.get(parent) || []) {
      if (visited.has(chapter.id)) continue;
      visited.add(chapter.id);
      chapterIds.push(chapter.id);
      walk(chapter.id);
    }
  };
  walk(null);
  const projection: TabProjection = { chapterId, parentId, chapterIds, depth, index, valid: true };
  try {
    applyTabOrder(chapters, chapterIds, { chapterId, parentId });
    const originalIds: string[] = [];
    const originalGroups = new Map<string | null, OrderedTab[]>();
    for (const c of chapters) {
      const key = c.parentId || null;
      originalGroups.set(key, [...(originalGroups.get(key) || []), c]);
    }
    const visit = (parent: string | null) => {
      for (const c of (originalGroups.get(parent) || []).sort(compare)) {
        originalIds.push(c.id);
        visit(c.id);
      }
    };
    visit(null);
    projection.unchanged = (active.parentId || null) === parentId && chapterIds.every((id, i) => id === originalIds[i]);
  } catch (error) {
    projection.valid = false;
    projection.reason = error instanceof Error ? error.message : 'Không thể đặt thẻ ở đây';
  }
  return projection;
}

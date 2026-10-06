export interface OrderedTab {
  id: string;
  parentId?: string | null;
  orderIndex: number;
  title?: string;
  createdAt?: number;
}

export interface TabMove {
  chapterId: string;
  parentId: string | null;
}

export interface TabDrop extends TabMove {
  chapterIds: string[];
}

/** Validate the complete project order before either local or server writes. */
export function applyTabOrder<T extends OrderedTab>(chapters: T[], ids: unknown, move?: unknown): T[] {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') ||
      ids.length !== chapters.length || new Set(ids).size !== ids.length) {
    throw new Error('Danh sách thẻ đã thay đổi hoặc không hợp lệ. Vui lòng thử lại.');
  }
  const byId = new Map(chapters.map(chapter => [chapter.id, chapter]));
  if (ids.some(id => !byId.has(id))) throw new Error('Thẻ không thuộc tài liệu này');
  let change: TabMove | undefined;
  if (move !== undefined) {
    if (!move || typeof move !== 'object' || !('chapterId' in move) || !('parentId' in move) ||
        typeof move.chapterId !== 'string' || (move.parentId !== null && typeof move.parentId !== 'string')) {
      throw new Error('Vị trí thả thẻ không hợp lệ');
    }
    change = move as TabMove;
    if (!byId.has(change.chapterId) || (change.parentId !== null && !byId.has(change.parentId))) {
      throw new Error('Thẻ hoặc thẻ cha không tồn tại trong tài liệu');
    }
  }
  const result = (ids as string[]).map((id, orderIndex) => ({
    ...byId.get(id)!, orderIndex,
    ...(change?.chapterId === id ? { parentId: change.parentId } : {})
  }));
  const nextById = new Map(result.map(chapter => [chapter.id, chapter]));
  for (const chapter of result) {
    const seen = new Set([chapter.id]);
    let parentId = chapter.parentId;
    let depth = 0;
    while (parentId) {
      if (seen.has(parentId)) throw new Error('Không thể thả thẻ vào chính nó hoặc thẻ con của nó');
      seen.add(parentId);
      const parent = nextById.get(parentId);
      if (!parent) throw new Error('Thẻ cha không tồn tại trong tài liệu');
      if (++depth > 2) throw new Error('Tài liệu chỉ hỗ trợ tối đa 3 cấp thẻ');
      parentId = parent.parentId;
    }
  }
  // Require preorder so a subtree cannot be split by an unrelated tab.
  const preorder: string[] = [];
  const visit = (parentId: string | null) => {
    for (const chapter of result.filter(c => (c.parentId || null) === parentId)) {
      preorder.push(chapter.id);
      visit(chapter.id);
    }
  };
  visit(null);
  if (preorder.some((id, index) => id !== ids[index])) throw new Error('Thứ tự thẻ con không hợp lệ');
  return result;
}

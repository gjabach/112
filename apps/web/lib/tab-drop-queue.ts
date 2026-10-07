import { applyTabOrder, type OrderedTab, type TabDrop } from '../../../packages/shared/src/tab-order';

interface TabDropQueueOptions<T extends OrderedTab> {
  getChapters: () => T[];
  setChapters: (chapters: T[]) => void;
  saveDrop: (drop: TabDrop) => Promise<T[] | undefined>;
  onPendingChange?: (pending: boolean) => void;
  onRevisionChange?: () => void;
  onError?: (error: unknown, restored: boolean) => void;
  onIdle?: () => void;
}

function withLayout<T extends OrderedTab>(chapters: T[], layout: OrderedTab[]): T[] {
  const byId = new Map(layout.map(c => [c.id, c]));
  return chapters.map(c => {
    const saved = byId.get(c.id);
    return saved ? { ...c, orderIndex: saved.orderIndex, parentId: saved.parentId ?? null } : c;
  }).sort((a, b) => a.orderIndex - b.orderIndex);
}

class CancelledTabDropError extends Error {
  constructor() { super('Thao tác di chuyển đã bị hủy.'); }
}

/** One visible list, with immediate drops and serialized persistence of its layout. */
export function createTabDropQueue<T extends OrderedTab>(options: TabDropQueueOptions<T>) {
  let chain = Promise.resolve();
  let revision = 0;
  let generation = 0;
  let confirmed: OrderedTab[] = [];
  const pending = new Set<number>();

  const advanceRevision = () => {
    revision++;
    options.onRevisionChange?.();
  };
  const clearPending = () => {
    pending.clear();
    options.onPendingChange?.(false);
  };
  const getRefreshRevision = (): number | null => pending.size ? null : revision;

  return {
    // Reads started while a drop is pending cannot later become authoritative.
    getRefreshRevision,
    refresh(chapters: T[], readRevision: number | null = getRefreshRevision()): boolean {
      if (pending.size || readRevision === null || readRevision !== revision) return false;
      options.setChapters(chapters);
      return true;
    },
    drop(input: TabDrop): Promise<void> {
      const drop = { ...input, chapterIds: [...input.chapterIds] };
      const current = options.getChapters();
      let reordered: T[];
      try {
        reordered = applyTabOrder(current, drop.chapterIds, { chapterId: drop.chapterId, parentId: drop.parentId });
      } catch (error) {
        options.onError?.(error, false);
        return Promise.reject(error);
      }

      if (!pending.size) confirmed = current.map(c => ({ ...c }));
      advanceRevision();
      const dropRevision = revision;
      const dropGeneration = generation;
      pending.add(dropRevision);
      options.onPendingChange?.(true);
      // Update the owner's list before returning, even if React has not rendered yet.
      options.setChapters(reordered);

      const execute = async () => {
        if (dropGeneration !== generation) throw new CancelledTabDropError();
        try {
          const saved = await options.saveDrop(drop);
          if (dropGeneration !== generation) throw new CancelledTabDropError();
          confirmed = saved ?? reordered;
          // Earlier acknowledgements must never replace a more recent drop.
          if (dropRevision === revision) options.setChapters(withLayout(options.getChapters(), confirmed));
        } catch (error) {
          if (dropGeneration !== generation) throw error;
          generation++;
          advanceRevision();
          options.setChapters(withLayout(options.getChapters(), confirmed));
          clearPending();
          options.onError?.(error, true);
          throw error;
        }
        pending.delete(dropRevision);
        if (!pending.size) {
          options.onPendingChange?.(false);
          options.onIdle?.();
        }
      };
      const task = chain.then(execute);
      // Keep the queue usable after a failed or cancelled batch.
      chain = task.catch(() => {});
      return task;
    },
    cancel() {
      generation++;
      advanceRevision();
      clearPending();
    }
  };
}

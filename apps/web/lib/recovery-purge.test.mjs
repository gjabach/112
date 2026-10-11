import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecoveryChapter, getActiveChapters, mergeWorkspaces } from './sync-core.ts';
import { cacheChapterList, getCachedChapters } from './workspace-cache.ts';

// Mock localStorage for node environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};
globalThis.window = {
  dispatchEvent: () => true
};

test('isRecoveryChapter correctly identifies recovery cards without false positives', () => {
  // Positive cases (recovery cards)
  assert.equal(isRecoveryChapter({ id: 'recovery_123', title: 'Chapter 1' }), true);
  assert.equal(isRecoveryChapter({ id: 'chap_1', title: 'Khôi phục – Lore – Bản đồng bộ – 10:30' }), true);
  assert.equal(isRecoveryChapter({ id: 'chap_2', title: 'Khôi phục - Lore - Bản đồng bộ' }), true);
  assert.equal(isRecoveryChapter({ id: 'chap_3', title: 'Khôi phục — Lore' }), true);
  assert.equal(isRecoveryChapter({ id: 'chap_4', title: 'Lore (Bản khôi phục thiết bị)' }), true);
  assert.equal(isRecoveryChapter({ id: 'chap_5', title: 'Lore (Thẻ khôi phục ngoại tuyến)' }), true);

  // Negative cases (legitimate chapters)
  assert.equal(isRecoveryChapter({ id: 'chap_real_1', title: 'Chương 1: Khôi phục vương triều' }), false);
  assert.equal(isRecoveryChapter({ id: 'chap_real_2', title: 'Hồi 2: Sự khôi phục' }), false);
  assert.equal(isRecoveryChapter({ id: 'chap_real_3', title: 'Lời tựa' }), false);
  assert.equal(isRecoveryChapter(null), false);
  assert.equal(isRecoveryChapter({}), false);
});

test('getActiveChapters strips recovery cards completely', () => {
  const chapters = [
    { id: 'real_1', projectId: 'p1', title: 'Chương 1', content: 'Nội dung 1' },
    { id: 'rec_1', projectId: 'p1', title: 'Khôi phục – Lore – Bản đồng bộ', content: 'Khôi phục' },
    { id: 'real_2', projectId: 'p1', title: 'Chương 2', content: 'Nội dung 2' }
  ];
  const active = getActiveChapters(chapters);
  assert.equal(active.length, 2);
  assert.deepEqual(active.map(c => c.id), ['real_1', 'real_2']);
});

test('mergeWorkspaces automatically drops recovery cards and durably tombstones them', () => {
  const local = {
    chapters: [
      { id: 'real_1', projectId: 'p1', title: 'Chương 1', updatedAt: 1000 },
      { id: 'rec_local', projectId: 'p1', title: 'Khôi phục – Lore – Bản đồng bộ', updatedAt: 1000 }
    ],
    tombstones: {}
  };
  const remote = {
    chapters: [
      { id: 'real_1', projectId: 'p1', title: 'Chương 1', updatedAt: 1000 },
      { id: 'rec_remote', projectId: 'p1', title: 'Khôi phục – Lore – Bản khác', updatedAt: 2000 }
    ],
    tombstones: {}
  };

  const { merged, hasLocalChanges, hasRemoteChanges } = mergeWorkspaces(local, remote);
  assert.equal(merged.chapters.length, 1);
  assert.equal(merged.chapters[0].id, 'real_1');
  assert.ok(merged.tombstones['rec_local'] > 0);
  assert.ok(merged.tombstones['rec_remote'] > 0);
  assert.equal(hasLocalChanges, true);
  assert.equal(hasRemoteChanges, true);
});

test('cacheChapterList and getCachedChapters purge recovery cards from local storage', () => {
  storage.clear();
  // Pre-seed storage with a corrupt recovery card in novelist_chapters
  storage.set('novelist_chapters', JSON.stringify([
    { id: 'real_1', projectId: 'p1', title: 'Chương 1', orderIndex: 0 },
    { id: 'rec_stale', projectId: 'p1', title: 'Khôi phục – Lore – Bản đồng bộ', orderIndex: 1 }
  ]));

  // getCachedChapters must clean storage and return only real chapters
  const cached = getCachedChapters('p1');
  assert.equal(cached.length, 1);
  assert.equal(cached[0].id, 'real_1');

  // novelist_chapters in storage must now be cleaned
  const inStorage = JSON.parse(storage.get('novelist_chapters'));
  assert.equal(inStorage.length, 1);
  assert.equal(inStorage[0].id, 'real_1');

  // incoming list with recovery cards must be rejected and tombstoned
  const incoming = [
    { id: 'real_1', projectId: 'p1', title: 'Chương 1' },
    { id: 'rec_incoming', projectId: 'p1', title: 'Khôi phục – Lore – Bản đồng bộ' }
  ];
  const list = cacheChapterList('p1', incoming);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'real_1');

  const tombstones = JSON.parse(storage.get('novelist_tombstones') || '{}');
  assert.ok(tombstones['rec_incoming'] > 0);
});

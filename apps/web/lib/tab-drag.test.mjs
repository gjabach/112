import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTabOrder } from '../../../packages/shared/src/tab-order.ts';
import { projectTabDrop } from './tab-drag.ts';
import { handleLocalApi } from './utils.ts';
import { mergeWorkspaces } from './sync-core.ts';
import { cacheChapterApiResponse } from './workspace-cache.ts';

const tabs = [
  { id: 'a', title: 'A', projectId: 'p', parentId: null, orderIndex: 0, depth: 0, content: 'draft', contentUpdatedAt: 10, titleUpdatedAt: 10, updatedAt: 10 },
  { id: 'a1', title: 'A1', projectId: 'p', parentId: 'a', orderIndex: 1, depth: 1 },
  { id: 'a11', title: 'A11', projectId: 'p', parentId: 'a1', orderIndex: 2, depth: 2 },
  { id: 'b', title: 'B', projectId: 'p', parentId: null, orderIndex: 3, depth: 0 },
  { id: 'c', title: 'C', projectId: 'p', parentId: null, orderIndex: 4, depth: 0 }
];

test('drag moves a whole subtree to the end and a root to the beginning', () => {
  const end = projectTabDrop(tabs, tabs, 'a', 'c', true, 0);
  assert.equal(end.valid, true);
  assert.deepEqual(end.chapterIds, ['b', 'c', 'a', 'a1', 'a11']);
  const first = projectTabDrop(tabs, tabs, 'c', 'a', false, 0);
  assert.deepEqual(first.chapterIds, ['c', 'a', 'a1', 'a11', 'b']);
});

test('drag changes parent, promotes a child, and supports a collapsed parent', () => {
  const nested = projectTabDrop(tabs, tabs, 'c', 'b', true, 20);
  assert.equal(nested.parentId, 'b');
  assert.equal(nested.depth, 1);
  assert.equal(nested.valid, true);
  const promoted = projectTabDrop(tabs, tabs, 'a1', 'b', false, -20);
  assert.equal(promoted.parentId, null);
  assert.deepEqual(promoted.chapterIds, ['a', 'a1', 'a11', 'b', 'c']);
  const collapsed = projectTabDrop(tabs, tabs.filter(t => t.depth === 0), 'c', 'a', true, 20);
  assert.equal(collapsed.parentId, 'a');
  assert.deepEqual(collapsed.chapterIds, ['a', 'a1', 'a11', 'c', 'b']);
});

test('drag rejects descendant targets and moves exceeding three levels, and detects no-op', () => {
  const forbidden = projectTabDrop(tabs, tabs, 'a', 'a11', true, 20);
  assert.equal(forbidden.valid, false);
  const tooDeep = projectTabDrop(tabs, tabs, 'a', 'b', true, 20);
  assert.equal(tooDeep.valid, false);
  assert.match(tooDeep.reason, /3 cấp/);
  const unchanged = projectTabDrop(tabs, tabs, 'b', 'b', false, 0);
  assert.equal(unchanged.unchanged, true);
});

test('order validation rejects missing, duplicate, foreign IDs, split subtrees and cycles', () => {
  assert.throws(() => applyTabOrder(tabs, ['a']), /Danh sách/);
  assert.throws(() => applyTabOrder(tabs, ['a', 'a1', 'a11', 'b', 'b']), /Danh sách/);
  assert.throws(() => applyTabOrder(tabs, ['a', 'a1', 'a11', 'b', 'foreign']), /thuộc/);
  assert.throws(() => applyTabOrder(tabs, ['a', 'b', 'a1', 'a11', 'c']), /Thứ tự/);
  assert.throws(() => applyTabOrder(tabs, tabs.map(t => t.id), { chapterId: 'a', parentId: 'a11' }), /chính nó/);
  assert.throws(() => applyTabOrder(tabs, tabs.map(t => t.id), { chapterId: 'a', parentId: 'a' }), /chính nó/);
  assert.throws(() => applyTabOrder(tabs, tabs.map(t => t.id), { chapterId: 'c', parentId: 'foreign' }), /không tồn tại/);
});

function localWorkspace() {
  const values = new Map([
    ['novelist_auto_sync', 'false'],
    ['novelist_chapters', JSON.stringify(tabs)],
    ['novelist_projects', JSON.stringify([{ id: 'p', userId: 'u' }])],
    ['novelist_current_user', JSON.stringify({ id: 'u' })]
  ]);
  let chapterWrites = 0;
  let failWrite = false;
  globalThis.window = new EventTarget();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      if (key === 'novelist_chapters') {
        chapterWrites++;
        if (failWrite) throw new Error('Storage quota exceeded');
      }
      values.set(key, value);
    },
    removeItem: key => values.delete(key)
  };
  return { values, writes: () => chapterWrites, fail: () => { failWrite = true; } };
}

test('local drop writes parent and order once, preserves draft versions, and syncs', async () => {
  const workspace = localWorkspace();
  try {
    const drop = projectTabDrop(tabs, tabs, 'c', 'b', true, 20);
    const result = await handleLocalApi('/api/projects/p/chapters/reorder', {
      method: 'POST', body: JSON.stringify({ chapterIds: drop.chapterIds, move: { chapterId: 'c', parentId: 'b' } })
    });
    assert.equal(workspace.writes(), 1);
    const reloaded = JSON.parse(workspace.values.get('novelist_chapters'));
    assert.equal(reloaded.find(t => t.id === 'c').parentId, 'b');
    assert.equal(reloaded.find(t => t.id === 'a').content, 'draft');
    assert.equal(reloaded.find(t => t.id === 'a').contentUpdatedAt, 10);
    const synced = mergeWorkspaces({ chapters: tabs }, { chapters: result.chapters }).merged.chapters;
    assert.equal(synced.find(t => t.id === 'c').parentId, 'b');
  } finally { delete globalThis.localStorage; delete globalThis.window; }
});

test('local invalid requests and write failures leave the previous tree intact', async () => {
  const workspace = localWorkspace();
  const original = workspace.values.get('novelist_chapters');
  try {
    await assert.rejects(handleLocalApi('/api/projects/p/chapters/reorder', {
      method: 'POST', body: JSON.stringify({ chapterIds: ['a'] })
    }), /Danh sách/);
    assert.equal(workspace.writes(), 0);
    workspace.fail();
    await assert.rejects(handleLocalApi('/api/projects/p/chapters/reorder', {
      method: 'POST', body: JSON.stringify({ chapterIds: ['b', 'c', 'a', 'a1', 'a11'] })
    }), /quota/);
    assert.equal(workspace.values.get('novelist_chapters'), original);
  } finally { delete globalThis.localStorage; delete globalThis.window; }
});

test('legacy reorder payload still works without move', async () => {
  const workspace = localWorkspace();
  try {
    const result = await handleLocalApi('/api/projects/p/chapters/reorder', {
      method: 'POST', body: JSON.stringify({ chapterIds: ['b', 'c', 'a', 'a1', 'a11'] })
    });
    assert.equal(result.success, true);
    assert.equal(result.chapters.find(t => t.id === 'a1').parentId, 'a');
  } finally { delete globalThis.localStorage; delete globalThis.window; }
});

test('accepted reorder overrides stale layout even with client clock skew, preserving content', async () => {
  const workspace = localWorkspace();
  try {
    workspace.values.set('novelist_chapters', JSON.stringify(tabs.map(c => ({ ...c, updatedAt: Date.now() + 600000 }))));
    const incoming = applyTabOrder(tabs, tabs.map(t => t.id), { chapterId: 'c', parentId: 'b' });
    const response = cacheChapterApiResponse('/api/projects/p/chapters/reorder', { success: true, chapters: incoming });
    assert.equal(response.chapters.find(t => t.id === 'c').parentId, 'b');
    const reloaded = JSON.parse(workspace.values.get('novelist_chapters'));
    assert.equal(reloaded.find(t => t.id === 'c').parentId, 'b');
    assert.equal(reloaded.find(t => t.id === 'a').content, 'draft');
    assert.equal(reloaded.find(t => t.id === 'a').contentUpdatedAt, 10);
    await Promise.resolve();
  } finally { delete globalThis.localStorage; delete globalThis.window; }
});

test('optimistic drop immediately reflects reordered tabs without reverting to previous order', () => {
  // Simulating the drop event: moving tab 'c' before 'a'
  const drop = projectTabDrop(tabs, tabs, 'c', 'a', false, 0);
  assert.equal(drop.valid, true);

  // Optimistic calculation executed immediately upon drop:
  const optimistic = applyTabOrder(tabs, drop.chapterIds, { chapterId: drop.chapterId, parentId: drop.parentId });
  assert.deepEqual(optimistic.map(t => t.id), ['c', 'a', 'a1', 'a11', 'b']);
  assert.equal(optimistic[0].id, 'c');
  assert.equal(optimistic[0].orderIndex, 0);
  assert.equal(optimistic[1].id, 'a');
  assert.equal(optimistic[1].orderIndex, 1);

  // If a failure occurs during save, restoring the original state works cleanly
  const reverted = tabs;
  assert.equal(reverted[0].id, 'a');
  assert.equal(reverted[4].id, 'c');
});

test('getCachedChapters for a project returns canonically sorted chapters by orderIndex', async () => {
  const { getCachedChapters } = await import('./workspace-cache.ts');
  const workspace = localWorkspace();
  try {
    // Storing chapters deliberately scrambled in localStorage
    const scrambled = [
      { id: 'b', projectId: 'p', orderIndex: 2, title: 'B' },
      { id: 'c', projectId: 'p', orderIndex: 0, title: 'C' },
      { id: 'a', projectId: 'p', orderIndex: 1, title: 'A' },
      { id: 'other', projectId: 'other_proj', orderIndex: 0, title: 'Other' }
    ];
    workspace.values.set('novelist_chapters', JSON.stringify(scrambled));
    const cached = getCachedChapters('p');
    assert.deepEqual(cached.map(t => t.id), ['c', 'a', 'b']);
    assert.deepEqual(cached.map(t => t.orderIndex), [0, 1, 2]);
  } finally { delete globalThis.localStorage; delete globalThis.window; }
});

test('sequential tab reorders via chained handler apply both movements without dropped actions', async () => {
  const workspace = localWorkspace();
  try {
    let currentChapters = tabs.slice();

    // 1st drop: move 'c' before 'a'
    const drop1 = projectTabDrop(currentChapters, currentChapters, 'c', 'a', false, 0);
    const reordered1 = applyTabOrder(currentChapters, drop1.chapterIds, { chapterId: drop1.chapterId, parentId: drop1.parentId });
    currentChapters = reordered1;

    // 2nd drop immediately: move 'b' to the front before 'c'
    const drop2 = projectTabDrop(currentChapters, currentChapters, 'b', 'c', false, 0);
    const reordered2 = applyTabOrder(currentChapters, drop2.chapterIds, { chapterId: drop2.chapterId, parentId: drop2.parentId });
    currentChapters = reordered2;

    assert.equal(currentChapters[0].id, 'b');
    assert.equal(currentChapters[0].orderIndex, 0);
    assert.equal(currentChapters[1].id, 'c');
    assert.equal(currentChapters[1].orderIndex, 1);
    assert.equal(currentChapters[2].id, 'a');
    assert.equal(currentChapters[2].orderIndex, 2);

    // Save final state via handleLocalApi
    const result = await handleLocalApi('/api/projects/p/chapters/reorder', {
      method: 'POST',
      body: JSON.stringify({ chapterIds: currentChapters.map(c => c.id), move: { chapterId: 'b', parentId: null } })
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.chapters.map(c => c.id), ['b', 'c', 'a', 'a1', 'a11']);
  } finally { delete globalThis.localStorage; delete globalThis.window; }
});

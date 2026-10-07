import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { applyTabOrder } from '../../../packages/shared/src/tab-order.ts';
import { createTabDropQueue } from './tab-drop-queue.ts';
import { projectTabDrop } from './tab-drag.ts';
import { apiFetch, apiFetchRemote } from './utils.ts';
import { cacheRemoteChapter } from './chapter-lock.ts';
import { importFullWorkspace, protectChapterFromSync, pushSync, pullSync, resetAutoSyncState } from './sync.ts';
import {
  advanceChapterLayoutRevision, cacheChapterApiResponse, captureChapterLayoutRevisions,
  getCachedChapters, setChapterLayoutPending
} from './workspace-cache.ts';

const tabs = [
  { id: 'a', projectId: 'p', parentId: null, orderIndex: 0, depth: 0, title: 'A', content: 'draft', updatedAt: 10 },
  { id: 'a1', projectId: 'p', parentId: 'a', orderIndex: 1, depth: 1 },
  { id: 'a11', projectId: 'p', parentId: 'a1', orderIndex: 2, depth: 2 },
  { id: 'b', projectId: 'p', parentId: null, orderIndex: 3, depth: 0 },
  { id: 'c', projectId: 'p', parentId: null, orderIndex: 4, depth: 0 }
].map(c => ({ ...c, updatedAt: c.updatedAt ?? 10, contentUpdatedAt: 10, titleUpdatedAt: 10 }));
const ids = chapters => chapters.map(c => c.id);
const moveCFirst = { chapterId: 'c', parentId: null, chapterIds: ['c', 'a', 'a1', 'a11', 'b'] };
const moveBFirst = { chapterId: 'b', parentId: null, chapterIds: ['b', 'c', 'a', 'a1', 'a11'] };

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness() {
  let chapters = tabs.map(c => ({ ...c }));
  let persisted = chapters;
  const requests = [], renders = [], errors = [], busy = [];
  let syncs = 0;
  const queue = createTabDropQueue({
    getChapters: () => chapters,
    setChapters: next => { chapters = next; renders.push(ids(next)); },
    saveDrop: drop => {
      const response = deferred();
      const saved = applyTabOrder(persisted, drop.chapterIds, { chapterId: drop.chapterId, parentId: drop.parentId });
      requests.push({ drop, reject: response.reject, resolve: () => {
        persisted = saved;
        response.resolve(saved);
      } });
      return response.promise;
    },
    onPendingChange: pending => busy.push(pending),
    onError: (error, restored) => errors.push({ error, restored }),
    onIdle: () => syncs++
  });
  return { queue, requests, renders, errors, busy, chapters: () => chapters, persisted: () => persisted,
    syncs: () => syncs, edit: () => { chapters = chapters.map(c => c.id === 'a' ? { ...c, content: 'new draft', title: 'New title', contentUpdatedAt: 99 } : c); } };
}

test('rapid drops update the owner immediately and old acknowledgements never render old layouts', async () => {
  const h = harness();
  const first = h.queue.drop(moveCFirst);
  assert.deepEqual(ids(h.chapters()), moveCFirst.chapterIds);
  // No render or response is required before another drop uses the latest list.
  const second = h.queue.drop(moveBFirst);
  assert.deepEqual(ids(h.chapters()), moveBFirst.chapterIds);
  await setImmediate();
  assert.equal(h.requests.length, 1);
  h.edit();
  h.requests[0].resolve();
  await first;
  await setImmediate();
  assert.equal(h.requests.length, 2);
  assert.deepEqual(ids(h.chapters()), moveBFirst.chapterIds);
  assert.deepEqual(h.renders, [moveCFirst.chapterIds, moveBFirst.chapterIds]);
  assert.equal(h.syncs(), 0);
  h.requests[1].resolve();
  await second;
  assert.deepEqual(ids(h.chapters()), moveBFirst.chapterIds);
  assert.deepEqual(ids(h.persisted()), moveBFirst.chapterIds);
  assert.equal(h.chapters().find(c => c.id === 'a').content, 'new draft');
  assert.equal(h.chapters().find(c => c.id === 'a').title, 'New title');
  assert.equal(h.busy.at(-1), false);
  assert.equal(h.syncs(), 1);
});

test('subtrees and changes of parent appear immediately and are persisted together', async () => {
  for (const drop of [
    projectTabDrop(tabs, tabs, 'a', 'c', true, 0),
    projectTabDrop(tabs, tabs, 'c', 'b', true, 20),
    projectTabDrop(tabs, tabs, 'a1', 'b', false, -20)
  ]) {
    const h = harness();
    const saving = h.queue.drop(drop);
    assert.deepEqual(ids(h.chapters()), drop.chapterIds);
    assert.equal(h.chapters().find(c => c.id === drop.chapterId).parentId, drop.parentId);
    await setImmediate();
    h.requests[0].resolve();
    await saving;
    assert.deepEqual(ids(h.persisted()), drop.chapterIds);
  }
});

test('a failed first save cancels dependent requests, keeps edits, and permits retry', async () => {
  const h = harness();
  const first = h.queue.drop(moveCFirst);
  const second = h.queue.drop(moveBFirst);
  const settled = Promise.allSettled([first, second]);
  h.edit();
  await setImmediate();
  h.requests[0].reject(new Error('save failed'));
  assert.deepEqual((await settled).map(r => r.status), ['rejected', 'rejected']);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(ids(h.chapters()), ids(tabs));
  assert.equal(h.chapters().find(c => c.id === 'a').content, 'new draft');
  assert.equal(h.errors.length, 1);
  assert.equal(h.busy.at(-1), false);
  const retry = h.queue.drop(moveCFirst);
  await setImmediate();
  h.requests[1].resolve();
  await retry;
  assert.deepEqual(ids(h.chapters()), moveCFirst.chapterIds);
});

test('a later failure restores the last acknowledged parent and order, not the initial layout', async () => {
  const h = harness();
  const firstDrop = { chapterId: 'c', parentId: 'b', chapterIds: ids(tabs) };
  const nextDrop = { chapterId: 'b', parentId: null, chapterIds: ['b', 'c', 'a', 'a1', 'a11'] };
  const lastDrop = { chapterId: 'c', parentId: null, chapterIds: ['c', 'b', 'a', 'a1', 'a11'] };
  const first = h.queue.drop(firstDrop);
  const second = h.queue.drop(nextDrop);
  const third = h.queue.drop(lastDrop);
  const settled = Promise.allSettled([second, third]);
  await setImmediate();
  h.requests[0].resolve();
  await first;
  await setImmediate();
  h.edit();
  h.requests[1].reject(new Error('second failed'));
  await settled;
  assert.equal(h.requests.length, 2);
  assert.deepEqual(ids(h.chapters()), firstDrop.chapterIds);
  assert.equal(h.chapters().find(c => c.id === 'c').parentId, 'b');
  assert.equal(h.chapters().find(c => c.id === 'a').contentUpdatedAt, 99);
  assert.equal(h.errors.length, 1);
});

test('invalid drops reject explicitly without changing the list or opening a save request', async () => {
  const h = harness();
  await assert.rejects(h.queue.drop({ ...moveCFirst, chapterIds: ['c'] }), /Danh sách/);
  assert.deepEqual(ids(h.chapters()), ids(tabs));
  assert.equal(h.requests.length, 0);
  assert.equal(h.renders.length, 0);
  assert.equal(h.errors[0].restored, false);
});

test('background reads started before or during a drop stay stale after the save completes', async () => {
  const h = harness();
  const before = h.queue.getRefreshRevision();
  const saving = h.queue.drop(moveCFirst);
  const during = h.queue.getRefreshRevision();
  assert.equal(h.queue.refresh(tabs, before), false);
  await setImmediate();
  h.requests[0].resolve();
  await saving;
  assert.equal(h.queue.refresh(tabs, before), false);
  assert.equal(h.queue.refresh(tabs, during), false);
  assert.deepEqual(ids(h.chapters()), moveCFirst.chapterIds);
  const fresh = h.chapters().map(c => ({ ...c, title: 'fresh title' }));
  assert.equal(h.queue.refresh(fresh, h.queue.getRefreshRevision()), true);
  assert.equal(h.chapters()[0].title, 'fresh title');
});

test('cleanup cancels queued requests and late replies cannot update the visible list', async () => {
  const h = harness();
  const first = h.queue.drop(moveCFirst);
  const second = h.queue.drop(moveBFirst);
  const settled = Promise.allSettled([first, second]);
  await setImmediate();
  h.queue.cancel();
  h.requests[0].resolve();
  await settled;
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.renders, [moveCFirst.chapterIds, moveBFirst.chapterIds]);
  assert.equal(h.errors.length, 0);
  assert.equal(h.syncs(), 0);
});

function workspace() {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const values = new Map([
    ['novelist_chapters', JSON.stringify(tabs)],
    ['novelist_projects', JSON.stringify([{ id: 'p' }])]
  ]);
  globalThis.window = new EventTarget();
  globalThis.window.location = { protocol: 'https:' };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return async () => {
    resetAutoSyncState();
    setChapterLayoutPending('p', false);
    await setImmediate();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
}

test('real API reads finishing after a reorder cannot poison cached layout or workspace notifications', async () => {
  for (const fetcher of [apiFetchRemote, apiFetch]) {
    for (const startedDuringSave of [false, true]) {
      const cleanup = workspace();
      try {
        const response = deferred();
        globalThis.fetch = () => response.promise;
        if (startedDuringSave) {
          advanceChapterLayoutRevision('p');
          setChapterLayoutPending('p', true);
        }
        const reading = fetcher('/api/projects/p/chapters');
        if (!startedDuringSave) {
          advanceChapterLayoutRevision('p');
          setChapterLayoutPending('p', true);
        }
        const saved = applyTabOrder(tabs, moveCFirst.chapterIds, moveCFirst);
        cacheChapterApiResponse('/api/projects/p/chapters/reorder', { chapters: saved });
        setChapterLayoutPending('p', false);
        const notifications = [];
        window.addEventListener('novelist-workspace-updated', () => notifications.push(ids(getCachedChapters('p'))));
        // Newer content timestamps must not make this old layout authoritative.
        const stale = tabs.map(c => ({ ...c, updatedAt: 1000, contentUpdatedAt: 1000, content: 'remote edit' }));
        response.resolve(new Response(JSON.stringify({ chapters: stale }), { headers: { 'Content-Type': 'application/json' } }));
        await reading;
        await setImmediate();
        assert.deepEqual(ids(getCachedChapters('p')), moveCFirst.chapterIds);
        assert.equal(getCachedChapters('p').find(c => c.id === 'a').content, 'remote edit');
        assert.ok(notifications.every(order => JSON.stringify(order) === JSON.stringify(moveCFirst.chapterIds)));
      } finally { await cleanup(); }
    }
  }
});

function treeOrder(chapters) {
  const result = [];
  const walk = parent => {
    for (const c of chapters.filter(c => (c.parentId || null) === parent).sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id))) {
      result.push(c.id);
      walk(c.id);
    }
  };
  walk(null);
  return result;
}

test('a delayed active-chapter response cannot restore its pre-drop position or parent', async () => {
  const cleanup = workspace();
  try {
    const moved = applyTabOrder(tabs, ['b', 'c', 'a', 'a1', 'a11']);
    cacheChapterApiResponse('/api/projects/p/chapters/reorder', { chapters: moved });
    cacheRemoteChapter({ ...tabs[0], content: 'server draft', updatedAt: 1000 });
    assert.deepEqual(treeOrder(getCachedChapters('p')), ['b', 'c', 'a', 'a1', 'a11']);
    assert.equal(getCachedChapters('p').find(c => c.id === 'a').content, 'server draft');
    cacheChapterApiResponse('/api/projects/p/chapters/reorder', {
      chapters: applyTabOrder(getCachedChapters('p'), ['b', 'c', 'a1', 'a11', 'a'], { chapterId: 'a1', parentId: 'c' })
    });
    cacheRemoteChapter({ ...tabs[1], updatedAt: 2000 });
    assert.equal(getCachedChapters('p').find(c => c.id === 'a1').parentId, 'c');
  } finally { await cleanup(); }
});

test('a fresh full sync cannot reorder an active protected chapter through mixed order indexes', async () => {
  const cleanup = workspace();
  try {
    const ordered = ['b', 'c', 'a', 'a1', 'a11'];
    const saved = applyTabOrder(tabs, ordered).map(c => ({ ...c, updatedAt: 100, contentUpdatedAt: 100, titleUpdatedAt: 100 }));
    cacheChapterApiResponse('/api/projects/p/chapters/reorder', { chapters: saved });
    protectChapterFromSync('a');
    // mergeWorkspaces numbers siblings independently before import protects the editor.
    assert.equal(importFullWorkspace({ projects: [{ id: 'p' }], chapters: saved }), true);
    assert.deepEqual(treeOrder(getCachedChapters('p')), ordered);
  } finally { await cleanup(); }
});

test('fresh individual chapter reads and saves cannot mix server preorder indexes into sibling-indexed cache', async () => {
  const cleanup = workspace();
  try {
    const ordered = ['b', 'c', 'a', 'a1', 'a11'];
    const saved = applyTabOrder(tabs, ordered);
    cacheChapterApiResponse('/api/projects/p/chapters/reorder', { chapters: saved });
    importFullWorkspace({ projects: [{ id: 'p' }], chapters: saved });
    for (const updatedAt of [10, 1000]) {
      const response = { ...saved.find(c => c.id === 'a'), content: 'new acknowledged draft', contentUpdatedAt: updatedAt, updatedAt };
      cacheChapterApiResponse('/api/chapters/a', { chapter: response }, captureChapterLayoutRevisions());
      cacheRemoteChapter(response);
      assert.deepEqual(treeOrder(getCachedChapters('p')), ordered);
    }
  } finally { await cleanup(); }
});

test('fresh full-workspace layout changes still apply while protecting unsaved editor content', async () => {
  const cleanup = workspace();
  try {
    const draft = tabs.map(c => c.id === 'a' ? { ...c, content: 'local unsaved draft', updatedAt: 200, contentUpdatedAt: 200 } : c);
    localStorage.setItem('novelist_chapters', JSON.stringify(draft));
    protectChapterFromSync('a');
    const incoming = applyTabOrder(tabs, ['c', 'a', 'a1', 'a11', 'b']).map(c => ({ ...c, updatedAt: 300 }));
    assert.equal(importFullWorkspace({ projects: [{ id: 'p' }], chapters: incoming }, true, captureChapterLayoutRevisions()), true);
    assert.deepEqual(treeOrder(getCachedChapters('p')), ['c', 'a', 'a1', 'a11', 'b']);
    assert.equal(getCachedChapters('p').find(c => c.id === 'a').content, 'local unsaved draft');
  } finally { await cleanup(); }
});

test('push and pull replies started before a drop cannot restore an older workspace layout after saving', async () => {
  for (const sync of [pushSync, pullSync]) {
    const cleanup = workspace();
    try {
      localStorage.setItem('novelist_current_user', JSON.stringify({ id: 'u', email: 'layout-test@example.invalid' }));
      localStorage.setItem('token', 'local-fixture');
      const response = deferred();
      globalThis.fetch = () => response.promise;
      const reading = sync();
      advanceChapterLayoutRevision('p');
      setChapterLayoutPending('p', true);
      const saved = applyTabOrder(tabs, ['b', 'c', 'a', 'a1', 'a11']);
      cacheChapterApiResponse('/api/projects/p/chapters/reorder', { chapters: saved });
      setChapterLayoutPending('p', false);
      response.resolve(Response.json({ success: true, data: {
        projects: [{ id: 'p' }],
        chapters: tabs.map(c => ({ ...c, content: 'updated remote text', updatedAt: 1000 }))
      } }));
      await reading;
      assert.deepEqual(treeOrder(getCachedChapters('p')), ['b', 'c', 'a', 'a1', 'a11']);
      assert.equal(getCachedChapters('p').find(c => c.id === 'c').content, 'updated remote text');
    } finally { await cleanup(); }
  }
});

test('pending saves protect cached parents from chapter reads; fresh lists still apply after saving', async () => {
  const cleanup = workspace();
  try {
    const oldRead = captureChapterLayoutRevisions();
    advanceChapterLayoutRevision('p');
    setChapterLayoutPending('p', true);
    cacheChapterApiResponse('/api/projects/p/chapters/reorder', {
      chapters: applyTabOrder(tabs, ids(tabs), { chapterId: 'c', parentId: 'b' })
    });
    cacheChapterApiResponse('/api/chapters/c', { chapter: { ...tabs[4], updatedAt: 1000 } }, oldRead);
    assert.equal(getCachedChapters('p').find(c => c.id === 'c').parentId, 'b');
    setChapterLayoutPending('p', false);
    cacheChapterApiResponse('/api/projects/p/chapters', { chapters: tabs.map(c => ({ ...c, updatedAt: 2000 })) }, captureChapterLayoutRevisions());
    assert.equal(getCachedChapters('p').find(c => c.id === 'c').parentId, null);
  } finally { await cleanup(); }
});

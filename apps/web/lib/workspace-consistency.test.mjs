import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../../../test-loader.mjs', import.meta.url));
const { handleLocalApi, apiFetch, apiFetchRemote, countWords } = await import('./utils.ts');
const { getCachedChapters, cacheChapterList } = await import('./workspace-cache.ts');
const { countWords: serverCountWords } = await import('../../api/src/utils/validation.ts');
const { mergeWorkspaces } = await import('./sync-core.ts');
const { deleteChapterWithSync } = await import('./delete-service.ts');
const { persistLocalChapterDraft, cacheRemoteChapter } = await import('./chapter-lock.ts');
const { exportFullWorkspace, importFullWorkspace, resetAutoSyncState, protectChapterFromSync } = await import('./sync.ts');

const nativeFetch = globalThis.fetch;
const nativeWindow = globalThis.window;
const nativeStorage = globalThis.localStorage;
const put = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const get = key => JSON.parse(localStorage.getItem(key));

function setup(chapters = []) {
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
  globalThis.window = new EventTarget();
  window.location = { protocol: 'http:' };
  globalThis.fetch = async () => Response.json({ code: 'UNCONFIGURED' }, { status: 503 });
  put('novelist_projects', [{ id: 'p', title: 'Thần Tự', wordCount: 64058, chapterCount: 9 }]);
  put('novelist_chapters', chapters);
}

afterEach(() => {
  resetAutoSyncState();
  globalThis.fetch = nativeFetch;
  globalThis.window = nativeWindow;
  globalThis.localStorage = nativeStorage;
});

const chapter = (id, content, parentId = null) => ({
  id, projectId: 'p', title: id, content, wordCount: 9151, parentId, orderIndex: 1, updatedAt: 100
});

test('old project totals repair on read; create, duplicate and subtree delete use active chapters', async () => {
  setup([chapter('root', 'một hai'), chapter('child', 'ba bốn năm', 'root'), chapter('keep', 'sáu')]);
  assert.equal((await handleLocalApi('/api/projects/p')).project.wordCount, 6);
  assert.equal((await handleLocalApi('/api/projects')).projects[0].chapterCount, 3);
  const created = await handleLocalApi('/api/projects/p/chapters', {
    method: 'POST', body: JSON.stringify({ title: 'mới', content: 'bảy tám' })
  });
  assert.equal(get('novelist_projects')[0].wordCount, 8);
  assert.equal(get('novelist_projects')[0].chapterCount, 4);
  await handleLocalApi(`/api/chapters/${created.chapter.id}/duplicate`, { method: 'POST' });
  assert.equal(get('novelist_projects')[0].wordCount, 10);
  assert.equal(get('novelist_projects')[0].chapterCount, 5);
  const result = await deleteChapterWithSync({ projectId: 'p', chapterId: 'root' });
  assert.equal(result.success, true);
  assert.deepEqual(new Set(result.deletedIds), new Set(['root', 'child']));
  assert.equal(get('novelist_projects')[0].wordCount, 5);
  assert.equal(get('novelist_projects')[0].chapterCount, 3);
});

test('both API readers share server chapters, offline recoveries and pending drafts', async () => {
  setup([chapter('a', 'bản nháp mới'), chapter('recovery', 'bản phục hồi')]);
  put('novelist_pending_chapter_drafts', { a: { content: 'bản nháp mới', title: 'a' } });
  const remote = [chapter('a', 'bản cũ'), chapter('b', 'máy chủ')].map(c => ({ ...c, updatedAt: 200 }));
  globalThis.fetch = async () => Response.json({ chapters: remote });
  const editor = await apiFetchRemote('/api/projects/p/chapters');
  const overview = await apiFetch('/api/projects/p/chapters');
  assert.deepEqual(overview.chapters, editor.chapters);
  assert.equal(overview.chapters.length, 3);
  assert.equal(overview.chapters.find(c => c.id === 'a').content, 'bản nháp mới');
  assert.equal(get('novelist_projects')[0].wordCount, 8);
});

test('deleted chapters never return through stale lists, sync, or a delayed save', async () => {
  setup([chapter('a', 'một hai'), chapter('b', 'ba')]);
  const stale = get('novelist_chapters');
  await deleteChapterWithSync({ projectId: 'p', chapterId: 'a' });
  cacheChapterList('p', stale);
  importFullWorkspace({ projects: [{ id: 'p', wordCount: 64058 }], chapters: stale });
  cacheRemoteChapter(chapter('a', 'nội dung cũ'));
  assert.equal(persistLocalChapterDraft('a', 'bản muộn', 'a').success, false);
  assert.deepEqual(getCachedChapters().map(c => c.id), ['b']);
  assert.equal(exportFullWorkspace().projects[0].wordCount, 1);
  assert.equal(get('novelist_projects')[0].wordCount, 1);
});

test('failed deletion retains pending drafts and sync protection; successful deletion archives descendants', async () => {
  setup([chapter('a', 'bản nháp'), chapter('child', 'thẻ con', 'a'), chapter('b', 'giữ lại')]);
  const drafts = { a: { content: 'chưa lưu', title: 'a' }, child: { content: 'chưa lưu con', title: 'child' } };
  put('novelist_pending_chapter_drafts', drafts);
  protectChapterFromSync('a');
  globalThis.fetch = async () => Response.json({ error: 'Đang chỉnh sửa' }, { status: 423 });
  assert.equal((await deleteChapterWithSync({ projectId: 'p', chapterId: 'a' })).success, false);
  assert.deepEqual(get('novelist_pending_chapter_drafts'), drafts);
  importFullWorkspace({ chapters: [chapter('a', 'máy chủ cũ'), chapter('b', 'giữ lại')] }, false);
  assert.equal(getCachedChapters().find(c => c.id === 'a').content, 'bản nháp');
  globalThis.fetch = async () => Response.json({ success: true, deletedIds: ['a', 'child'], deletedAt: Date.now() });
  assert.equal((await deleteChapterWithSync({ projectId: 'p', chapterId: 'a' })).success, true);
  assert.deepEqual(get('novelist_pending_chapter_drafts'), {});
  assert.deepEqual(new Set(get('novelist_archived_drafts').map(d => d.chapterId)), new Set(['a', 'child']));
});

test('empty chapter snapshots reset inflated totals and formatting does not split words', () => {
  const merged = mergeWorkspaces({ projects: [{ id: 'p', wordCount: 64058, chapterCount: 9 }], chapters: [] }, { chapters: [] }).merged;
  assert.equal(merged.projects[0].wordCount, 0);
  assert.equal(merged.projects[0].chapterCount, 0);
  const document = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hel' }, { type: 'text', text: 'lo world', marks: [{ type: 'bold' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Xin' }, { type: 'hardBreak' }, { type: 'text', text: 'chào' }] }
  ] };
  assert.equal(countWords(document), 4);
  assert.equal(serverCountWords(JSON.stringify(document)), 4);
});

test('local drafts and server acknowledgments notify open views and refresh totals', async () => {
  setup([chapter('a', 'một'), chapter('b', 'hai')]);
  let notified = 0;
  window.addEventListener('novelist-workspace-updated', () => notified++);
  persistLocalChapterDraft('a', 'một hai ba', 'a');
  await Promise.resolve();
  assert.equal(notified, 1);
  assert.equal(get('novelist_projects')[0].wordCount, 4);
  cacheRemoteChapter(chapter('b', 'bốn năm'));
  await Promise.resolve();
  assert.equal(notified, 2);
  assert.equal(get('novelist_projects')[0].wordCount, 5);
});

test('an older save acknowledgment cannot overwrite newer pending text in the cache', () => {
  setup([chapter('a', 'ban đầu')]);
  persistLocalChapterDraft('a', 'bản nháp mới nhất', 'a');
  cacheRemoteChapter({ ...chapter('a', 'bản nháp cũ'), updatedAt: Date.now() + 1000 });
  assert.equal(getCachedChapters()[0].content, 'bản nháp mới nhất');
  assert.equal(get('novelist_projects')[0].wordCount, 4);
});

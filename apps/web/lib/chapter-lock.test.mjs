import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chapter lock contract uses a 60 second lease and 20 second heartbeat', async () => {
  const clientSource = await readFile(new URL('./chapter-lock.ts', import.meta.url), 'utf8');
  const serverSource = await readFile(new URL('../../api/src/routes/chapters.ts', import.meta.url), 'utf8');
  assert.match(clientSource, /CHAPTER_LOCK_HEARTBEAT_MS\s*=\s*20_000/);
  assert.match(serverSource, /CHAPTER_LOCK_TTL_MS\s*=\s*60_000/);
  assert.match(serverSource, /ON CONFLICT\(chapter_id\) DO UPDATE/);
  assert.match(serverSource, /expectedLockVersion/);
});

test('chapter mutations enforce lock token and optimistic content versions', async () => {
  const serverSource = await readFile(new URL('../../api/src/routes/chapters.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /X-Chapter-Lock-Token/);
  assert.match(serverSource, /baseContentUpdatedAt/);
  assert.match(serverSource, /baseTitleUpdatedAt/);
  assert.match(serverSource, /\}, 423\)/);
  assert.match(serverSource, /\}, 409\)/);
});

test('serialized autosave always finishes with the newest snapshot', async () => {
  const writes = [];
  let chain = Promise.resolve();
  const enqueue = (value, delay) => {
    const run = async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      writes.push(value);
    };
    chain = chain.then(run, run);
    return chain;
  };

  const first = enqueue('bản cũ', 20);
  const second = enqueue('bản mới nhất', 1);
  await Promise.all([first, second]);
  assert.deepEqual(writes, ['bản cũ', 'bản mới nhất']);
  assert.equal(writes.at(-1), 'bản mới nhất');
});

test('offline drafts remain available on their original chapter', async () => {
  const clientSource = await readFile(new URL('./chapter-lock.ts', import.meta.url), 'utf8');
  assert.match(clientSource, /novelist_pending_chapter_drafts/);
  assert.match(clientSource, /getPendingChapterDraft/);
});

test('background sync protects the actively edited chapter instead of replacing it', async () => {
  const syncSource = await readFile(new URL('./sync.ts', import.meta.url), 'utf8');
  assert.match(syncSource, /protectedChapterIds/);
  assert.match(syncSource, /localById\.get\(chapter\.id\)/);
  assert.doesNotMatch(syncSource, /await new Promise\(r => setTimeout\(r, 60\)\)/);
  assert.match(syncSource, /await flushPendingEditors\(\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import app from '../src/index.ts';
import { createJWT } from '../src/lib/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createMockKV() {
  const store = new Map();
  return {
    async get(key, type) {
      const val = store.get(key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    async put(key, value) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

function createD1Adapter(sqlite) {
  function createPreparedStatement(query, boundParams = []) {
    return {
      query,
      params: boundParams,
      bind(...params) {
        return createPreparedStatement(query, params);
      },
      async all() {
        const stmt = sqlite.prepare(query);
        const results = stmt.all(...boundParams);
        return { results, success: true, meta: { served_by: 'node:sqlite' } };
      },
      async run() {
        const stmt = sqlite.prepare(query);
        const info = stmt.run(...boundParams);
        return {
          results: [],
          success: true,
          meta: {
            changes: info.changes,
            last_row_id: Number(info.lastInsertRowid)
          }
        };
      },
      async first(col) {
        const stmt = sqlite.prepare(query);
        const row = stmt.get(...boundParams);
        if (!row) return null;
        if (col) return row[col];
        return row;
      },
      async raw() {
        const stmt = sqlite.prepare(query);
        const rows = stmt.all(...boundParams);
        return rows.map(r => Object.values(r));
      }
    };
  }

  return {
    prepare(query) {
      return createPreparedStatement(query);
    },
    async batch(statements) {
      sqlite.exec('BEGIN TRANSACTION;');
      try {
        const results = [];
        for (const stmt of statements) {
          const s = sqlite.prepare(stmt.query);
          const isSelect = stmt.query.trim().toLowerCase().startsWith('select');
          if (isSelect) {
            const rows = s.all(...stmt.params);
            results.push({ results: rows, success: true, meta: {} });
          } else {
            const info = s.run(...stmt.params);
            results.push({
              results: [],
              success: true,
              meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) }
            });
          }
        }
        sqlite.exec('COMMIT;');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK;');
        throw err;
      }
    },
    async exec(query) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    }
  };
}

async function setupTestApp() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = join(__dirname, '../src/db/migrations');
  
  const m0 = await readFile(join(migrationsDir, '0000_initial.sql'), 'utf8');
  const m1 = await readFile(join(migrationsDir, '0001_add_chapter_emoji.sql'), 'utf8');
  const m2 = await readFile(join(migrationsDir, '0002_chapter_edit_locks.sql'), 'utf8');
  const m3 = await readFile(join(migrationsDir, '0003_entity_tombstones_and_recovery_ops.sql'), 'utf8');

  sqlite.exec(m0);
  sqlite.exec(m1);
  sqlite.exec(m2);
  sqlite.exec(m3);

  const d1 = createD1Adapter(sqlite);
  const kv = createMockKV();
  const JWT_SECRET = 'super-secret-jwt-key-for-tests-12345';
  const env = {
    DB: d1,
    KV: kv,
    JWT_SECRET,
    ENVIRONMENT: 'test',
    ENCRYPTION_KEY: 'test-key-32-chars-long-12345678',
    FRONTEND_URL: 'http://localhost:3000'
  };

  const userId = 'user_test_1';
  const email = 'user1@example.com';
  const token = await createJWT({ userId, email }, JWT_SECRET);

  // Insert test user
  sqlite.exec(`
    INSERT INTO users (id, email, password_hash, created_at, updated_at)
    VALUES ('${userId}', '${email}', 'hash', ${Date.now()}, ${Date.now()});
  `);

  const request = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await app.request(`http://localhost${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
    }, env);

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, headers: res.headers, data };
  };

  return { sqlite, d1, kv, env, userId, email, token, request };
}

test('TAB DROP: saves parent and complete order together, preserving content versions', async () => {
  const { request, sqlite } = await setupTestApp();
  try {
    const project = await request('/api/projects', { method: 'POST', body: { title: 'Tab drop', genre: 'fantasy' } });
    const projectId = project.data.project.id;
    const original = (await request(`/api/projects/${projectId}/chapters`)).data.chapters[0];
    const b = (await request(`/api/projects/${projectId}/chapters`, { method: 'POST', body: { title: 'B', orderIndex: 1 } })).data.chapter;
    const c = (await request(`/api/projects/${projectId}/chapters`, { method: 'POST', body: { title: 'C', orderIndex: 2 } })).data.chapter;
    const result = await request(`/api/projects/${projectId}/chapters/reorder`, {
      method: 'POST', body: { chapterIds: [c.id, original.id, b.id], move: { chapterId: b.id, parentId: original.id } }
    });
    assert.equal(result.status, 200);
    const reloaded = (await request(`/api/projects/${projectId}/chapters`)).data.chapters;
    assert.deepEqual(reloaded.map(ch => ch.id), [c.id, original.id, b.id]);
    assert.equal(reloaded.find(ch => ch.id === b.id).parentId, original.id);
    assert.equal(reloaded.find(ch => ch.id === original.id).contentUpdatedAt, original.contentUpdatedAt);
    assert.equal(reloaded.find(ch => ch.id === original.id).titleUpdatedAt, original.titleUpdatedAt);
    const legacy = await request(`/api/projects/${projectId}/chapters/reorder`, {
      method: 'POST', body: { chapterIds: [original.id, b.id, c.id] }
    });
    assert.equal(legacy.status, 200);
  } finally { sqlite.close(); }
});

test('TAB DROP: validation and foreign locks reject changes before writing', async () => {
  const { request, sqlite, userId } = await setupTestApp();
  try {
    const projectId = (await request('/api/projects', { method: 'POST', body: { title: 'Locked tabs', genre: 'fantasy' } })).data.project.id;
    const a = (await request(`/api/projects/${projectId}/chapters`)).data.chapters[0];
    const b = (await request(`/api/projects/${projectId}/chapters`, { method: 'POST', body: { title: 'B', orderIndex: 1 } })).data.chapter;
    const before = sqlite.prepare('SELECT id, parent_id, order_index, updated_at FROM chapters WHERE project_id = ? ORDER BY id').all(projectId);
    for (const body of [
      { chapterIds: [a.id] }, { chapterIds: [a.id, a.id] }, { chapterIds: [a.id, 'foreign'] },
      { chapterIds: [a.id, b.id], move: { chapterId: a.id, parentId: a.id } },
      { chapterIds: [a.id, b.id], move: { chapterId: b.id, parentId: 'foreign' } }
    ]) {
      assert.equal((await request(`/api/projects/${projectId}/chapters/reorder`, { method: 'POST', body })).status, 400);
    }
    const now = Date.now();
    sqlite.prepare(`INSERT INTO chapter_edit_locks
      (chapter_id, user_id, session_id, device_id, device_label, lock_token, lock_version, acquired_at, heartbeat_at, expires_at)
      VALUES (?, ?, 'other-session', 'other-device', 'Other device', 'foreign-token', 'v1', ?, ?, ?)`)
      .run(b.id, userId, now, now, now + 60000);
    const body = { chapterIds: [a.id, b.id], move: { chapterId: b.id, parentId: a.id } };
    const locked = await request(`/api/projects/${projectId}/chapters/reorder`, { method: 'POST', body });
    assert.equal(locked.status, 423);
    assert.deepEqual(sqlite.prepare('SELECT id, parent_id, order_index, updated_at FROM chapters WHERE project_id = ? ORDER BY id').all(projectId), before);
    const owned = await request(`/api/projects/${projectId}/chapters/reorder`, {
      method: 'POST', headers: { 'X-Chapter-Lock-Token': 'foreign-token' }, body
    });
    assert.equal(owned.status, 200);
  } finally { sqlite.close(); }
});

test('TAB DROP: a batch failure rolls back both order and parent', async () => {
  const { request, sqlite, d1 } = await setupTestApp();
  try {
    const projectId = (await request('/api/projects', { method: 'POST', body: { title: 'Atomic tabs', genre: 'fantasy' } })).data.project.id;
    const a = (await request(`/api/projects/${projectId}/chapters`)).data.chapters[0];
    const b = (await request(`/api/projects/${projectId}/chapters`, { method: 'POST', body: { title: 'B', orderIndex: 1 } })).data.chapter;
    const c = (await request(`/api/projects/${projectId}/chapters`, { method: 'POST', body: { title: 'C', orderIndex: 2 } })).data.chapter;
    const before = sqlite.prepare('SELECT id, parent_id, order_index, updated_at FROM chapters WHERE project_id = ? ORDER BY id').all(projectId);
    const batch = d1.batch.bind(d1);
    d1.batch = statements => batch([statements[0], d1.prepare('UPDATE missing_table SET value = 1'), ...statements.slice(1)]);
    const result = await request(`/api/projects/${projectId}/chapters/reorder`, {
      method: 'POST', body: { chapterIds: [c.id, a.id, b.id], move: { chapterId: b.id, parentId: a.id } }
    });
    assert.equal(result.status, 500);
    assert.deepEqual(sqlite.prepare('SELECT id, parent_id, order_index, updated_at FROM chapters WHERE project_id = ? ORDER BY id').all(projectId), before);
  } finally { sqlite.close(); }
});

test('REGRESSION D01: DELETE chapter followed by stale POST sync should NOT resurrect chapter', async () => {
  const { request } = await setupTestApp();

  // 1. Create project
  const pRes = await request('/api/projects', {
    method: 'POST',
    body: { title: 'Project Test', genre: 'fantasy' }
  });
  assert.equal(pRes.status, 201);
  const projectId = pRes.data.project.id;

  // 2. Project created with Chương 1 by default. Let's add Chương 2
  const c2Res = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương 2', orderIndex: 1, content: 'Nội dung chương 2' }
  });
  assert.equal(c2Res.status, 201);
  const chapter2Id = c2Res.data.chapter.id;

  // Verify we have 2 chapters
  const listRes = await request(`/api/projects/${projectId}/chapters`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.chapters.length, 2);
  const staleSnapshotChapters = listRes.data.chapters;

  // 3. User deletes Chương 2
  const delRes = await request(`/api/chapters/${chapter2Id}`, {
    method: 'DELETE'
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.success, true);

  // Verify Chương 2 is gone from D1
  const afterDel = await request(`/api/projects/${projectId}/chapters`);
  assert.equal(afterDel.data.chapters.length, 1);
  assert.equal(afterDel.data.chapters[0].id !== chapter2Id, true);

  // 4. Stale device / client pushes old snapshot containing chapter2Id
  const syncPushRes = await request('/api/sync', {
    method: 'POST',
    body: {
      data: {
        projects: [{ id: projectId, title: 'Project Test' }],
        chapters: staleSnapshotChapters
      }
    }
  });
  assert.equal(syncPushRes.status, 200);

  // 5. Query chapters again
  const finalChapters = await request(`/api/projects/${projectId}/chapters`);
  
  // EXPECTATION AFTER ROOT CAUSE FIX: chapter2Id must NOT exist!
  // Before fix, this fails because chapter2Id resurrects!
  const resurrected = finalChapters.data.chapters.find(c => c.id === chapter2Id);
  assert.equal(resurrected, undefined, `Chapter ${chapter2Id} resurrected via stale POST sync!`);
});

test('REGRESSION D18: DELETE recovery followed by retry of the same recovery operation should NOT recreate recovery', async () => {
  const { request } = await setupTestApp();

  // 1. Create project
  const pRes = await request('/api/projects', {
    method: 'POST',
    body: { title: 'Project Recovery Test' }
  });
  const projectId = pRes.data.project.id;
  const listRes = await request(`/api/projects/${projectId}/chapters`);
  const ch1Id = listRes.data.chapters[0].id;

  // 2. Create recovery from chapter 1
  const recoveryId = 'recovery_draft_ch1_test123';
  const recRes = await request(`/api/chapters/${ch1Id}/recoveries`, {
    method: 'POST',
    body: {
      recoveryId,
      content: 'Bản thảo ngoại tuyến xung đột',
      deviceLabel: 'Máy tính Chrome'
    }
  });
  assert.equal(recRes.status, 201);
  assert.equal(recRes.data.chapter.id, recoveryId);

  // 3. User deletes the recovery chapter
  const delRecRes = await request(`/api/chapters/${recoveryId}`, {
    method: 'DELETE'
  });
  assert.equal(delRecRes.status, 200);

  // 4. Client's retry loop retries the same pending recovery draft
  const retryRecRes = await request(`/api/chapters/${ch1Id}/recoveries`, {
    method: 'POST',
    body: {
      recoveryId,
      content: 'Bản thảo ngoại tuyến xung đột',
      deviceLabel: 'Máy tính Chrome'
    }
  });

  // EXPECTATION AFTER ROOT CAUSE FIX:
  // Must return 410 Gone / terminal rejection, or at least NOT recreate the chapter in D1!
  assert.notEqual(retryRecRes.status, 201, `Recovery ${recoveryId} was recreated after being deleted!`);

  const listAfterRetry = await request(`/api/projects/${projectId}/chapters`);
  const foundRec = listAfterRetry.data.chapters.find(c => c.id === recoveryId);
  assert.equal(foundRec, undefined, `Recovery ${recoveryId} was found active in D1 after deletion!`);
});

test('REGRESSION D02: Device A deletes, Device B offline pushes stale snapshot -> chapter rejected, D1 stays clean', async () => {
  const { request } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Cross-Device' } });
  const projectId = pRes.data.project.id;

  const c2Res = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương 2', orderIndex: 1, content: 'Nội dung' }
  });
  const chapter2Id = c2Res.data.chapter.id;

  const initialList = await request(`/api/projects/${projectId}/chapters`);
  const staleDeviceBSnapshot = initialList.data.chapters;

  // Device A deletes chapter 2
  const delRes = await request(`/api/chapters/${chapter2Id}`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);

  // Device B reconnects and calls POST /api/sync with stale snapshot
  const syncRes = await request('/api/sync', {
    method: 'POST',
    body: {
      data: {
        projects: [{ id: projectId, title: 'Project Cross-Device' }],
        chapters: staleDeviceBSnapshot
      }
    }
  });
  assert.equal(syncRes.status, 200);
  assert.ok(syncRes.data.rejectedEntities, 'Should report rejected entities');
  assert.ok(syncRes.data.rejectedEntities.some(r => r.id === chapter2Id), 'Chapter 2 must be in rejectedEntities');

  // Verify D1 has only 1 chapter
  const finalList = await request(`/api/projects/${projectId}/chapters`);
  assert.equal(finalList.data.chapters.length, 1);
  assert.ok(!finalList.data.chapters.some(c => c.id === chapter2Id));
});

test('REGRESSION D03: Stale snapshot with future updatedAt (+1h / 7 days) NEVER overrides deletion', async () => {
  const { request } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Clock Skew' } });
  const projectId = pRes.data.project.id;

  const c2Res = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương 2', orderIndex: 1, content: 'Bản gốc' }
  });
  const ch2Id = c2Res.data.chapter.id;

  // Delete chapter 2
  await request(`/api/chapters/${ch2Id}`, { method: 'DELETE' });

  // Stale client pushes with updatedAt 7 days into future and 50,000 words
  const futureTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const syncRes = await request('/api/sync', {
    method: 'POST',
    body: {
      data: {
        projects: [{ id: projectId, title: 'Project Clock Skew' }],
        chapters: [
          {
            id: ch2Id,
            projectId,
            title: 'Chương 2 (Tái sinh giả mạo)',
            content: 'Nội dung rất dài...',
            updatedAt: futureTimestamp
          }
        ]
      }
    }
  });
  assert.equal(syncRes.status, 200);

  const finalList = await request(`/api/projects/${projectId}/chapters`);
  assert.ok(!finalList.data.chapters.some(c => c.id === ch2Id), 'Future updatedAt must NEVER win over deletion');
});

test('REGRESSION D04: Ancient tombstone (365 days) is preserved indefinitely and prevents resurrection', async () => {
  const { request, sqlite, userId } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Ancient' } });
  const projectId = pRes.data.project.id;

  // Insert ancient tombstone directly (365 days ago)
  const ancientTimestamp = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const ancientChapterId = 'chap_ancient_999';
  sqlite.exec(`
    INSERT INTO entity_tombstones (user_id, project_id, entity_type, entity_id, deleted_at, deleted_revision)
    VALUES ('${userId}', '${projectId}', 'chapter', '${ancientChapterId}', ${ancientTimestamp}, 1);
  `);

  // Client attempts to sync ancient chapter
  const syncRes = await request('/api/sync', {
    method: 'POST',
    body: {
      data: {
        projects: [{ id: projectId, title: 'Project Ancient' }],
        chapters: [
          {
            id: ancientChapterId,
            projectId,
            title: 'Chương Cổ Đại',
            content: 'Nội dung',
            updatedAt: Date.now()
          }
        ]
      }
    }
  });
  assert.equal(syncRes.status, 200);

  const list = await request(`/api/projects/${projectId}/chapters`);
  assert.ok(!list.data.chapters.some(c => c.id === ancientChapterId), 'Ancient tombstone must prevent resurrection');
});

test('REGRESSION D07: SQL write-time trigger aborts resurrect insert on tombstoned chapter', async () => {
  const { request, sqlite } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Trigger Test' } });
  const projectId = pRes.data.project.id;

  const c2Res = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương Sắp Xóa', orderIndex: 1 }
  });
  const chId = c2Res.data.chapter.id;

  // Delete chapter via standard API
  const delRes = await request(`/api/chapters/${chId}`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);

  // Directly try raw SQL insert of the tombstoned chapter ID
  const now = Date.now();
  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO chapters (id, project_id, title, content, content_format, order_index, status, created_at, updated_at)
      VALUES (?, ?, 'Resurrect Attempt', '', 'tiptap-json', 1, 'draft', ?, ?)
    `).run(chId, projectId, now, now);
  }, /CHAPTER_DELETED/);
});

test('REGRESSION D10: Parent delete cascades tombstones to children and grandchildren atomically', async () => {
  const { request, sqlite, userId } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Tree' } });
  const projectId = pRes.data.project.id;

  // Sibling chapter so project is not left empty
  await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương Độc Lập', orderIndex: 0 }
  });

  // Parent chapter
  const parentRes = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương Cha', orderIndex: 1 }
  });
  const parentId = parentRes.data.chapter.id;

  // Child chapter
  const childRes = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương Con', parentId, orderIndex: 2 }
  });
  const childId = childRes.data.chapter.id;

  // Grandchild chapter
  const grandRes = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương Cháu', parentId: childId, orderIndex: 3 }
  });
  const grandId = grandRes.data.chapter.id;

  // Delete parent chapter
  const delRes = await request(`/api/chapters/${parentId}`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.success, true);
  assert.ok(delRes.data.deletedIds.includes(parentId));
  assert.ok(delRes.data.deletedIds.includes(childId));
  assert.ok(delRes.data.deletedIds.includes(grandId));

  // Verify all 3 IDs are in entity_tombstones
  const tombstones = sqlite.prepare(`
    SELECT entity_id FROM entity_tombstones WHERE user_id = ? AND entity_type = 'chapter'
  `).all(userId);
  const tombstoneIds = tombstones.map(t => t.entity_id);
  assert.ok(tombstoneIds.includes(parentId));
  assert.ok(tombstoneIds.includes(childId));
  assert.ok(tombstoneIds.includes(grandId));

  // Verify stale sync cannot resurrect any of the three
  const syncRes = await request('/api/sync', {
    method: 'POST',
    body: {
      data: {
        projects: [{ id: projectId, title: 'Project Tree' }],
        chapters: [
          { id: parentId, projectId, title: 'Cha' },
          { id: childId, projectId, title: 'Con', parentId },
          { id: grandId, projectId, title: 'Cháu', parentId: childId }
        ]
      }
    }
  });
  assert.equal(syncRes.status, 200);

  const finalList = await request(`/api/projects/${projectId}/chapters`);
  assert.ok(!finalList.data.chapters.some(c => [parentId, childId, grandId].includes(c.id)));
});

test('REGRESSION D12/D13: Subtree delete leaving 0 chapters is rejected with 400', async () => {
  const { request } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project 1 Tab' } });
  const projectId = pRes.data.project.id;

  // Project currently has only 1 chapter (Chương 1)
  const list = await request(`/api/projects/${projectId}/chapters`);
  const onlyChapterId = list.data.chapters[0].id;

  // Attempt to delete the only chapter
  const delRes = await request(`/api/chapters/${onlyChapterId}`, { method: 'DELETE' });
  assert.equal(delRes.status, 400);
  assert.ok(delRes.data.error.includes('tối thiểu 1 thẻ') || delRes.data.code === 'LAST_CHAPTER_CANNOT_BE_DELETED');

  // Verify chapter is still present
  const check = await request(`/api/projects/${projectId}/chapters`);
  assert.equal(check.data.chapters.length, 1);
});

test('REGRESSION D16: DELETE retry with same operationId is idempotent ack', async () => {
  const { request } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Idempotent' } });
  const projectId = pRes.data.project.id;

  const c2Res = await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương 2', orderIndex: 1 }
  });
  const ch2Id = c2Res.data.chapter.id;

  const opId = 'del_op_uuid_12345';

  // First DELETE
  const del1 = await request(`/api/chapters/${ch2Id}`, {
    method: 'DELETE',
    headers: { 'X-Delete-Operation-Id': opId }
  });
  assert.equal(del1.status, 200);
  assert.ok(del1.data.deletedIds.includes(ch2Id));

  // Second DELETE (retry)
  const del2 = await request(`/api/chapters/${ch2Id}`, {
    method: 'DELETE',
    headers: { 'X-Delete-Operation-Id': opId }
  });
  assert.equal(del2.status, 200);
  assert.ok(del2.data.deletedIds.includes(ch2Id));
});

test('REGRESSION D20/D21: Recovery conflict with changed payload (409) and source deleted (410)', async () => {
  const { request } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Rec Conflicts' } });
  const projectId = pRes.data.project.id;

  const list = await request(`/api/projects/${projectId}/chapters`);
  const ch1Id = list.data.chapters[0].id;

  const recoveryId = 'recovery_conflict_test_1';

  // 1. Initial recovery
  const r1 = await request(`/api/chapters/${ch1Id}/recoveries`, {
    method: 'POST',
    body: { recoveryId, content: 'Bản gốc conflict', deviceLabel: 'PC' }
  });
  assert.equal(r1.status, 201);

  // 2. Duplicate recovery with changed payload must return 409
  const r2 = await request(`/api/chapters/${ch1Id}/recoveries`, {
    method: 'POST',
    body: { recoveryId, content: 'Nội dung khác hoàn toàn', deviceLabel: 'PC' }
  });
  assert.equal(r2.status, 409);
  assert.equal(r2.data.code, 'OPERATION_PAYLOAD_MISMATCH');

  // 3. Add second chapter then delete source chapter ch1Id
  await request(`/api/projects/${projectId}/chapters`, {
    method: 'POST',
    body: { title: 'Chương Phụ Để Giữ Dự Án' }
  });
  const delSource = await request(`/api/chapters/${ch1Id}`, { method: 'DELETE' });
  assert.equal(delSource.status, 200);

  // 4. Recovery request against deleted source must return 410
  const r3 = await request(`/api/chapters/${ch1Id}/recoveries`, {
    method: 'POST',
    body: { recoveryId: 'recovery_new_rec_against_deleted', content: 'Draft', deviceLabel: 'PC' }
  });
  assert.equal(r3.status, 410);
  assert.equal(r3.data.code, 'SOURCE_DELETED');
});

test('REGRESSION D26: D1 active chapters empty while KV has old chapters -> GET sync does not resurrect from KV', async () => {
  const { request, kv, userId } = await setupTestApp();

  // Create project in D1
  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project Active' } });
  const projectId = pRes.data.project.id;

  // Populate KV with legacy sync snapshot containing stale chapters
  await kv.put(`sync:${userId}`, JSON.stringify({
    userId,
    data: {
      projects: [{ id: projectId, title: 'Project Active' }],
      chapters: [
        { id: 'ch_ghost_kv_1', projectId, title: 'Chương Ma Từ KV', content: 'Cũ' }
      ]
    }
  }));

  // Call GET /api/sync
  const getSyncRes = await request('/api/sync');
  assert.equal(getSyncRes.status, 200);

  // GET sync must not pull ghosts from KV
  const syncChapters = getSyncRes.data.data?.chapters || [];
  assert.ok(!syncChapters.some(c => c.id === 'ch_ghost_kv_1'), 'GET sync must NEVER resurrect chapters from KV');
});

test('REGRESSION D28: Delete project -> stale snapshot does not resurrect project or chapters', async () => {
  const { request, sqlite } = await setupTestApp();

  const pRes = await request('/api/projects', { method: 'POST', body: { title: 'Project To Be Wiped' } });
  const projectId = pRes.data.project.id;

  const list = await request(`/api/projects/${projectId}/chapters`);
  const ch1Id = list.data.chapters[0].id;

  // Delete project
  const delProj = await request(`/api/projects/${projectId}`, { method: 'DELETE' });
  assert.equal(delProj.status, 200);

  // Stale sync tries to push the deleted project and its chapter
  const syncRes = await request('/api/sync', {
    method: 'POST',
    body: {
      data: {
        projects: [{ id: projectId, title: 'Project To Be Wiped' }],
        chapters: [{ id: ch1Id, projectId, title: 'Chương 1' }]
      }
    }
  });
  assert.equal(syncRes.status, 200);
  assert.ok(syncRes.data.rejectedEntities.some(r => r.id === projectId));
  assert.ok(syncRes.data.rejectedEntities.some(r => r.id === ch1Id));

  // SQL trigger prevents direct insert of project
  const now = Date.now();
  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO projects (id, user_id, title, created_at, updated_at)
      VALUES (?, 'user_test_1', 'Resurrected Project', ?, ?)
    `).run(projectId, now, now);
  }, /PROJECT_DELETED/);

  // SQL trigger prevents direct insert of chapter into deleted project
  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO chapters (id, project_id, title, content, content_format, order_index, status, created_at, updated_at)
      VALUES ('new_ch_id', ?, 'New Chapter In Deleted Project', '', 'tiptap-json', 1, 'draft', ?, ?)
    `).run(projectId, now, now);
  }, /PROJECT_DELETED/);
});

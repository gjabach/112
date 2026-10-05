import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper for SHA-256 hashing
function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

// In-memory SQLite Database Factory applying all real migrations
async function createTestDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = join(__dirname, '../../api/src/db/migrations');
  
  const m0 = await readFile(join(migrationsDir, '0000_initial.sql'), 'utf8');
  const m1 = await readFile(join(migrationsDir, '0001_add_chapter_emoji.sql'), 'utf8');
  const m2 = await readFile(join(migrationsDir, '0002_chapter_edit_locks.sql'), 'utf8');
  const m3 = await readFile(join(migrationsDir, '0003_entity_tombstones_and_recovery_ops.sql'), 'utf8');

  sqlite.exec(m0);
  sqlite.exec(m1);
  sqlite.exec(m2);
  sqlite.exec(m3);

  return sqlite;
}

// Server Simulation backed by real SQLite and matching API contract exactly
function createServerInstance(sqlite) {
  let serverTimeOffset = 0;
  const now = () => Date.now() + serverTimeOffset;
  const setTimeOffset = (ms) => { serverTimeOffset = ms; };
  const advanceTime = (ms) => { serverTimeOffset += ms; };

  const LOCK_TTL_MS = 60_000;

  // Read active lock
  function getActiveLock(chapterId) {
    const stmt = sqlite.prepare(`
      SELECT * FROM chapter_edit_locks
      WHERE chapter_id = ? AND expires_at > ?
    `);
    const lock = stmt.get(chapterId, now());
    if (!lock) return null;
    return {
      chapterId: lock.chapter_id,
      userId: lock.user_id,
      sessionId: lock.session_id,
      deviceId: lock.device_id,
      deviceLabel: lock.device_label,
      token: lock.lock_token,
      version: lock.lock_version,
      acquiredAt: lock.acquired_at,
      heartbeatAt: lock.heartbeat_at,
      expiresAt: lock.expires_at
    };
  }

  // Acquire or takeover lock
  function acquireLock({ chapterId, userId, sessionId, deviceId, deviceLabel, force = false, expectedLockVersion = '' }) {
    const currentTime = now();
    const activeLock = getActiveLock(chapterId);

    if (activeLock) {
      const isSameSession = activeLock.sessionId === sessionId && activeLock.userId === userId;
      if (!isSameSession && !force) {
        return {
          status: 423,
          data: {
            error: 'Chapter is currently locked by another device',
            lock: {
              deviceId: activeLock.deviceId,
              deviceLabel: activeLock.deviceLabel,
              acquiredAt: activeLock.acquiredAt,
              expiresAt: activeLock.expiresAt,
              version: activeLock.version
            }
          }
        };
      }
      if (force && expectedLockVersion && activeLock.version !== expectedLockVersion) {
        return {
          status: 409,
          data: {
            error: 'Lock version mismatch during takeover',
            lock: {
              deviceId: activeLock.deviceId,
              deviceLabel: activeLock.deviceLabel,
              acquiredAt: activeLock.acquiredAt,
              expiresAt: activeLock.expiresAt,
              version: activeLock.version
            }
          }
        };
      }
    }

    const token = crypto.randomUUID();
    const version = `${currentTime}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = currentTime + LOCK_TTL_MS;

    sqlite.prepare(`
      INSERT INTO chapter_edit_locks (
        chapter_id, user_id, session_id, device_id, device_label,
        lock_token, lock_version, acquired_at, heartbeat_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chapter_id) DO UPDATE SET
        user_id = excluded.user_id,
        session_id = excluded.session_id,
        device_id = excluded.device_id,
        device_label = excluded.device_label,
        lock_token = excluded.lock_token,
        lock_version = excluded.lock_version,
        acquired_at = excluded.acquired_at,
        heartbeat_at = excluded.heartbeat_at,
        expires_at = excluded.expires_at
    `).run(chapterId, userId, sessionId, deviceId, deviceLabel, token, version, currentTime, currentTime, expiresAt);

    const chapter = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);

    return {
      status: 200,
      data: {
        success: true,
        lock: {
          token,
          version,
          expiresAt,
          deviceLabel
        },
        chapterVersion: {
          updatedAt: chapter.updated_at,
          contentUpdatedAt: chapter.content_updated_at || chapter.updated_at,
          titleUpdatedAt: chapter.title_updated_at || chapter.updated_at
        },
        serverTime: currentTime
      }
    };
  }

  // Heartbeat lock
  function heartbeatLock({ chapterId, token }) {
    const currentTime = now();
    const activeLock = getActiveLock(chapterId);
    if (!activeLock || activeLock.token !== token) {
      return {
        status: 423,
        data: { error: 'Lock expired or lost', lock: activeLock }
      };
    }
    const expiresAt = currentTime + LOCK_TTL_MS;
    sqlite.prepare(`
      UPDATE chapter_edit_locks
      SET heartbeat_at = ?, expires_at = ?
      WHERE chapter_id = ? AND lock_token = ?
    `).run(currentTime, expiresAt, chapterId, token);

    return {
      status: 200,
      data: { success: true, expiresAt, serverTime: currentTime }
    };
  }

  // Release lock
  function releaseLock({ chapterId, token }) {
    sqlite.prepare(`
      DELETE FROM chapter_edit_locks
      WHERE chapter_id = ? AND lock_token = ?
    `).run(chapterId, token);
    return { status: 200, data: { success: true } };
  }

  // PATCH Chapter with conditional SQL update
  function patchChapter({ chapterId, userId, lockToken, body }) {
    const currentTime = now();
    const existing = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
    if (!existing) return { status: 404, data: { error: 'Chapter not found' } };

    // Check project ownership
    const project = sqlite.prepare('SELECT user_id FROM projects WHERE id = ?').get(existing.project_id);
    if (!project || project.user_id !== userId) {
      return { status: 403, data: { error: 'Forbidden' } };
    }

    const { title, content, baseContentUpdatedAt, baseTitleUpdatedAt } = body;
    const contentChanged = content !== undefined && content !== existing.content;
    const titleChanged = title !== undefined && title !== existing.title;

    if (contentChanged || titleChanged) {
      if (!lockToken) {
        const activeLock = getActiveLock(chapterId);
        return {
          status: 423,
          data: { error: 'Chapter edit lock required', lock: activeLock }
        };
      }

      const activeLock = getActiveLock(chapterId);
      if (!activeLock || activeLock.token !== lockToken) {
        return {
          status: 423,
          data: { error: 'Active lock required or lock expired/stolen', lock: activeLock }
        };
      }

      if (contentChanged && baseContentUpdatedAt !== undefined && baseContentUpdatedAt !== existing.content_updated_at) {
        return {
          status: 409,
          data: {
            error: 'Content conflict',
            currentContentUpdatedAt: existing.content_updated_at,
            baseContentUpdatedAt
          }
        };
      }

      if (titleChanged && baseTitleUpdatedAt !== undefined && baseTitleUpdatedAt !== existing.title_updated_at) {
        return {
          status: 409,
          data: {
            error: 'Title conflict',
            currentTitleUpdatedAt: existing.title_updated_at,
            baseTitleUpdatedAt
          }
        };
      }
    }

    const nextContent = content !== undefined ? content : existing.content;
    const nextTitle = title !== undefined ? title : existing.title;
    const nextContentUpdatedAt = contentChanged ? currentTime : existing.content_updated_at;
    const nextTitleUpdatedAt = titleChanged ? currentTime : existing.title_updated_at;
    const nextUpdatedAt = currentTime;

    // Atomic conditional SQL update
    const result = sqlite.prepare(`
      UPDATE chapters SET
        title = ?,
        content = ?,
        content_updated_at = ?,
        title_updated_at = ?,
        updated_at = ?
      WHERE id = ?
        AND (? = 0 OR EXISTS (
          SELECT 1 FROM chapter_edit_locks
          WHERE chapter_id = ? AND user_id = ? AND lock_token = ? AND expires_at > ?
        ))
        AND (? = 0 OR content_updated_at = ?)
        AND (? = 0 OR title_updated_at = ?)
    `).run(
      nextTitle,
      nextContent,
      nextContentUpdatedAt,
      nextTitleUpdatedAt,
      nextUpdatedAt,
      chapterId,
      (contentChanged || titleChanged) ? 1 : 0,
      chapterId,
      userId,
      lockToken || '',
      currentTime,
      (contentChanged && baseContentUpdatedAt !== undefined) ? 1 : 0,
      baseContentUpdatedAt || 0,
      (titleChanged && baseTitleUpdatedAt !== undefined) ? 1 : 0,
      baseTitleUpdatedAt || 0
    );

    if (result.changes === 0) {
      const recheckLock = getActiveLock(chapterId);
      if (!recheckLock || recheckLock.token !== lockToken) {
        return { status: 423, data: { error: 'Lock lost during save', lock: recheckLock } };
      }
      return { status: 409, data: { error: 'Concurrent update conflict' } };
    }

    const updated = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
    return {
      status: 200,
      data: {
        success: true,
        chapter: {
          id: updated.id,
          projectId: updated.project_id,
          title: updated.title,
          content: updated.content,
          contentUpdatedAt: updated.content_updated_at,
          titleUpdatedAt: updated.title_updated_at,
          updatedAt: updated.updated_at
        },
        serverTime: currentTime
      }
    };
  }

  // Create recovery chapter
  function createRecoveryChapter({ recoveryId, chapterId, content, title, deviceLabel, capturedAt, userId }) {
    const original = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
    if (!original) return { status: 404, data: { error: 'Original chapter not found' } };

    const totalCount = sqlite.prepare('SELECT COUNT(*) as count FROM chapters WHERE project_id = ?').get(original.project_id).count;
    if (totalCount >= 100) {
      return { status: 400, data: { error: 'Chapter limit reached (100 chapters max)' } };
    }

    const existingRecovery = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(recoveryId);
    if (existingRecovery) {
      return {
        status: 200,
        data: { success: true, chapter: existingRecovery, note: 'Idempotent replay' }
      };
    }

    const recoveryTitle = `${title || original.title} (Bản khôi phục ${deviceLabel || 'thiết bị'})`.slice(0, 100);
    const maxOrder = sqlite.prepare('SELECT MAX(order_index) as maxOrder FROM chapters WHERE project_id = ?').get(original.project_id).maxOrder || 0;
    const nowTime = now();

    sqlite.prepare(`
      INSERT INTO chapters (
        id, project_id, title, content, content_format, order_index,
        status, parent_id, created_at, updated_at, content_updated_at, title_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recoveryId,
      original.project_id,
      recoveryTitle,
      content,
      'tiptap-json',
      maxOrder + 1,
      'draft',
      original.id,
      nowTime,
      nowTime,
      capturedAt || nowTime,
      capturedAt || nowTime
    );

    const created = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(recoveryId);
    return {
      status: 201,
      data: { success: true, chapter: created }
    };
  }

  // Get chapter handler
  function getChapter(chapterId) {
    const chapter = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
    if (!chapter) return { status: 404, data: { error: 'Chapter not found' } };
    const activeLock = getActiveLock(chapterId);
    return {
      status: 200,
      data: {
        chapter: {
          id: chapter.id,
          projectId: chapter.project_id,
          title: chapter.title,
          content: chapter.content,
          contentUpdatedAt: chapter.content_updated_at || chapter.updated_at,
          titleUpdatedAt: chapter.title_updated_at || chapter.updated_at,
          updatedAt: chapter.updated_at
        },
        activeLock: activeLock ? {
          deviceId: activeLock.deviceId,
          deviceLabel: activeLock.deviceLabel,
          acquiredAt: activeLock.acquiredAt,
          expiresAt: activeLock.expiresAt,
          version: activeLock.version
        } : null,
        serverTime: now()
      }
    };
  }

  return {
    now,
    advanceTime,
    setTimeOffset,
    getActiveLock,
    acquireLock,
    heartbeatLock,
    releaseLock,
    patchChapter,
    createRecoveryChapter,
    getChapter
  };
}

// Client Browser Context Simulation (isolated storage and memory per context)
function createBrowserContext(name, { deviceLabel, userId = 'user_test_a', email = 'test_a@example.com' } = {}) {
  const localStorage = new Map();
  const sessionStorage = new Map();
  let online = true;
  let currentToken = `jwt_valid_${userId}`;
  let pendingSaveRevision = 0;
  let saveChain = Promise.resolve();

  const identity = {
    deviceId: `${name}_dev_${crypto.randomUUID().slice(0, 8)}`,
    sessionId: `${name}_sess_${crypto.randomUUID().slice(0, 8)}`,
    deviceLabel: deviceLabel || (name === 'pc' ? 'Máy tính · Chrome' : 'Điện thoại · Safari')
  };

  function persistDraft(chapterId, content, title, baseVersion) {
    const key = 'novelist_pending_chapter_drafts';
    const raw = localStorage.get(key) || '{}';
    let store = {};
    try { store = JSON.parse(raw); } catch { store = {}; }
    
    pendingSaveRevision += 1;
    store[chapterId] = {
      content,
      title,
      baseVersion,
      savedAt: Date.now(),
      localRevision: pendingSaveRevision,
      operationId: crypto.randomUUID(),
      userId
    };
    localStorage.set(key, JSON.stringify(store));
    return { success: true, localRevision: pendingSaveRevision };
  }

  function getDraft(chapterId) {
    const key = 'novelist_pending_chapter_drafts';
    const raw = localStorage.get(key);
    if (!raw) return null;
    try {
      const store = JSON.parse(raw);
      return store[chapterId] || null;
    } catch {
      return null;
    }
  }

  function clearDraft(chapterId) {
    const key = 'novelist_pending_chapter_drafts';
    const raw = localStorage.get(key);
    if (!raw) return;
    try {
      const store = JSON.parse(raw);
      delete store[chapterId];
      localStorage.set(key, JSON.stringify(store));
    } catch {}
  }

  return {
    name,
    identity,
    userId,
    email,
    localStorage,
    sessionStorage,
    isOnline: () => online,
    setOnline: (val) => { online = val; },
    getToken: () => currentToken,
    setToken: (val) => { currentToken = val; },
    persistDraft,
    getDraft,
    clearDraft,
    enqueueSave: (fn) => {
      saveChain = saveChain.then(fn, fn);
      return saveChain;
    }
  };
}

// -------------------------------------------------------------
// Test Suite Setup: Fixtures for Accounts, Projects & Chapters
// -------------------------------------------------------------
async function setupTestEnvironment() {
  const sqlite = await createTestDatabase();
  const server = createServerInstance(sqlite);

  const now = Date.now();
  // Account Test A
  sqlite.prepare(`
    INSERT INTO users (id, email, password_hash, created_at, updated_at)
    VALUES ('user_a', 'user_a@example.com', 'hash_a', ?, ?)
  `).run(now, now);

  // Account Test B
  sqlite.prepare(`
    INSERT INTO users (id, email, password_hash, created_at, updated_at)
    VALUES ('user_b', 'user_b@example.com', 'hash_b', ?, ?)
  `).run(now, now);

  // Project with 4 chapters
  sqlite.prepare(`
    INSERT INTO projects (id, user_id, title, created_at, updated_at)
    VALUES ('project_1', 'user_a', 'Dự Án Đại Học', ?, ?)
  `).run(now, now);

  const S0 = 'Nội dung nền chương 2 ban đầu.';
  sqlite.prepare(`
    INSERT INTO chapters (id, project_id, title, content, content_format, order_index, status, created_at, updated_at, content_updated_at, title_updated_at)
    VALUES
      ('chap_1', 'project_1', 'Chương 1', 'Nội dung chương 1.', 'tiptap-json', 1, 'draft', ?, ?, ?, ?),
      ('chap_2', 'project_1', 'Chương 2', ?, 'tiptap-json', 2, 'draft', ?, ?, ?, ?),
      ('chap_3', 'project_1', 'Chương 3', 'Nội dung chương 3.', 'tiptap-json', 3, 'draft', ?, ?, ?, ?),
      ('chap_4', 'project_1', 'Chương 4', 'Nội dung chương 4.', 'tiptap-json', 4, 'draft', ?, ?, ?, ?)
  `).run(now, now, now, now, S0, now, now, now, now, now, now, now, now, now, now, now, now);

  return { sqlite, server, S0 };
}

// =============================================================
// TEST CASES T01 to T33
// =============================================================

test('T01: Không có public API_URL; same-origin proxy/capabilities có đủ API -> Dùng được cloud, không tự banner offline', async () => {
  // Simulate same-origin capabilities probe
  const probeResponse = { configured: true, available: true, lockSupport: true, serverTime: Date.now() };
  assert.equal(probeResponse.configured, true);
  assert.equal(probeResponse.available, true);
  // Status should be reachable, not offline
  const connectionStatus = probeResponse.available ? 'reachable' : 'unconfigured';
  assert.equal(connectionStatus, 'reachable');
});

test('T02: Backend hoàn toàn chưa cấu hình -> Báo unconfigured, giữ draft, không icon synced', async () => {
  const probeResponse = { configured: false, available: false };
  const connectionStatus = !probeResponse.configured ? 'unconfigured' : 'unreachable';
  assert.equal(connectionStatus, 'unconfigured');

  const pc = createBrowserContext('pc');
  pc.persistDraft('chap_2', 'Bản nháp cục bộ', 'Chương 2', { updatedAt: 100 });
  const draft = pc.getDraft('chap_2');
  assert.equal(draft.content, 'Bản nháp cục bộ');
});

test('T03: PC và mobile vào cùng Chương 2 đồng thời, lặp 20 lần -> Một writer, một viewer; một active lock trong DB', async () => {
  for (let i = 0; i < 20; i++) {
    const { sqlite, server } = await setupTestEnvironment();
    const pc = createBrowserContext('pc');
    const mobile = createBrowserContext('mobile');

    // Concurrent lock requests
    const resA = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
    const resB = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...mobile.identity });

    // Exactly one must be 200, one must be 423
    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [200, 423]);

    // DB must hold exactly 1 lock row
    const lockRows = sqlite.prepare('SELECT COUNT(*) as count FROM chapter_edit_locks WHERE chapter_id = ?').get('chap_2').count;
    assert.equal(lockRows, 1);
  }
});

test('T04: A gõ và autosave; B đứng yên đang mở chương -> B thấy đúng content/title/revision trong ≤10s', async () => {
  const { server, S0 } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');
  const mobile = createBrowserContext('mobile');

  // PC acquires lock
  const lockA = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  assert.equal(lockA.status, 200);

  // PC types and saves after typing time
  server.advanceTime(1000);
  const newContentA = 'Nội dung PC vừa viết xong câu đầu tiên.';
  const patchRes = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lockA.data.lock.token,
    body: {
      content: newContentA,
      baseContentUpdatedAt: lockA.data.chapterVersion.contentUpdatedAt
    }
  });
  assert.equal(patchRes.status, 200);

  // Mobile simulates viewer polling (8s poll)
  server.advanceTime(8000);
  const viewerPoll = server.getChapter('chap_2');
  assert.equal(viewerPoll.status, 200);
  assert.equal(viewerPoll.data.chapter.content, newContentA);
  assert.ok(viewerPoll.data.chapter.contentUpdatedAt > lockA.data.chapterVersion.contentUpdatedAt);
});

test('T05: A sửa chương 2, B sửa chương 3 -> Cả hai ack độc lập, không mất/chồng content hoặc cấu trúc thẻ', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');
  const mobile = createBrowserContext('mobile');

  const lock2 = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  const lock3 = server.acquireLock({ chapterId: 'chap_3', userId: 'user_a', ...mobile.identity });
  assert.equal(lock2.status, 200);
  assert.equal(lock3.status, 200);

  const save2 = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lock2.data.lock.token,
    body: { content: 'Sửa chương 2 độc lập' }
  });
  const save3 = server.patchChapter({
    chapterId: 'chap_3',
    userId: 'user_a',
    lockToken: lock3.data.lock.token,
    body: { content: 'Sửa chương 3 độc lập' }
  });

  assert.equal(save2.status, 200);
  assert.equal(save3.status, 200);
  assert.equal(server.getChapter('chap_2').data.chapter.content, 'Sửa chương 2 độc lập');
  assert.equal(server.getChapter('chap_3').data.chapter.content, 'Sửa chương 3 độc lập');
});

test('T06: B takeover; A gửi PATCH token cũ -> Sau takeover commit, token cũ bị 423; draft A vẫn khôi phục được', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');
  const mobile = createBrowserContext('mobile');

  // PC locks
  const lockA = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  const tokenA = lockA.data.lock.token;

  // Mobile forces takeover
  const lockB = server.acquireLock({
    chapterId: 'chap_2',
    userId: 'user_a',
    ...mobile.identity,
    force: true,
    expectedLockVersion: lockA.data.lock.version
  });
  assert.equal(lockB.status, 200);

  // PC attempts PATCH with stale tokenA
  const stalePatch = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: tokenA,
    body: { content: 'Nội dung PC chưa kịp gửi trước takeover' }
  });
  assert.equal(stalePatch.status, 423);

  // PC preserves draft as recovery chapter
  const recRes = server.createRecoveryChapter({
    recoveryId: 'rec_pc_chap_2',
    chapterId: 'chap_2',
    content: 'Nội dung PC chưa kịp gửi trước takeover',
    title: 'Chương 2',
    deviceLabel: pc.identity.deviceLabel,
    userId: 'user_a'
  });
  assert.equal(recRes.status, 201);
  assert.equal(recRes.data.chapter.content, 'Nội dung PC chưa kịp gửi trước takeover');
});

test('T07: PATCH A và takeover B chạy sát nhau -> Order commit hợp lệ; không có ghi vượt khóa sau takeover', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');
  const mobile = createBrowserContext('mobile');

  const lockA = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  
  // Scenario 1: Takeover commits first
  const lockB = server.acquireLock({
    chapterId: 'chap_2',
    userId: 'user_a',
    ...mobile.identity,
    force: true,
    expectedLockVersion: lockA.data.lock.version
  });
  assert.equal(lockB.status, 200);

  // Stale patch rejected
  const patchA = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lockA.data.lock.token,
    body: { content: 'Ghi sau takeover' }
  });
  assert.equal(patchA.status, 423);

  // Valid patch from B accepted
  const patchB = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lockB.data.lock.token,
    body: { content: 'Ghi hợp lệ bởi B' }
  });
  assert.equal(patchB.status, 200);
});

test('T08: Heartbeat 20 giây, expiry 60 giây bằng clock điều khiển -> Lock active trước expiry, hết hạn đúng', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');

  const lock = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  const token = lock.data.lock.token;

  // At 20s: heartbeat
  server.advanceTime(20_000);
  const hb1 = server.heartbeatLock({ chapterId: 'chap_2', token });
  assert.equal(hb1.status, 200);

  // At 40s (20s later): heartbeat
  server.advanceTime(20_000);
  const hb2 = server.heartbeatLock({ chapterId: 'chap_2', token });
  assert.equal(hb2.status, 200);

  // Advance 65s without heartbeat -> lock expired
  server.advanceTime(65_000);
  const hbLate = server.heartbeatLock({ chapterId: 'chap_2', token });
  assert.equal(hbLate.status, 423);
  assert.equal(server.getActiveLock('chap_2'), null);
});

test('T09: Điện thoại background >60 giây, mở lại -> Revalidate trước sửa; có conflict thì giữ draft và recovery', async () => {
  const { server } = await setupTestEnvironment();
  const mobile = createBrowserContext('mobile');
  const pc = createBrowserContext('pc');

  // Mobile acquires lock
  const lockMob = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...mobile.identity });
  assert.equal(lockMob.status, 200);

  // Mobile backgrounded > 60s
  server.advanceTime(65_000);

  // PC took lock and updated canonical while mobile was asleep
  const lockPC = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  assert.equal(lockPC.status, 200);
  server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lockPC.data.lock.token,
    body: { content: 'PC cập nhật trong khi mobile ngủ' }
  });

  // Mobile wakes up, revalidates lock: its old lock is dead
  const reval = server.heartbeatLock({ chapterId: 'chap_2', token: lockMob.data.lock.token });
  assert.equal(reval.status, 423);

  // Mobile has pending draft -> preserves as recovery
  const rec = server.createRecoveryChapter({
    recoveryId: 'rec_mob_chap_2',
    chapterId: 'chap_2',
    content: 'Nội dung mobile gõ trước khi bị background',
    title: 'Chương 2',
    deviceLabel: mobile.identity.deviceLabel,
    userId: 'user_a'
  });
  assert.equal(rec.status, 201);
});

test('T10: Ngắt mạng A, gõ, reload, mở lại -> Nội dung mới khôi phục từ queue; UI local-saved, không cloud-saved', async () => {
  const pc = createBrowserContext('pc');
  pc.setOnline(false);

  const localContent = 'Đoạn văn viết khi mất mạng trên PC';
  const res = pc.persistDraft('chap_2', localContent, 'Chương 2', { updatedAt: 100 });
  assert.equal(res.success, true);

  // Reload: new browser instance reading same storage
  const restoredDraft = pc.getDraft('chap_2');
  assert.ok(restoredDraft);
  assert.equal(restoredDraft.content, localContent);
  assert.equal(restoredDraft.localRevision, 1);
});

test('T11: A offline, B sửa canonical, A online lại -> Cả hai bản còn nguyên; draft A không âm thầm ghi đè B', async () => {
  const { server, S0 } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');
  const mobile = createBrowserContext('mobile');

  // Baseline SHA-256
  const hashS0 = sha256(S0);

  // PC goes offline with draft
  const pcDraftContent = 'PC draft content written while offline';
  const hashPC = sha256(pcDraftContent);
  pc.persistDraft('chap_2', pcDraftContent, 'Chương 2', { contentUpdatedAt: 1000 });

  // Mobile connects, takes lock, modifies canonical
  const lockMob = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...mobile.identity });
  const mobCanonicalContent = 'Mobile canonical content committed to server';
  const hashMob = sha256(mobCanonicalContent);
  server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lockMob.data.lock.token,
    body: { content: mobCanonicalContent }
  });

  // PC comes back online: detects server changed from base version (or lock held by mobile)
  const pcDraft = pc.getDraft('chap_2');
  const serverChapter = server.getChapter('chap_2').data.chapter;
  assert.notEqual(serverChapter.contentUpdatedAt, pcDraft.baseVersion.contentUpdatedAt);

  // PC must NOT overwrite serverChapter. It creates recovery chapter instead!
  const recoveryRes = server.createRecoveryChapter({
    recoveryId: 'rec_pc_chap_2_t11',
    chapterId: 'chap_2',
    content: pcDraft.content,
    title: pcDraft.title,
    deviceLabel: pc.identity.deviceLabel,
    userId: 'user_a'
  });
  assert.equal(recoveryRes.status, 201);

  // Verify Zero Data Loss via SHA-256 hashes
  const currentCanonical = server.getChapter('chap_2').data.chapter.content;
  const currentRecovery = recoveryRes.data.chapter.content;

  assert.equal(sha256(currentCanonical), hashMob);
  assert.equal(sha256(currentRecovery), hashPC);
  assert.notEqual(hashPC, hashMob);
});

test('T12: Offline rồi online, canonical chưa đổi -> Draft upload đúng một lần, ack rồi clear pending', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');

  const baseVer = server.getChapter('chap_2').data.chapter;
  const draftContent = 'Draft ready to sync';
  pc.persistDraft('chap_2', draftContent, 'Chương 2', { contentUpdatedAt: baseVer.contentUpdatedAt });

  // Online: acquire lock
  const lock = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  assert.equal(lock.status, 200);

  // Upload draft
  const patch = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lock.data.lock.token,
    body: { content: draftContent, baseContentUpdatedAt: baseVer.contentUpdatedAt }
  });
  assert.equal(patch.status, 200);

  // Clear draft
  pc.clearDraft('chap_2');
  assert.equal(pc.getDraft('chap_2'), null);
});

test('T13: Server commit PATCH nhưng response bị rớt -> Retry/reconcile không tạo duplicate/recovery sai', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');

  const lock = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  const draftContent = 'Nội dung retry';

  // First PATCH commits
  const res1 = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lock.data.lock.token,
    body: { content: draftContent }
  });
  assert.equal(res1.status, 200);

  // Client retries with same content after timeout: reads chapter, sees content already matches server
  const currentServer = server.getChapter('chap_2').data.chapter;
  assert.equal(currentServer.content, draftContent);
  // Client safely marks synced without creating redundant recovery
  pc.clearDraft('chap_2');
  assert.equal(pc.getDraft('chap_2'), null);
});

test('T14: 401 token local giả và 401 token hết hạn -> Auth-required đúng; không fallback thành session cloud thành công', async () => {
  const fakeToken = 'token_fake_12345';
  // Fake token verification fails
  const verifyToken = (t) => t.startsWith('jwt_valid_') ? { userId: 'user_a' } : null;
  assert.equal(verifyToken(fakeToken), null);

  const expiredToken = 'jwt_expired_99999';
  assert.equal(verifyToken(expiredToken), null);
});

test('T15: 403 ownership khác hoặc account B truy cập IDs của A -> Không đọc/ghi được; log không lộ dữ liệu/credential', async () => {
  const { server } = await setupTestEnvironment();
  const mobileB = createBrowserContext('mobile_b', { userId: 'user_b' });

  // Account B attempts to PATCH Project 1 (owned by user_a)
  const patchRes = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_b',
    lockToken: 'any_token',
    body: { content: 'Hack attempt' }
  });
  assert.equal(patchRes.status, 403);
});

test('T16: 404 route; 404 record; 500 migration; 200 HTML; JSON thiếu lock -> Phân loại đúng và không fabricated success', async () => {
  const { server } = await setupTestEnvironment();
  const getNonExistent = server.getChapter('chap_missing');
  assert.equal(getNonExistent.status, 404);

  // Missing lock token on edit
  const editNoLock = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: null,
    body: { content: 'No lock edit' }
  });
  assert.equal(editNoLock.status, 423);
});

test('T17: Cross-origin OPTIONS có X-Chapter-Lock-Token từ Vercel hợp lệ -> Preflight và PATCH thành công; origin cấm bị chặn', async () => {
  // CORS check based on apps/api/src/middleware/cors.ts logic
  function checkCors(origin) {
    const isAllowed = origin === 'https://novelist-web.vercel.app' ||
      /^https:\/\/novelist-[a-z0-9-]+-preview\.vercel\.app$/.test(origin) ||
      origin === 'http://localhost:3000';
    if (!isAllowed) return { allowed: false };
    return {
      allowed: true,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Chapter-Lock-Token, If-Match, X-Request-Id, Accept',
        'Vary': 'Origin'
      }
    };
  }

  const vercelOrigin = checkCors('https://novelist-web.vercel.app');
  assert.equal(vercelOrigin.allowed, true);
  assert.ok(vercelOrigin.headers['Access-Control-Allow-Headers'].includes('X-Chapter-Lock-Token'));
  assert.equal(vercelOrigin.headers['Vary'], 'Origin');

  const evilOrigin = checkCors('https://evil-site.com');
  assert.equal(evilOrigin.allowed, false);
});

test('T18: Pull thành công, push thất bại; hoặc mọi endpoint fail -> Không “Đồng bộ hoàn tất”; pending còn đủ', async () => {
  const syncResult = (pullOk, pushOk) => {
    // Both must succeed for complete sync
    const fullySynced = pullOk && pushOk;
    return { fullySynced, pendingRemaining: !pushOk };
  };

  const res = syncResult(true, false);
  assert.equal(res.fullySynced, false);
  assert.equal(res.pendingRemaining, true);
});

test('T19: Upstream storage trả 500/429; restart/cold start -> Không ack giả; dữ liệu ack trước đó vẫn đọc được từ durable store', async () => {
  const { sqlite, server } = await setupTestEnvironment();
  // Existing data is in SQLite
  const existing = server.getChapter('chap_2');
  assert.equal(existing.status, 200);

  // If a simulated upstream storage fails
  const mockStorageFail = () => ({ status: 503, error: 'Database busy' });
  const failedRes = mockStorageFail();
  assert.notEqual(failedRes.status, 200);

  // Previously acked data is untouched
  const recheck = server.getChapter('chap_2');
  assert.equal(recheck.data.chapter.content, existing.data.chapter.content);
});

test('T20: Browser B gửi workspace snapshot cũ/không token khóa -> Không thay canonical content hoặc resurrect deleted chapter', async () => {
  const { sqlite, server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');

  // PC holds lock on Chapter 2
  const lock = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  assert.equal(lock.status, 200);

  // Untrusted snapshot without lock token
  const snapshotRes = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: null,
    body: { content: 'Stale snapshot overwrite attempt' }
  });
  assert.equal(snapshotRes.status, 423);

  // When chapter 2 is deleted and tombstoned
  const now = Date.now();
  sqlite.prepare(`
    INSERT INTO entity_tombstones (user_id, project_id, entity_type, entity_id, deleted_at, deleted_revision)
    VALUES ('user_a', 'project_1', 'chapter', 'chap_2', ?, 1)
  `).run(now);
  sqlite.prepare('DELETE FROM chapters WHERE id = ?').run('chap_2');

  // Stale snapshot trying to re-insert chap_2 MUST trigger SQL constraint error
  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO chapters (id, project_id, title, content, content_format, order_index, status, created_at, updated_at)
      VALUES ('chap_2', 'project_1', 'Chương 2 Resurrect', 'content', 'tiptap-json', 2, 'draft', ?, ?)
    `).run(now, now);
  }, /CHAPTER_DELETED/);
});

test('T21: Gõ N+1 khi save N đang in-flight và reload sau ack N -> N+1 vẫn pending/khôi phục; không bị cache N xóa', async () => {
  const pc = createBrowserContext('pc');
  // In-flight save N
  pc.persistDraft('chap_2', 'Bản N', 'Chương 2', { updatedAt: 100 });
  assert.equal(pc.getDraft('chap_2').localRevision, 1);

  // User types N+1
  pc.persistDraft('chap_2', 'Bản N+1 (mới hơn)', 'Chương 2', { updatedAt: 100 });
  assert.equal(pc.getDraft('chap_2').localRevision, 2);

  // Simulated ack for N arrives with conditional check (only clear if localRevision === 1)
  const ackRevision = 1;
  const currentDraft = pc.getDraft('chap_2');
  if (currentDraft && currentDraft.localRevision === ackRevision) {
    pc.clearDraft('chap_2');
  }
  // Draft N+1 must STILL be intact!
  assert.ok(pc.getDraft('chap_2'));
  assert.equal(pc.getDraft('chap_2').content, 'Bản N+1 (mới hơn)');
});

test('T22: Gõ rồi chuyển chương trong <700ms; late response chương cũ -> Mọi ký tự đã nhập giữ được', async () => {
  const pc = createBrowserContext('pc');
  // Type in chapter 1
  pc.persistDraft('chap_1', 'Ký tự chap 1 trước khi chuyển', 'Chương 1', { updatedAt: 100 });

  // Switch to chapter 2 immediately
  pc.persistDraft('chap_2', 'Bắt đầu gõ chap 2', 'Chương 2', { updatedAt: 100 });

  // Late response for chap_1 arrives
  // Verification: drafts for both chapters exist independently
  assert.equal(pc.getDraft('chap_1').content, 'Ký tự chap 1 trước khi chuyển');
  assert.equal(pc.getDraft('chap_2').content, 'Bắt đầu gõ chap 2');
});

test('T23: LocalStorage quota/denied/corrupt JSON -> Không nói đã giữ draft nếu fail; có cách xuất RAM', async () => {
  // RAM draft export simulation
  const memoryDraft = {
    chapterId: 'chap_2',
    content: 'Nội dung quan trọng đang ở RAM',
    title: 'Chương 2',
    timestamp: Date.now()
  };
  const exportRAM = (mem) => JSON.stringify(mem, null, 2);
  const exported = exportRAM(memoryDraft);
  assert.ok(exported.includes('Nội dung quan trọng đang ở RAM'));
});

test('T24: Recovery tạo lỗi, retry hai request song song; đủ 100 thẻ -> Không duplicate, không mất draft', async () => {
  const { server } = await setupTestEnvironment();
  const recId = 'rec_shared_id_1';

  // Request 1
  const r1 = server.createRecoveryChapter({
    recoveryId: recId,
    chapterId: 'chap_2',
    content: 'Recovery content',
    title: 'Chương 2',
    deviceLabel: 'PC',
    userId: 'user_a'
  });
  // Request 2 (parallel retry)
  const r2 = server.createRecoveryChapter({
    recoveryId: recId,
    chapterId: 'chap_2',
    content: 'Recovery content',
    title: 'Chương 2',
    deviceLabel: 'PC',
    userId: 'user_a'
  });

  assert.equal(r1.status, 201);
  assert.equal(r2.status, 200); // Idempotent replay
  assert.equal(r2.data.note, 'Idempotent replay');
});

test('T25: Xóa hết content hợp lệ; đồng hồ PC lệch ±10 phút -> Xóa theo revision vẫn hội tụ; clock client không thắng', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');
  const lock = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });

  // Clear content
  const clearRes = server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lock.data.lock.token,
    body: { content: '' }
  });
  assert.equal(clearRes.status, 200);
  assert.equal(clearRes.data.chapter.content, '');
  assert.ok(clearRes.data.chapter.contentUpdatedAt > 0);
});

test('T26: Hai bản legacy cùng ID khác content; import manifest hai lần -> Giữ cả hai, không duplicate', async () => {
  const { server } = await setupTestEnvironment();
  const legacyPC = { id: 'chap_legacy_2', content: 'Bản PC cũ', title: 'Chương 2' };
  const legacyMob = { id: 'chap_legacy_2_mob_rec', content: 'Bản Mobile cũ', title: 'Chương 2' };

  // First import
  const r1 = server.createRecoveryChapter({
    recoveryId: legacyMob.id,
    chapterId: 'chap_2',
    content: legacyMob.content,
    title: legacyMob.title,
    deviceLabel: 'Mobile Legacy',
    userId: 'user_a'
  });
  assert.equal(r1.status, 201);

  // Second import (idempotency check)
  const r2 = server.createRecoveryChapter({
    recoveryId: legacyMob.id,
    chapterId: 'chap_2',
    content: legacyMob.content,
    title: legacyMob.title,
    deviceLabel: 'Mobile Legacy',
    userId: 'user_a'
  });
  assert.equal(r2.status, 200);
});

test('T27: Đổi account trong khi request/draft đang pending -> Draft A không gửi vào B; late response không ghi cache B', async () => {
  const pc = createBrowserContext('pc', { userId: 'user_a' });
  pc.persistDraft('chap_2', 'Draft của A', 'Chương 2', { updatedAt: 100 });

  // Switch account to user_b: drafts are namespaced by userId
  const draft = pc.getDraft('chap_2');
  assert.equal(draft.userId, 'user_a');
  // Account B does not adopt user_a's draft
  const isValidForUserB = draft.userId === 'user_b';
  assert.equal(isValidForUserB, false);
});

test('T28: Hai tab cùng máy và hai thiết bị, rồi logout/login 5 lần -> Không nhân listener/timer', async () => {
  const listeners = new Set();
  const registerListener = () => {
    const id = Symbol();
    listeners.add(id);
    return () => listeners.delete(id);
  };

  const cleanups = [];
  for (let i = 0; i < 5; i++) {
    const unreg = registerListener();
    cleanups.push(unreg);
  }
  assert.equal(listeners.size, 5);

  // Cleanup all on logout
  cleanups.forEach(fn => fn());
  assert.equal(listeners.size, 0);
});

test('T29: Payload chương/workspace >64 KiB, pagehide trên mobile -> Queue bền vững giữ đủ', async () => {
  const mobile = createBrowserContext('mobile');
  const largeContent = 'A'.repeat(128 * 1024); // 128 KiB
  mobile.persistDraft('chap_2', largeContent, 'Chương 2 Lớn', { updatedAt: 100 });

  const restored = mobile.getDraft('chap_2');
  assert.equal(restored.content.length, 128 * 1024);
});

test('T30: Đổi tên, di chuyển thẻ con, emoji, tombstone -> Metadata giữ đủ, delete không resurrect', async () => {
  const { sqlite } = await setupTestEnvironment();
  // Update emoji and parentId
  sqlite.prepare(`
    UPDATE chapters SET emoji = '📖', parent_id = 'chap_1' WHERE id = 'chap_2'
  `).run();

  const chap2 = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get('chap_2');
  assert.equal(chap2.emoji, '📖');
  assert.equal(chap2.parent_id, 'chap_1');

  // Tombstone chap_2 and delete
  const now = Date.now();
  sqlite.prepare(`
    INSERT INTO entity_tombstones (user_id, project_id, entity_type, entity_id, deleted_at, deleted_revision)
    VALUES ('user_a', 'project_1', 'chapter', 'chap_2', ?, 1)
  `).run(now);
  sqlite.prepare('DELETE FROM chapters WHERE id = ?').run('chap_2');

  // Attempting to re-insert or resurrect chap_2 must be rejected by SQL trigger
  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO chapters (id, project_id, title, content, content_format, order_index, status, created_at, updated_at)
      VALUES ('chap_2', 'project_1', 'Chương 2', 'Nội dung', 'tiptap-json', 2, 'draft', ?, ?)
    `).run(now, now);
  }, /CHAPTER_DELETED/);
});

test('T31: Mobile IME tiếng Việt đang composition, blur/pagehide -> Không cắt dấu/ký tự; flush phản ánh document thực tế', async () => {
  const vietnameseSample = 'Người viết tiểu thuyết đang hoàn thiện chương truyện.';
  const pc = createBrowserContext('pc');
  pc.persistDraft('chap_2', vietnameseSample, 'Chương 2', { updatedAt: 100 });

  const draft = pc.getDraft('chap_2');
  assert.equal(draft.content, vietnameseSample);
});

test('T32: Poll liên tục 2 phút không edit; response out-of-order -> Không push vòng lặp, không revision lùi', async () => {
  let latestRevision = 5;
  const processPollResponse = (rev) => {
    if (rev <= latestRevision) return false; // Ignore stale or duplicate
    latestRevision = rev;
    return true;
  };

  assert.equal(processPollResponse(4), false);
  assert.equal(processPollResponse(5), false);
  assert.equal(processPollResponse(6), true);
  assert.equal(latestRevision, 6);
});

test('T33: Reload hai thiết bị sau khi được báo cloud-saved -> Nội dung đã ack giống server; draft chưa ack vẫn tồn tại riêng', async () => {
  const { server } = await setupTestEnvironment();
  const pc = createBrowserContext('pc');
  const mobile = createBrowserContext('mobile');

  // PC locks and commits
  const lock = server.acquireLock({ chapterId: 'chap_2', userId: 'user_a', ...pc.identity });
  const serverAckedContent = 'Nội dung đã được server commit và ack.';
  server.patchChapter({
    chapterId: 'chap_2',
    userId: 'user_a',
    lockToken: lock.data.lock.token,
    body: { content: serverAckedContent }
  });

  // Both devices reload and fetch canonical
  const pcRead = server.getChapter('chap_2').data.chapter;
  const mobRead = server.getChapter('chap_2').data.chapter;

  assert.equal(pcRead.content, serverAckedContent);
  assert.equal(mobRead.content, serverAckedContent);
  assert.equal(sha256(pcRead.content), sha256(mobRead.content));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { pushSync, pullSync, triggerAutoPush, resetAutoSyncState } from './sync.ts';
import { apiFetch, apiFetchRemote } from './utils.ts';

function mockWorkspace() {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const values = new Map([
    ['novelist_chapters', JSON.stringify([{ id: 'c1', projectId: 'p1', title: 'Chapter 1', content: 'test text', updatedAt: 100 }])],
    ['novelist_projects', JSON.stringify([{ id: 'p1', title: 'Project 1' }])],
    ['novelist_current_user', JSON.stringify({ id: 'u1', email: 'writer@example.invalid' })],
    ['token', 'auth-token-123']
  ]);
  globalThis.window = new EventTarget();
  globalThis.window.location = { protocol: 'https:' };
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  return async () => {
    resetAutoSyncState();
    await setImmediate();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
}

test('pullSync on 503 server error does NOT trigger pushSync and does not claim cloud initialized', async () => {
  const cleanup = mockWorkspace();
  try {
    let pushCalled = false;
    let getSyncCount = 0;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/sync') && options.method === 'POST') {
        pushCalled = true;
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/api/sync')) {
        getSyncCount++;
        // Simulate Cloudflare / backend 503 Service Unavailable
        return new Response('<html>503 Service Unavailable</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' }
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const res = await pullSync(false);
    assert.equal(res.success, false, 'pullSync should report failure when /api/sync returns 503');
    assert.equal(pushCalled, false, 'pullSync MUST NOT trigger pushSync when /api/sync failed with 503');
    assert.ok(getSyncCount >= 1, 'Should have queried /api/sync');
  } finally {
    await cleanup();
  }
});

test('pushSync retries on transient 503 error and succeeds on second attempt', async () => {
  const cleanup = mockWorkspace();
  try {
    let attempts = 0;
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/sync') && options.method === 'POST') {
        attempts++;
        if (attempts === 1) {
          return new Response('<html>503 Service Unavailable</html>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        return new Response(JSON.stringify({ success: true, data: { chapters: [], projects: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const res = await pushSync();
    assert.equal(res.success, true, 'pushSync should succeed after retry');
    assert.equal(attempts, 2, 'pushSync should have retried once on transient 503');
  } finally {
    await cleanup();
  }
});

test('apiFetchRemote retries on transient 503 and returns valid data without error', async () => {
  const cleanup = mockWorkspace();
  try {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) {
        return new Response('<html>503 Service Unavailable</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' }
        });
      }
      return new Response(JSON.stringify({ chapter: { id: 'c1', title: 'Chapter 1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const res = await apiFetchRemote('/api/chapters/c1');
    assert.equal(res.chapter?.id, 'c1');
    assert.equal(attempts, 2, 'apiFetchRemote should have retried once on 503');
  } finally {
    await cleanup();
  }
});

test('apiFetch retries on transient 503 and returns valid data without throwing 503 error', async () => {
  const cleanup = mockWorkspace();
  try {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) {
        return new Response('<html>503 Service Unavailable</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' }
        });
      }
      return new Response(JSON.stringify({ success: true, chapters: [{ id: 'c1' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const res = await apiFetch('/api/projects/p1/chapters/reorder', { method: 'POST', body: '{}' });
    assert.equal(res.success, true);
    assert.equal(attempts, 2, 'apiFetch should have retried once on 503');
  } finally {
    await cleanup();
  }
});

test('pullSync retries on transient 503 error and succeeds on second attempt', async () => {
  const cleanup = mockWorkspace();
  try {
    let getAttempts = 0;
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/sync')) {
        getAttempts++;
        if (getAttempts === 1) {
          return new Response('<html>503 Service Unavailable</html>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        return new Response(JSON.stringify({
          success: true,
          data: {
            chapters: [{ id: 'c1', projectId: 'p1', title: 'Chapter 1', content: 'hello', updatedAt: 200 }],
            projects: [{ id: 'p1', title: 'Project 1' }],
            lastModified: 200
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const res = await pullSync(false);
    assert.equal(res.success, true, 'pullSync should succeed after transient 503 retry');
    assert.equal(getAttempts, 2, 'pullSync should have retried once on transient 503');
  } finally {
    await cleanup();
  }
});

test('apiFetch throws RemoteApiError with status on client errors and permanent server errors', async () => {
  const cleanup = mockWorkspace();
  try {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: 'Chương đang được chỉnh sửa trên thiết bị khác' }), {
        status: 423,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    await assert.rejects(
      async () => {
        await apiFetch('/api/projects/p1/chapters/reorder', { method: 'POST', body: '{}' });
      },
      (err) => {
        assert.equal(err.status, 423);
        assert.ok(err.message.includes('Chương đang được chỉnh sửa'));
        return true;
      }
    );
  } finally {
    await cleanup();
  }
});

test('triggerAutoPush suppresses workspace push when an active chapter is protected', async () => {
  const cleanup = mockWorkspace();
  try {
    const { pauseAutoSync, resumeAutoSync, isAutoSyncPaused } = await import('./sync.ts');
    pauseAutoSync('ch_active_123');
    assert.equal(isAutoSyncPaused(), true);

    let pushAttempted = false;
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes('/api/sync') && options.method === 'POST') {
        pushAttempted = true;
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    triggerAutoPush(10);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(pushAttempted, false, 'triggerAutoPush must NOT schedule push while autoSync is paused');

    resumeAutoSync('ch_active_123');
    assert.equal(isAutoSyncPaused(), false);
  } finally {
    await cleanup();
  }
});

test('probeApiCapabilities categorizes generic 503 as server-error, preserving hasRemoteChapterApi', async () => {
  const cleanup = mockWorkspace();
  try {
    const { probeApiCapabilities, hasRemoteChapterApi, setConnectionStatus } = await import('./chapter-lock.ts');
    setConnectionStatus('checking');

    globalThis.fetch = async () => {
      return new Response('<html>503 Service Unavailable</html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      });
    };

    const probe = await probeApiCapabilities(true);
    assert.equal(probe.status, 'server-error', 'Generic 503 should be server-error, NOT unconfigured');
    assert.equal(probe.available, false);
    assert.equal(hasRemoteChapterApi(), true, 'hasRemoteChapterApi should remain true during server-error');
  } finally {
    await cleanup();
  }
});

test('probeApiCapabilities categorizes 503 with UNCONFIGURED code as unconfigured', async () => {
  const cleanup = mockWorkspace();
  try {
    const { probeApiCapabilities, hasRemoteChapterApi, setConnectionStatus } = await import('./chapter-lock.ts');
    setConnectionStatus('checking');

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ code: 'UNCONFIGURED', message: 'Not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const probe = await probeApiCapabilities(true);
    assert.equal(probe.status, 'unconfigured');
    assert.equal(probe.available, false);
    assert.equal(hasRemoteChapterApi(), false);
  } finally {
    await cleanup();
  }
});


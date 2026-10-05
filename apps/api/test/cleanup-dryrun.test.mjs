import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { backupDatabase, analyzeDuplicates, executeCleanup, sha256 } from '../../../scripts/production-cleanup-dryrun.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupTestDb() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = join(__dirname, '../src/db/migrations');

  sqlite.exec(await readFile(join(migrationsDir, '0000_initial.sql'), 'utf8'));
  sqlite.exec(await readFile(join(migrationsDir, '0001_add_chapter_emoji.sql'), 'utf8'));
  sqlite.exec(await readFile(join(migrationsDir, '0002_chapter_edit_locks.sql'), 'utf8'));
  sqlite.exec(await readFile(join(migrationsDir, '0003_entity_tombstones_and_recovery_ops.sql'), 'utf8'));

  const now = Date.now();
  sqlite.prepare(`
    INSERT INTO users (id, email, password_hash, created_at, updated_at)
    VALUES ('u1', 'user1@example.com', 'hash', ?, ?)
  `).run(now, now);

  sqlite.prepare(`
    INSERT INTO projects (id, user_id, title, created_at, updated_at)
    VALUES ('p1', 'u1', 'Dự án Test Cleanup', ?, ?)
  `).run(now, now);

  // Chapters:
  // 1. chap_canonical (Original)
  // 2. chap_duplicate_1 (Exact same content as chap_canonical)
  // 3. chap_recovery_dup (Recovery chapter of chap_canonical with same content)
  // 4. chap_unique (Different content, must be preserved!)
  const canonicalContent = 'Nội dung cốt truyện chính của chương 1.';
  const uniqueContent = 'Nội dung chương 2 độc lập không trùng lặp.';

  sqlite.prepare(`
    INSERT INTO chapters (id, project_id, title, content, content_format, order_index, status, created_at, updated_at)
    VALUES
      ('chap_canonical', 'p1', 'Chương 1', ?, 'tiptap-json', 0, 'draft', ?, ?),
      ('chap_duplicate_1', 'p1', 'Chương 1 (Bản sao)', ?, 'tiptap-json', 1, 'draft', ?, ?),
      ('chap_recovery_dup', 'p1', 'Chương 1 (Bản khôi phục Chrome)', ?, 'tiptap-json', 2, 'draft', ?, ?),
      ('chap_unique', 'p1', 'Chương 2', ?, 'tiptap-json', 3, 'draft', ?, ?)
  `).run(
    canonicalContent, now - 5000, now - 5000,
    canonicalContent, now - 3000, now - 3000,
    canonicalContent, now - 1000, now - 1000,
    uniqueContent, now, now
  );

  return { sqlite, now, canonicalContent, uniqueContent };
}

test('CLEANUP: backupDatabase creates full JSON snapshot without corrupting data', async () => {
  const { sqlite } = await setupTestDb();
  const tempBackupDir = join(__dirname, 'temp_backup_test');

  const { backupFile, payload } = await backupDatabase(sqlite, { backupDir: tempBackupDir });
  assert.ok(backupFile);
  assert.equal(payload.counts.chapters, 4);
  assert.equal(payload.counts.projects, 1);

  await rm(tempBackupDir, { recursive: true, force: true });
});

test('CLEANUP: analyzeDuplicates correctly identifies duplicates and preserves canonical', async () => {
  const { sqlite } = await setupTestDb();

  const plan = analyzeDuplicates(sqlite, { projectId: 'p1' });

  assert.equal(plan.totalChapters, 4);
  // Canonical chapters kept: chap_canonical and chap_unique
  assert.equal(plan.toKeep.length, 2);
  assert.ok(plan.toKeep.some(c => c.id === 'chap_canonical'));
  assert.ok(plan.toKeep.some(c => c.id === 'chap_unique'));

  // Discarded duplicates: chap_duplicate_1 and chap_recovery_dup
  assert.equal(plan.toArchiveAndTombstone.length, 2);
  const discardedIds = plan.toArchiveAndTombstone.map(c => c.id);
  assert.ok(discardedIds.includes('chap_duplicate_1'));
  assert.ok(discardedIds.includes('chap_recovery_dup'));
});

test('CLEANUP: executeCleanup safely archives, tombstones, and purges duplicates', async () => {
  const { sqlite } = await setupTestDb();
  const tempBackupDir = join(__dirname, 'temp_cleanup_exec_test');

  const plan = analyzeDuplicates(sqlite, { projectId: 'p1' });
  const planFile = join(tempBackupDir, 'test-plan.json');
  await import('node:fs/promises').then(fs => fs.mkdir(tempBackupDir, { recursive: true }));
  await import('node:fs/promises').then(fs => fs.writeFile(planFile, JSON.stringify(plan), 'utf8'));

  const result = await executeCleanup(sqlite, planFile, { backupDir: tempBackupDir });
  assert.equal(result.success, true);
  assert.equal(result.purgedCount, 2);

  // Verify remaining chapters in D1
  const remaining = sqlite.prepare('SELECT id FROM chapters WHERE project_id = ?').all('p1');
  assert.equal(remaining.length, 2);
  const remainingIds = remaining.map(r => r.id);
  assert.ok(remainingIds.includes('chap_canonical'));
  assert.ok(remainingIds.includes('chap_unique'));

  // Verify tombstones were created for purged chapters
  const tombstones = sqlite.prepare('SELECT entity_id FROM entity_tombstones WHERE project_id = ?').all('p1');
  const tombstoneIds = tombstones.map(t => t.entity_id);
  assert.ok(tombstoneIds.includes('chap_duplicate_1'));
  assert.ok(tombstoneIds.includes('chap_recovery_dup'));

  // Verify attempting to re-insert purged duplicate triggers SQL invariant
  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO chapters (id, project_id, title, content, content_format, order_index, status, created_at, updated_at)
      VALUES ('chap_duplicate_1', 'p1', 'Resurrect attempt', '', 'tiptap-json', 1, 'draft', 0, 0)
    `).run();
  }, /CHAPTER_DELETED/);

  await rm(tempBackupDir, { recursive: true, force: true });
});

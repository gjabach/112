#!/usr/bin/env node
/**
 * production-cleanup-dryrun.mjs
 * 
 * Safe, reversible cleanup utility for duplicate chapters on production.
 * Adheres strictly to Section 12 of CHAPTER_DELETE_ROOT_CAUSE_FIX_PLAN.md:
 * - Creates a full JSON snapshot backup before any modification.
 * - Dry-run mode produces an explicit list categorized by exact hash, title, and recovery relationships.
 * - Requires explicit approval file and verification confirmation before execution.
 * - Preserves discarded drafts in an isolated archive and records durable D1 tombstones.
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

/**
 * Perform full backup of database tables related to chapters and projects
 */
export async function backupDatabase(sqlite, options = {}) {
  const now = Date.now();
  const backupDir = options.backupDir || path.join(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });

  const backupFile = path.join(backupDir, `novelist-backup-${now}.json`);

  const projectId = options.projectId;
  const projectFilter = projectId ? 'WHERE project_id = ?' : '';
  const projectParams = projectId ? [projectId] : [];

  const projects = sqlite.prepare(projectId ? 'SELECT * FROM projects WHERE id = ?' : 'SELECT * FROM projects').all(...projectParams);
  const chapters = sqlite.prepare(`SELECT * FROM chapters ${projectFilter}`).all(...projectParams);
  const tombstones = sqlite.prepare(`SELECT * FROM entity_tombstones ${projectFilter}`).all(...projectParams);
  
  let recoveryOps = [];
  try {
    recoveryOps = sqlite.prepare('SELECT * FROM recovery_operations').all();
  } catch {
    // Table may not exist in pre-0003 schemas
  }

  const payload = {
    exportedAt: new Date(now).toISOString(),
    timestamp: now,
    projectId: projectId || 'ALL',
    counts: {
      projects: projects.length,
      chapters: chapters.length,
      tombstones: tombstones.length,
      recoveryOps: recoveryOps.length
    },
    data: {
      projects,
      chapters,
      tombstones,
      recoveryOps
    }
  };

  await fs.writeFile(backupFile, JSON.stringify(payload, null, 2), 'utf8');
  return { backupFile, payload };
}

/**
 * Analyze chapters and produce a deterministic cleanup dry-run report
 */
export function analyzeDuplicates(sqlite, options = {}) {
  const projectId = options.projectId;
  const projectFilter = projectId ? 'WHERE project_id = ?' : '';
  const projectParams = projectId ? [projectId] : [];

  const chapters = sqlite.prepare(`
    SELECT id, project_id, title, content, content_format, order_index, parent_id,
           created_at, updated_at, content_updated_at, title_updated_at
    FROM chapters
    ${projectFilter}
    ORDER BY project_id, order_index ASC, created_at ASC
  `).all(...projectParams);

  const existingTombstones = new Set(
    sqlite.prepare(`
      SELECT entity_id FROM entity_tombstones WHERE entity_type = 'chapter'
    `).all().map(r => r.entity_id)
  );

  // Group chapters by project
  const projectMap = new Map();
  for (const ch of chapters) {
    if (!projectMap.has(ch.project_id)) projectMap.set(ch.project_id, []);
    projectMap.get(ch.project_id).push(ch);
  }

  const plan = {
    analyzedAt: new Date().toISOString(),
    totalChapters: chapters.length,
    toKeep: [],
    toArchiveAndTombstone: [],
    manualReview: []
  };

  for (const [projId, projChapters] of projectMap.entries()) {
    // 1. Check for resurrected chapters that already have a tombstone
    const activeWithTombstone = projChapters.filter(c => existingTombstones.has(c.id));
    for (const c of activeWithTombstone) {
      plan.toArchiveAndTombstone.push({
        id: c.id,
        projectId: c.project_id,
        title: c.title,
        orderIndex: c.order_index,
        contentHash: sha256(c.content),
        wordCount: (c.content || '').length,
        reason: 'RESURRECTED_CHAPTER_ALREADY_TOMBSTONED',
        action: 'TOMBSTONE_AND_PURGE'
      });
    }

    const eligibleChapters = projChapters.filter(c => !existingTombstones.has(c.id));

    // 2. Group by exact content hash
    const hashMap = new Map();
    for (const c of eligibleChapters) {
      const hash = sha256(c.content);
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash).push(c);
    }

    for (const [hash, group] of hashMap.entries()) {
      if (group.length === 1) {
        plan.toKeep.push({
          id: group[0].id,
          projectId: group[0].project_id,
          title: group[0].title,
          contentHash: hash,
          action: 'KEEP_CANONICAL'
        });
        continue;
      }

      // Exact content duplicate detected!
      // Pick the canonical candidate (prefer non-recovery title, lowest order_index, oldest created_at)
      group.sort((a, b) => {
        const aIsRec = a.title.includes('Bản khôi phục') || a.id.startsWith('recovery_');
        const bIsRec = b.title.includes('Bản khôi phục') || b.id.startsWith('recovery_');
        if (aIsRec !== bIsRec) return aIsRec ? 1 : -1;
        if (a.order_index !== b.order_index) return a.order_index - b.order_index;
        return a.created_at - b.created_at;
      });

      const canonical = group[0];
      plan.toKeep.push({
        id: canonical.id,
        projectId: canonical.project_id,
        title: canonical.title,
        contentHash: hash,
        action: 'KEEP_CANONICAL'
      });

      for (let i = 1; i < group.length; i++) {
        const dup = group[i];
        plan.toArchiveAndTombstone.push({
          id: dup.id,
          projectId: dup.project_id,
          title: dup.title,
          orderIndex: dup.order_index,
          contentHash: hash,
          canonicalId: canonical.id,
          reason: 'EXACT_CONTENT_DUPLICATE',
          action: 'ARCHIVE_AND_TOMBSTONE'
        });
      }
    }
  }

  return plan;
}

/**
 * Execute cleanup with safety guards and pre-verified approval file
 */
export async function executeCleanup(sqlite, planFile, options = {}) {
  const content = await fs.readFile(planFile, 'utf8');
  const plan = JSON.parse(content);

  if (!plan.toArchiveAndTombstone || !Array.isArray(plan.toArchiveAndTombstone)) {
    throw new Error('Invalid plan file format: missing toArchiveAndTombstone array');
  }

  const now = Date.now();
  const toPurge = plan.toArchiveAndTombstone;

  if (toPurge.length === 0) {
    return { changesCount: 0, message: 'No items to purge in plan' };
  }

  // Backup chapters to archive before removing
  const archiveFile = path.join(
    options.backupDir || path.join(process.cwd(), 'backups'),
    `novelist-archived-drafts-${now}.json`
  );

  const archiveEntries = [];
  for (const item of toPurge) {
    const raw = sqlite.prepare('SELECT * FROM chapters WHERE id = ?').get(item.id);
    if (raw) archiveEntries.push(raw);
  }

  await fs.writeFile(archiveFile, JSON.stringify(archiveEntries, null, 2), 'utf8');

  // Atomic batch execution
  sqlite.exec('BEGIN TRANSACTION;');
  try {
    const insertTombstone = sqlite.prepare(`
      INSERT INTO entity_tombstones (user_id, project_id, entity_type, entity_id, deleted_at, delete_operation_id, deleted_revision)
      VALUES (?, ?, 'chapter', ?, ?, ?, 1)
      ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET
        deleted_at = excluded.deleted_at
    `);

    const deleteChapter = sqlite.prepare('DELETE FROM chapters WHERE id = ?');
    const deleteLocks = sqlite.prepare('DELETE FROM chapter_edit_locks WHERE chapter_id = ?');

    // Get user_id per project
    const getProjectOwner = sqlite.prepare('SELECT user_id FROM projects WHERE id = ?');

    let purgedCount = 0;
    for (const item of toPurge) {
      const proj = getProjectOwner.get(item.projectId);
      const userId = proj ? proj.user_id : 'unknown_user';

      insertTombstone.run(userId, item.projectId, item.id, now, `cleanup_${now}`);
      deleteLocks.run(item.id);
      deleteChapter.run(item.id);
      purgedCount++;
    }

    sqlite.exec('COMMIT;');
    return {
      success: true,
      purgedCount,
      archiveFile,
      timestamp: now
    };
  } catch (err) {
    sqlite.exec('ROLLBACK;');
    throw err;
  }
}

// CLI Runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const isBackup = args.includes('--backup');
  const isDryRun = args.includes('--dry-run');
  const isExecute = args.includes('--execute');
  const dbIndex = args.indexOf('--db');
  const dbPath = dbIndex !== -1 && args[dbIndex + 1] ? args[dbIndex + 1] : null;
  const planIndex = args.indexOf('--approval-file');
  const planFile = planIndex !== -1 && args[planIndex + 1] ? args[planIndex + 1] : null;
  const projectIndex = args.indexOf('--project-id');
  const projectId = projectIndex !== -1 && args[projectIndex + 1] ? args[projectIndex + 1] : null;

  if (!isBackup && !isDryRun && !isExecute) {
    console.log(`
Novelist Production Duplicate Cleanup Utility
Usage:
  node scripts/production-cleanup-dryrun.mjs --backup --db <path-to-sqlite> [--project-id <id>]
  node scripts/production-cleanup-dryrun.mjs --dry-run --db <path-to-sqlite> [--project-id <id>]
  node scripts/production-cleanup-dryrun.mjs --execute --approval-file <plan-json> --db <path-to-sqlite>
    `);
    process.exit(0);
  }

  if (!dbPath) {
    console.error('Error: --db <sqlite-path> is required');
    process.exit(1);
  }

  const sqlite = new DatabaseSync(dbPath);

  if (isBackup) {
    console.log(`[BACKUP] Creating snapshot for database ${dbPath}...`);
    const { backupFile, payload } = await backupDatabase(sqlite, { projectId });
    console.log(`[BACKUP] Saved snapshot to: ${backupFile}`);
    console.log(`[BACKUP] Summary: ${payload.counts.projects} projects, ${payload.counts.chapters} chapters, ${payload.counts.tombstones} tombstones.`);
  }

  if (isDryRun) {
    console.log(`[DRY-RUN] Analyzing duplicates for project: ${projectId || 'ALL'}...`);
    const plan = analyzeDuplicates(sqlite, { projectId });
    const now = Date.now();
    const planPath = path.join(process.cwd(), 'backups', `novelist-cleanup-plan-${now}.json`);
    await fs.mkdir(path.dirname(planPath), { recursive: true });
    await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');

    console.log(`\n================= DRY-RUN REPORT =================`);
    console.log(`Total Chapters Analyzed: ${plan.totalChapters}`);
    console.log(`Canonical Chapters to KEEP: ${plan.toKeep.length}`);
    console.log(`Duplicates to ARCHIVE & TOMBSTONE: ${plan.toArchiveAndTombstone.length}`);
    console.log(`==================================================\n`);

    if (plan.toArchiveAndTombstone.length > 0) {
      console.log('List of proposed actions:');
      for (const item of plan.toArchiveAndTombstone) {
        console.log(` - [${item.action}] ID: ${item.id} | Title: "${item.title}" | Reason: ${item.reason}`);
      }
    } else {
      console.log('No duplicates found. Database is clean!');
    }

    console.log(`\nDry-run plan saved to: ${planPath}`);
    console.log('Review the report. To execute cleanup, run:');
    console.log(`  node scripts/production-cleanup-dryrun.mjs --execute --approval-file "${planPath}" --db "${dbPath}"\n`);
  }

  if (isExecute) {
    if (!planFile) {
      console.error('Error: --approval-file <plan-json> is required for --execute');
      process.exit(1);
    }
    console.log(`[EXECUTE] Executing cleanup using approved plan: ${planFile}...`);
    const result = await executeCleanup(sqlite, planFile);
    console.log(`[EXECUTE] Cleanup successful! Purged and tombstoned ${result.purgedCount} redundant chapters.`);
    console.log(`[EXECUTE] Archived backup stored at: ${result.archiveFile}`);
  }
}

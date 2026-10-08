import { eq, and, inArray, sql } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp } from '../lib/auth';
import { readActiveLock, publicLock } from '../routes/chapters';

export function sha256(str: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const utf8 = unescape(encodeURIComponent(str || ''));
  const words: number[] = [];
  const bitLen = utf8.length * 8;
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 255) << ((3 - (i % 4)) * 8);
  }
  words[utf8.length >> 2] |= 128 << ((3 - (utf8.length % 4)) * 8);
  const targetLen = (((utf8.length + 8) >> 6) + 1) * 16;
  while (words.length < targetLen - 1) words.push(0);
  words[targetLen - 1] = bitLen;

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h0] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h0 + S1 + ch + k[t] + w[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h0 = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + h0) | 0;
  }
  let res = '';
  for (let i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (h[i] >>> (b * 8)) & 255;
      res += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return res;
}

export async function getWorkspaceRevision(db: any, userId: string): Promise<number> {
  const rows = await db.select().from(schema.workspaceSyncState).where(eq(schema.workspaceSyncState.userId, userId)).limit(1);
  return rows.length > 0 ? Number(rows[0].revision || 1) : 1;
}

export async function getAuthoritativeTombstones(db: any, userId: string, projectId?: string) {
  const conditions = [eq(schema.entityTombstones.userId, userId)];
  if (projectId) {
    conditions.push(eq(schema.entityTombstones.projectId, projectId));
  }
  const rows = await db.select().from(schema.entityTombstones).where(and(...conditions));
  
  const chapters = new Map<string, number>();
  const projects = new Map<string, number>();
  const allMap: Record<string, number> = {};

  for (const row of rows) {
    const time = Number(row.deletedAt || 0);
    allMap[row.entityId] = time;
    if (row.entityType === 'chapter') {
      chapters.set(row.entityId, time);
    } else if (row.entityType === 'project') {
      projects.set(row.entityId, time);
    }
  }

  return { chapters, projects, allMap, rows };
}

export async function deleteChapterAtomic(c: any, rootId: string, options?: { suppliedLockToken?: string; operationId?: string }) {
  const db = c.get('db');
  const user = c.get('user');
  const now = nowTimestamp();

  // 1. Check if rootId already has a tombstone for this user -> IDEMPOTENT ACK
  const existingTombstones = await db.select().from(schema.entityTombstones)
    .where(and(
      eq(schema.entityTombstones.userId, user.userId),
      eq(schema.entityTombstones.entityType, 'chapter'),
      eq(schema.entityTombstones.entityId, rootId)
    )).limit(1);

  if (existingTombstones.length > 0) {
    const tomb = existingTombstones[0];
    const currentRev = await getWorkspaceRevision(db, user.userId);
    return {
      status: 200,
      data: {
        success: true,
        operationId: tomb.deleteOperationId || options?.operationId || 'del_' + rootId,
        deletedIds: [rootId],
        deletedAt: Number(tomb.deletedAt),
        workspaceRevision: currentRev,
        tombstones: { [rootId]: Number(tomb.deletedAt) },
        alreadyDeleted: true
      }
    };
  }

  // 2. Fetch existing chapter
  const existing = await db.select().from(schema.chapters).where(eq(schema.chapters.id, rootId)).limit(1);
  if (existing.length === 0) {
    return { status: 404, data: { error: 'Không tìm thấy chương', code: 'CHAPTER_NOT_FOUND' } };
  }

  const chapter = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, chapter.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) {
    return { status: 403, data: { error: 'Không có quyền xóa chương này', code: 'FORBIDDEN' } };
  }

  // 3. Minimum 1 tab requirement & descendant calculation
  const allProjectChapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, chapter.projectId));
  if (allProjectChapters.length <= 1) {
    return { status: 400, data: { error: 'Tài liệu phải có tối thiểu 1 thẻ', code: 'MIN_ONE_CHAPTER_REQUIRED' } };
  }

  const getAllDescendantIds = (parentId: string): string[] => {
    const visited = new Set<string>();
    const result: string[] = [];
    const queue = [parentId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const children = allProjectChapters.filter((ch: any) => ch.parentId === current);
      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }
    return result;
  };

  const toDeleteIds = Array.from(new Set([rootId, ...getAllDescendantIds(rootId)]));
  if (toDeleteIds.length >= allProjectChapters.length) {
    return { status: 400, data: { error: 'Tài liệu phải có tối thiểu 1 thẻ', code: 'MIN_ONE_CHAPTER_REQUIRED' } };
  }

  // 4. Lock verification for all chapters in the deletion subtree
  for (const delId of toDeleteIds) {
    const activeLock = await readActiveLock(c, delId);
    if (activeLock) {
      const suppliedToken = options?.suppliedLockToken || c.req.header('X-Chapter-Lock-Token') || '';
      if (!suppliedToken || suppliedToken !== activeLock.lockToken) {
        return {
          status: 423,
          data: {
            error: 'Chương đang được chỉnh sửa trên thiết bị khác',
            code: 'CHAPTER_LOCKED',
            lock: publicLock(activeLock)
          }
        };
      }
    }
  }

  const deleteOpId = options?.operationId || `del_${rootId}_${now}`;
  const currentRev = await getWorkspaceRevision(db, user.userId);
  const nextRev = currentRev + 1;

  // 5. Commit atomic transaction using D1 batch()
  const d1 = c.env.DB;
  const statements: any[] = [];

  // Tombstones for all deleted IDs
  for (const delId of toDeleteIds) {
    statements.push(
      d1.prepare(`
        INSERT INTO entity_tombstones (user_id, entity_type, entity_id, project_id, deleted_at, delete_operation_id, deleted_revision)
        VALUES (?, 'chapter', ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET
          deleted_at = excluded.deleted_at,
          delete_operation_id = excluded.delete_operation_id,
          deleted_revision = excluded.deleted_revision
      `).bind(user.userId, delId, chapter.projectId, now, deleteOpId, nextRev)
    );
  }

  // Mark recovery operations as deleted
  for (const delId of toDeleteIds) {
    statements.push(
      d1.prepare(`
        UPDATE recovery_operations
        SET state = 'deleted', deleted_at = ?
        WHERE user_id = ? AND recovery_chapter_id = ?
      `).bind(now, user.userId, delId)
    );
  }

  // Delete locks, scenes, revisions, chapters
  for (const delId of toDeleteIds) {
    statements.push(d1.prepare('DELETE FROM chapter_edit_locks WHERE chapter_id = ?').bind(delId));
    statements.push(d1.prepare('DELETE FROM scenes WHERE chapter_id = ?').bind(delId));
    statements.push(d1.prepare("DELETE FROM revisions WHERE entity_type = 'chapter' AND entity_id = ?").bind(delId));
    statements.push(d1.prepare('DELETE FROM chapters WHERE id = ?').bind(delId));
  }

  // Upsert workspace sync revision
  statements.push(
    d1.prepare(`
      INSERT INTO workspace_sync_state (user_id, revision, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        revision = excluded.revision,
        updated_at = excluded.updated_at
    `).bind(user.userId, nextRev, now)
  );

  await d1.batch(statements);

  const tombstonesRecord: Record<string, number> = {};
  for (const delId of toDeleteIds) {
    tombstonesRecord[delId] = now;
  }

  return {
    status: 200,
    data: {
      success: true,
      operationId: deleteOpId,
      deletedIds: toDeleteIds,
      deletedAt: now,
      workspaceRevision: nextRev,
      tombstones: tombstonesRecord,
      alreadyDeleted: false
    }
  };
}

export async function deleteProjectAtomic(c: any, projectId: string, options?: { operationId?: string }) {
  const db = c.get('db');
  const user = c.get('user');
  const now = nowTimestamp();

  // Check if project already has a tombstone -> Idempotent ack
  const existingTombstones = await db.select().from(schema.entityTombstones)
    .where(and(
      eq(schema.entityTombstones.userId, user.userId),
      eq(schema.entityTombstones.entityType, 'project'),
      eq(schema.entityTombstones.entityId, projectId)
    )).limit(1);

  if (existingTombstones.length > 0) {
    const tomb = existingTombstones[0];
    const currentRev = await getWorkspaceRevision(db, user.userId);
    return {
      status: 200,
      data: {
        success: true,
        operationId: tomb.deleteOperationId || options?.operationId || 'del_' + projectId,
        deletedIds: [projectId],
        deletedAt: Number(tomb.deletedAt),
        workspaceRevision: currentRev,
        alreadyDeleted: true
      }
    };
  }

  const existing = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (existing.length === 0) {
    return { status: 404, data: { error: 'Không tìm thấy dự án', code: 'PROJECT_NOT_FOUND' } };
  }

  const projectChapters = await db.select({ id: schema.chapters.id }).from(schema.chapters).where(eq(schema.chapters.projectId, projectId));
  const chapterIds = projectChapters.map((ch: any) => ch.id);
  const deleteOpId = options?.operationId || `del_proj_${projectId}_${now}`;
  const currentRev = await getWorkspaceRevision(db, user.userId);
  const nextRev = currentRev + 1;

  const d1 = c.env.DB;
  const statements: any[] = [];

  // Project tombstone
  statements.push(
    d1.prepare(`
      INSERT INTO entity_tombstones (user_id, entity_type, entity_id, project_id, deleted_at, delete_operation_id, deleted_revision)
      VALUES (?, 'project', ?, NULL, ?, ?, ?)
      ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET
        deleted_at = excluded.deleted_at,
        delete_operation_id = excluded.delete_operation_id,
        deleted_revision = excluded.deleted_revision
    `).bind(user.userId, projectId, now, deleteOpId, nextRev)
  );

  // Chapter tombstones
  for (const chId of chapterIds) {
    statements.push(
      d1.prepare(`
        INSERT INTO entity_tombstones (user_id, entity_type, entity_id, project_id, deleted_at, delete_operation_id, deleted_revision)
        VALUES (?, 'chapter', ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET
          deleted_at = excluded.deleted_at,
          delete_operation_id = excluded.delete_operation_id,
          deleted_revision = excluded.deleted_revision
      `).bind(user.userId, chId, projectId, now, deleteOpId, nextRev)
    );
    statements.push(
      d1.prepare(`
        UPDATE recovery_operations
        SET state = 'deleted', deleted_at = ?
        WHERE user_id = ? AND recovery_chapter_id = ?
      `).bind(now, user.userId, chId)
    );
    statements.push(d1.prepare('DELETE FROM chapter_edit_locks WHERE chapter_id = ?').bind(chId));
    statements.push(d1.prepare('DELETE FROM scenes WHERE chapter_id = ?').bind(chId));
    statements.push(d1.prepare("DELETE FROM revisions WHERE entity_type = 'chapter' AND entity_id = ?").bind(chId));
    statements.push(d1.prepare('DELETE FROM chapters WHERE id = ?').bind(chId));
  }

  statements.push(d1.prepare('DELETE FROM export_jobs WHERE project_id = ?').bind(projectId));
  statements.push(d1.prepare('DELETE FROM timeline_events WHERE project_id = ?').bind(projectId));
  statements.push(d1.prepare('DELETE FROM outline_nodes WHERE project_id = ?').bind(projectId));
  statements.push(d1.prepare('DELETE FROM world_entities WHERE project_id = ?').bind(projectId));
  statements.push(d1.prepare('DELETE FROM locations WHERE project_id = ?').bind(projectId));
  statements.push(d1.prepare('DELETE FROM characters WHERE project_id = ?').bind(projectId));
  statements.push(d1.prepare('DELETE FROM projects WHERE id = ?').bind(projectId));

  // Bump revision
  statements.push(
    d1.prepare(`
      INSERT INTO workspace_sync_state (user_id, revision, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        revision = excluded.revision,
        updated_at = excluded.updated_at
    `).bind(user.userId, nextRev, now)
  );

  await d1.batch(statements);

  const tombstonesRecord: Record<string, number> = { [projectId]: now };
  for (const chId of chapterIds) {
    tombstonesRecord[chId] = now;
  }

  return {
    status: 200,
    data: {
      success: true,
      operationId: deleteOpId,
      deletedIds: [projectId, ...chapterIds],
      deletedAt: now,
      workspaceRevision: nextRev,
      tombstones: tombstonesRecord,
      alreadyDeleted: false
    }
  };
}

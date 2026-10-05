import { Hono } from 'hono';
import { eq, inArray, and } from 'drizzle-orm';
import { schema } from '../lib/db';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { nowTimestamp } from '../lib/auth';
import { readActiveLock, publicLock } from './chapters';
import { countWords } from '../utils/validation';
import { getAuthoritativeTombstones, getWorkspaceRevision, sha256 } from '../services/lifecycle';

type Variables = {
  db: any;
  user: AuthUser;
};

const sync = new Hono<{ Bindings: Env; Variables: Variables }>();

function unwrapWorkspace(raw: any): any {
  let current = raw;
  for (let i = 0; i < 4 && current?.data && typeof current.data === 'object'; i++) current = current.data;
  return current && typeof current === 'object' ? current : {};
}

function mergeList(local: any[] = [], incoming: any[] = []) {
  const map = new Map<string, any>();
  for (const item of local) if (item?.id) map.set(item.id, { ...item });
  for (const item of incoming) {
    if (!item?.id) continue;
    const existing = map.get(item.id);
    if (!existing || Number(item.updatedAt || item.createdAt || 0) >= Number(existing.updatedAt || existing.createdAt || 0)) {
      map.set(item.id, { ...existing, ...item });
    }
  }
  return Array.from(map.values());
}

function mergeSyncSnapshots(existingRaw: any, incomingRaw: any) {
  const existing = unwrapWorkspace(existingRaw);
  const incoming = unwrapWorkspace(incomingRaw);
  const chapterMap = new Map<string, any>();
  for (const chapter of Array.isArray(existing.chapters) ? existing.chapters : []) {
    if (chapter?.id) chapterMap.set(chapter.id, { ...chapter });
  }
  for (const chapter of Array.isArray(incoming.chapters) ? incoming.chapters : []) {
    if (!chapter?.id) continue;
    const current = chapterMap.get(chapter.id);
    if (!current) {
      chapterMap.set(chapter.id, { ...chapter });
      continue;
    }
    const currentUpdated = Number(current.updatedAt || current.createdAt || 0);
    const incomingUpdated = Number(chapter.updatedAt || chapter.createdAt || 0);
    const currentContentUpdated = Number(current.contentUpdatedAt || currentUpdated);
    const incomingContentUpdated = Number(chapter.contentUpdatedAt || incomingUpdated);
    const currentTitleUpdated = Number(current.titleUpdatedAt || currentUpdated);
    const incomingTitleUpdated = Number(chapter.titleUpdatedAt || incomingUpdated);
    const metadataSource = incomingUpdated >= currentUpdated ? chapter : current;
    chapterMap.set(chapter.id, {
      ...current,
      ...chapter,
      ...metadataSource,
      content: incomingContentUpdated > currentContentUpdated ? chapter.content : current.content,
      title: incomingTitleUpdated > currentTitleUpdated ? chapter.title : current.title,
      contentUpdatedAt: Math.max(currentContentUpdated, incomingContentUpdated),
      titleUpdatedAt: Math.max(currentTitleUpdated, incomingTitleUpdated),
      updatedAt: Math.max(currentUpdated, incomingUpdated)
    });
  }
  const mergedTombstones = { ...(existing.tombstones || {}), ...(incoming.tombstones || {}) };
  for (const id of Object.keys(mergedTombstones)) {
    mergedTombstones[id] = Math.max(Number(existing.tombstones?.[id] || 0), Number(incoming.tombstones?.[id] || 0));
    // Tombstones are authoritative: once tombstoned, ID is removed unconditionally (timestamp never resurrects)
    if (chapterMap.has(id)) chapterMap.delete(id);
  }
  const now = nowTimestamp();
  return {
    ...existing,
    ...incoming,
    projects: mergeList(existing.projects, incoming.projects).filter((p: any) => p?.id && !mergedTombstones[p.id]),
    chapters: Array.from(chapterMap.values()).filter((c: any) => c?.id && !mergedTombstones[c.id] && !mergedTombstones[c.projectId]),
    characters: mergeList(existing.characters, incoming.characters).filter((c: any) => c?.id && !mergedTombstones[c.id] && !mergedTombstones[c.projectId]),
    entities: mergeList(existing.entities || existing.worldbuilding, incoming.entities || incoming.worldbuilding).filter((e: any) => e?.id && !mergedTombstones[e.id] && !mergedTombstones[e.projectId]),
    timeline: mergeList(existing.timeline || existing.timelineEvents, incoming.timeline || incoming.timelineEvents).filter((t: any) => t?.id && !mergedTombstones[t.id] && !mergedTombstones[t.projectId]),
    outline: mergeList(existing.outline || existing.outlines, incoming.outline || incoming.outlines).filter((o: any) => o?.id && !mergedTombstones[o.id] && !mergedTombstones[o.projectId]),
    tombstones: mergedTombstones,
    lastModified: Math.max(Number(existing.lastModified || 0), Number(incoming.lastModified || 0), now)
  };
}

// All sync operations require valid JWT authentication
sync.use('*', authMiddleware);

// GET /api/sync
const getSyncHandler = async (c: any) => {
  const user = c.get('user');
  const db = c.get('db');
  const kv = c.env.KV;

  // 1. Fetch canonical data and authoritative tombstones from D1
  const dbProjects = await db.select().from(schema.projects).where(eq(schema.projects.userId, user.userId));
  const projectIds = dbProjects.map((p: any) => p.id);
  const dbChapters = projectIds.length > 0
    ? await db.select().from(schema.chapters).where(inArray(schema.chapters.projectId, projectIds))
    : [];

  const authoritativeTombstones = await getAuthoritativeTombstones(db, user.userId);
  const workspaceRevision = await getWorkspaceRevision(db, user.userId);

  const rawKv = kv ? await kv.get(`sync:${user.userId}`, 'json') : null;
  const kvData = unwrapWorkspace((rawKv as any)?.data || rawKv);

  if (dbProjects.length === 0 && (!kvData || (!kvData.projects?.length && !kvData.chapters?.length))) {
    return c.json({
      success: true,
      userId: user.userId,
      lastModified: 0,
      workspaceRevision,
      data: null,
      message: 'Chưa có bản đồng bộ nào cho tài khoản này'
    });
  }

  // Filter out any chapter in D1 that has a tombstone (defense in depth)
  const canonicalChapters = dbChapters
    .filter((ch: any) => !authoritativeTombstones.chapters.has(ch.id))
    .map((ch: any) => ({
      ...ch,
      charactersPresent: ch.charactersPresent ? JSON.parse(ch.charactersPresent) : []
    }));

  const maxDbChapterUpdated = dbChapters.reduce((max: number, ch: any) => Math.max(max, Number(ch.updatedAt || ch.createdAt || 0)), 0);
  const maxDbProjectUpdated = dbProjects.reduce((max: number, p: any) => Math.max(max, Number(p.updatedAt || p.createdAt || 0)), 0);
  const lastModified = Math.max(Number(kvData?.lastModified || 0), maxDbChapterUpdated, maxDbProjectUpdated, nowTimestamp());

  // Canonical workspace: D1 is always authoritative for active entities in a D1 account.
  // Never fallback to KV chapters when D1 has 0 chapters!
  const allTombstones = { ...(kvData?.tombstones || {}), ...authoritativeTombstones.allMap };
  const canonicalWorkspace = {
    version: 2,
    lastModified,
    workspaceRevision,
    projects: dbProjects,
    chapters: canonicalChapters,
    characters: kvData?.characters || [],
    entities: kvData?.entities || kvData?.worldbuilding || [],
    timeline: kvData?.timeline || kvData?.timelineEvents || [],
    outline: kvData?.outline || kvData?.outlines || [],
    tombstones: allTombstones
  };

  // Cache to KV
  if (kv) {
    await kv.put(`sync:${user.userId}`, JSON.stringify({
      userId: user.userId,
      lastModified,
      workspaceRevision,
      syncedAt: nowTimestamp(),
      data: canonicalWorkspace
    })).catch(() => {});
  }

  return c.json({
    success: true,
    userId: user.userId,
    lastModified,
    workspaceRevision,
    data: canonicalWorkspace,
    source: 'canonical-d1'
  });
};
sync.get('/', getSyncHandler);
sync.get('', getSyncHandler);

// POST /api/sync
const postSyncHandler = async (c: any) => {
  const user = c.get('user');
  const db = c.get('db');
  const body = await c.req.json();
  const data = body.data;

  if (!data || typeof data !== 'object') {
    return c.json({ success: false, error: 'Dữ liệu đồng bộ không hợp lệ' }, 400);
  }

  const now = nowTimestamp();
  const suppliedLockToken = String(c.req.header('X-Chapter-Lock-Token') || '');

  // 1. Authoritative Tombstones & Sync Revision from D1
  const authoritativeTombstones = await getAuthoritativeTombstones(db, user.userId);
  const currentWorkspaceRevision = await getWorkspaceRevision(db, user.userId);
  let hasMutations = false;
  const rejectedEntities: Array<{ id: string; type: 'chapter' | 'project'; reason: string }> = [];
  const acceptedOperations: string[] = [];

  // 2. Fetch user's existing projects and chapters from D1
  const existingProjects = await db.select().from(schema.projects).where(eq(schema.projects.userId, user.userId));
  const existingProjectMap = new Map<string, any>(existingProjects.map((p: any) => [p.id, p]));

  // Ensure incoming projects exist in D1
  const incomingProjects = Array.isArray(data.projects) ? data.projects : [];
  for (const proj of incomingProjects) {
    if (!proj?.id) continue;
    // Tombstone gate: do not recreate tombstoned projects!
    if (authoritativeTombstones.projects.has(proj.id)) {
      rejectedEntities.push({ id: proj.id, type: 'project', reason: 'PROJECT_DELETED' });
      continue;
    }
    if (!existingProjectMap.has(proj.id)) {
      const newProj = {
        id: proj.id,
        userId: user.userId,
        title: proj.title || 'Dự án mới',
        subtitle: proj.subtitle || null,
        description: proj.description || null,
        genre: proj.genre || 'fantasy',
        status: proj.status || 'planning',
        wordCount: Number(proj.wordCount || 0),
        chapterCount: Number(proj.chapterCount || 0),
        wordCountGoal: Number(proj.wordCountGoal || 50000),
        createdAt: Number(proj.createdAt || now),
        updatedAt: Number(proj.updatedAt || now)
      };
      try {
        await db.insert(schema.projects).values(newProj);
        existingProjectMap.set(proj.id, newProj);
        hasMutations = true;
      } catch (err: any) {
        rejectedEntities.push({ id: proj.id, type: 'project', reason: err.message || 'PROJECT_INSERT_FAILED' });
      }
    }
  }

  // Get all user project IDs
  const allUserProjectIds = Array.from(existingProjectMap.keys());
  const existingChapters = allUserProjectIds.length > 0
    ? await db.select().from(schema.chapters).where(inArray(schema.chapters.projectId, allUserProjectIds))
    : [];
  const existingChapterMap = new Map<string, any>(existingChapters.map((ch: any) => [ch.id, ch]));

  // 3. Process incoming chapters with tombstone gate, lock awareness & recovery idempotency
  const incomingChapters = Array.isArray(data.chapters) ? data.chapters : [];
  for (const chapter of incomingChapters) {
    if (!chapter?.id) continue;

    // A. Tombstone check: DO NOT RE-INSERT OR UPDATE DELETED CHAPTERS!
    if (authoritativeTombstones.chapters.has(chapter.id)) {
      rejectedEntities.push({ id: chapter.id, type: 'chapter', reason: 'CHAPTER_DELETED' });
      continue;
    }

    // B. Check if target project is tombstoned
    if (chapter.projectId && authoritativeTombstones.projects.has(chapter.projectId)) {
      rejectedEntities.push({ id: chapter.id, type: 'chapter', reason: 'PROJECT_DELETED' });
      continue;
    }

    const targetProjectId = chapter.projectId && existingProjectMap.has(chapter.projectId)
      ? chapter.projectId
      : (allUserProjectIds[0] || null);

    if (!targetProjectId) {
      rejectedEntities.push({ id: chapter.id, type: 'chapter', reason: 'NO_VALID_PROJECT' });
      continue;
    }

    // C. Clean up deleted parent reference
    let parentId = chapter.parentId || null;
    if (parentId && authoritativeTombstones.chapters.has(parentId)) {
      parentId = null;
    }

    const existingD1 = existingChapterMap.get(chapter.id);
    if (!existingD1) {
      // New chapter -> insert into D1
      const wordCount = chapter.content ? countWords(chapter.content) : 0;
      const createdChapter = {
        id: chapter.id,
        projectId: targetProjectId,
        title: chapter.title || 'Chương mới',
        content: chapter.content || '',
        contentFormat: chapter.contentFormat || 'tiptap-json',
        summary: chapter.summary || null,
        wordCount,
        orderIndex: Number(chapter.orderIndex ?? existingChapters.length),
        status: chapter.status || 'outline',
        parentId,
        notes: chapter.notes || null,
        pov: chapter.pov || null,
        location: chapter.location || null,
        charactersPresent: JSON.stringify(Array.isArray(chapter.charactersPresent) ? chapter.charactersPresent : []),
        emoji: chapter.emoji || null,
        createdAt: Number(chapter.createdAt || now),
        updatedAt: Number(chapter.updatedAt || now),
        contentUpdatedAt: Number(chapter.contentUpdatedAt || chapter.updatedAt || now),
        titleUpdatedAt: Number(chapter.titleUpdatedAt || chapter.updatedAt || now)
      };
      try {
        await db.insert(schema.chapters).values(createdChapter);
        existingChapterMap.set(chapter.id, createdChapter);
        hasMutations = true;
      } catch (err: any) {
        rejectedEntities.push({ id: chapter.id, type: 'chapter', reason: err.message || 'CHAPTER_INSERT_FAILED' });
      }
    } else {
      // Existing chapter -> check differences
      const contentChanged = chapter.content !== undefined && chapter.content !== (existingD1.content || '');
      const titleChanged = chapter.title !== undefined && chapter.title !== existingD1.title;

      if (contentChanged || titleChanged) {
        const activeLock = await readActiveLock(c, chapter.id);
        const lockHeldByOther = activeLock && (!suppliedLockToken || activeLock.lockToken !== suppliedLockToken);

        if (lockHeldByOther) {
          // Idempotent recovery creation for lock conflicts
          const payloadHash = sha256(user.userId + '::' + chapter.id + '::' + (chapter.content || ''));
          const recoveryId = `recovery_sync_${payloadHash.slice(0, 32)}`;

          if (authoritativeTombstones.chapters.has(recoveryId)) {
            rejectedEntities.push({ id: recoveryId, type: 'chapter', reason: 'RECOVERY_DELETED' });
            continue;
          }

          const existingOps = await db.select().from(schema.recoveryOperations)
            .where(and(
              eq(schema.recoveryOperations.userId, user.userId),
              eq(schema.recoveryOperations.recoveryChapterId, recoveryId)
            )).limit(1);

          if (existingOps.length > 0 && existingOps[0].state === 'deleted') {
            rejectedEntities.push({ id: recoveryId, type: 'chapter', reason: 'RECOVERY_DELETED' });
            continue;
          }

          const alreadyInD1 = existingChapterMap.has(recoveryId);
          if (!alreadyInD1) {
            const recoveryTitle = `Khôi phục – ${chapter.title || existingD1.title} – Bản đồng bộ ngoại tuyến`.slice(0, 200);
            const recovered = {
              id: recoveryId,
              projectId: targetProjectId,
              title: recoveryTitle,
              content: chapter.content || '',
              contentFormat: chapter.contentFormat || 'tiptap-json',
              summary: chapter.summary || null,
              wordCount: countWords(chapter.content || ''),
              orderIndex: Number(existingD1.orderIndex || 0) + 1,
              status: 'draft',
              parentId: existingD1.parentId || null,
              charactersPresent: existingD1.charactersPresent || '[]',
              emoji: existingD1.emoji || null,
              notes: null,
              pov: null,
              location: null,
              createdAt: now,
              updatedAt: now,
              contentUpdatedAt: now,
              titleUpdatedAt: now
            };
            try {
              await db.insert(schema.chapters).values(recovered);
              await db.insert(schema.recoveryOperations).values({
                userId: user.userId,
                operationKey: `${user.userId}::${chapter.id}::${recoveryId}`,
                sourceChapterId: chapter.id,
                payloadHash,
                recoveryChapterId: recoveryId,
                state: 'created',
                createdAt: now,
                deletedAt: null
              });
              existingChapterMap.set(recoveryId, recovered);
              hasMutations = true;
            } catch (err: any) {
              rejectedEntities.push({ id: recoveryId, type: 'chapter', reason: err.message });
            }
          }
        } else {
          // Caller holds lock or no active lock -> apply update if newer
          const incomingContentUpdated = Number(chapter.contentUpdatedAt || chapter.updatedAt || 0);
          const existingContentUpdated = Number(existingD1.contentUpdatedAt || existingD1.updatedAt || 0);
          const incomingTitleUpdated = Number(chapter.titleUpdatedAt || chapter.updatedAt || 0);
          const existingTitleUpdated = Number(existingD1.titleUpdatedAt || existingD1.updatedAt || 0);

          if (incomingContentUpdated >= existingContentUpdated || incomingTitleUpdated >= existingTitleUpdated) {
            const mutationTime = Math.max(now, Number(existingD1.updatedAt || 0) + 1);
            await db.update(schema.chapters).set({
              title: titleChanged ? chapter.title : existingD1.title,
              content: contentChanged ? chapter.content : existingD1.content,
              wordCount: contentChanged ? countWords(chapter.content) : existingD1.wordCount,
              parentId,
              updatedAt: mutationTime,
              contentUpdatedAt: contentChanged ? Math.max(incomingContentUpdated, mutationTime) : existingD1.contentUpdatedAt,
              titleUpdatedAt: titleChanged ? Math.max(incomingTitleUpdated, mutationTime) : existingD1.titleUpdatedAt
            }).where(eq(schema.chapters.id, chapter.id)).catch(() => {});
            hasMutations = true;
          }
        }
      }
    }
  }

  // 4. If any mutation occurred, bump workspaceSyncState revision
  let finalRevision = currentWorkspaceRevision;
  if (hasMutations) {
    finalRevision = currentWorkspaceRevision + 1;
    const d1 = c.env.DB;
    await d1.prepare(`
      INSERT INTO workspace_sync_state (user_id, revision, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        revision = excluded.revision,
        updated_at = excluded.updated_at
    `).bind(user.userId, finalRevision, now).run();
  }

  // 5. Read back latest canonical D1 chapters & projects (excluding any tombstoned entities)
  const finalProjects = await db.select().from(schema.projects).where(eq(schema.projects.userId, user.userId));
  const finalProjectIds = finalProjects.map((p: any) => p.id);
  const rawFinalChapters = finalProjectIds.length > 0
    ? await db.select().from(schema.chapters).where(inArray(schema.chapters.projectId, finalProjectIds))
    : [];

  const finalChapters = rawFinalChapters.filter((ch: any) => !authoritativeTombstones.chapters.has(ch.id));

  const canonicalChapters = finalChapters.map((ch: any) => ({
    ...ch,
    charactersPresent: ch.charactersPresent ? JSON.parse(ch.charactersPresent) : []
  }));

  const kv = c.env.KV;
  const existingPayload = kv ? await kv.get(`sync:${user.userId}`, 'json') : null;
  const mergedMetadata = mergeSyncSnapshots((existingPayload as any)?.data || existingPayload, data);
  const lastModified = Math.max(Number(body.lastModified || 0), now);

  const allTombstones = { ...(mergedMetadata.tombstones || {}), ...authoritativeTombstones.allMap };
  const canonicalPayload = {
    ...mergedMetadata,
    version: 2,
    lastModified,
    workspaceRevision: finalRevision,
    projects: finalProjects,
    chapters: canonicalChapters,
    tombstones: allTombstones
  };

  if (kv) {
    await kv.put(`sync:${user.userId}`, JSON.stringify({
      userId: user.userId,
      lastModified,
      workspaceRevision: finalRevision,
      syncedAt: now,
      data: canonicalPayload
    })).catch(() => {});
  }

  return c.json({
    success: true,
    userId: user.userId,
    lastModified,
    workspaceRevision: finalRevision,
    syncedAt: now,
    data: canonicalPayload,
    rejectedEntities,
    acceptedOperations,
    stats: {
      projects: finalProjects.length,
      chapters: canonicalChapters.length,
      characters: Array.isArray(canonicalPayload.characters) ? canonicalPayload.characters.length : 0
    }
  });
};
sync.post('/', postSyncHandler);
sync.post('', postSyncHandler);

export default sync;

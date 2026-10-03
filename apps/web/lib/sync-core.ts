/**
 * Pure, deterministic synchronization and merge core logic.
 * Isomorphic: runs identically in Browser, Node.js (tests), Edge Runtime (Next.js API route), and Cloudflare Workers.
 * Zero DOM or window dependencies.
 */

export interface SyncStats {
  projects: number;
  chapters: number;
  characters: number;
  lastModified: number;
  lastSynced: number | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/**
 * Pure JavaScript SHA-256 implementation.
 * 100% deterministic across all platforms (Node, mobile browser, HTTP, HTTPS, localhost, webview).
 * Eliminates the bug where crypto.subtle is undefined on mobile over HTTP or non-secure contexts.
 */
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

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Normalizes email address without cross-account aliasing.
 * Accounts with different letters (e.g. gjabach vs giabach) are strictly separate users.
 */
export function getEmailAliases(email: string): string[] {
  const clean = normalizeEmail(email);
  return clean ? [clean] : [];
}

export interface CloudAccountKeys {
  userKey: string;
  dataKey: string;
  legacyKey: string;
  rawLegacyKey: string;
  candidateKeys: string[];
}

export function getCloudAccountKeys(email: string, userId?: string): CloudAccountKeys {
  const clean = normalizeEmail(email);
  const hex = sha256(clean + ':novelist_auth_v2');
  const safeEmail = clean.replace(/[^a-z0-9_-]/g, '_');
  const legacyKey = `d_${safeEmail}`;
  const rawLegacyKey = safeEmail;

  const candidateKeys = new Set<string>();
  candidateKeys.add(`d_${hex}`);
  candidateKeys.add(legacyKey);
  candidateKeys.add(rawLegacyKey);

  // If userId is known, also add token-based backup key
  if (userId) {
    const cleanUserId = userId.replace(/^token_/, '');
    candidateKeys.add(`d_token_${cleanUserId}`);
    candidateKeys.add(`d_${cleanUserId}`);
  }

  return {
    userKey: `u_${hex}`,
    dataKey: `d_${hex}`,
    legacyKey,
    rawLegacyKey,
    candidateKeys: Array.from(candidateKeys)
  };
}

/**
 * Unwraps data if wrapped in { success, data: { ... } } or { data: { ... } } or raw JSON
 */
export function unwrapWorkspace(data: any): any {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;

  // If wrapped in an envelope like { success: true, data: ... } or { data: { data: ... } }
  if (data.data && typeof data.data === 'object') {
    if (data.data.projects || data.data.chapters || data.data.tombstones || data.success !== undefined || !data.projects) {
      return unwrapWorkspace(data.data);
    }
  }

  return data;
}

export function countWords(text: any): number {
  if (!text) return 0;
  if (typeof text !== 'string') {
    if (typeof text === 'object') {
      try {
        const plain = extractPureText(text);
        return plain.trim().split(/\s+/).filter(Boolean).length;
      } catch {
        return 0;
      }
    }
    return 0;
  }
  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object') {
      const plain = extractPureText(json);
      return plain.trim().split(/\s+/).filter(Boolean).length;
    }
  } catch {}
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function extractPureText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return String(node.text);
  if (Array.isArray(node.content)) {
    return node.content.map(extractPureText).join(' ');
  }
  return '';
}

/**
 * Strips out duplicated conflict sections created by previous versions of appendConflictContent.
 * Removes markers like "--- [Bản thảo... - Nội dung xung đột được lưu lại] ---" and subsequent duplicate copies.
 */
export function deduplicateConflictBlocks(rawContent: any): any {
  if (!rawContent) return rawContent;
  const isString = typeof rawContent === 'string';
  if (isString) {
    try {
      const json = JSON.parse(rawContent);
      if (json && typeof json === 'object' && Array.isArray(json.content)) {
        const markerIdx = json.content.findIndex((b: any) => {
          const text = (b?.content || []).map((x: any) => x.text || '').join('');
          return text.includes('Nội dung xung đột được lưu lại');
        });
        if (markerIdx !== -1) {
          const cleanedBlocks = json.content.slice(0, markerIdx);
          return JSON.stringify({ ...json, content: cleanedBlocks });
        }
        return rawContent;
      }
    } catch {
      // Plain text string (not JSON)
    }

    const markerIdx = rawContent.indexOf('--- [');
    if (markerIdx !== -1 && rawContent.includes('Nội dung xung đột được lưu lại')) {
      return rawContent.slice(0, markerIdx).trim();
    }
    return rawContent;
  }

  if (rawContent && typeof rawContent === 'object' && Array.isArray(rawContent.content)) {
    const markerIdx = rawContent.content.findIndex((b: any) => {
      const text = (b?.content || []).map((x: any) => x.text || '').join('');
      return text.includes('Nội dung xung đột được lưu lại');
    });
    if (markerIdx !== -1) {
      return { ...rawContent, content: rawContent.content.slice(0, markerIdx) };
    }
  }

  return rawContent;
}

export function appendConflictContent(mainContent: any, conflictContent: any, conflictSource: string = 'Bản đồng bộ'): string {
  try {
    const mainJson = typeof mainContent === 'string' ? JSON.parse(mainContent) : mainContent;
    const conflictJson = typeof conflictContent === 'string' ? JSON.parse(conflictContent) : conflictContent;
    if (mainJson && typeof mainJson === 'object' && Array.isArray(mainJson.content)) {
      const conflictBlocks = (conflictJson && Array.isArray(conflictJson.content))
        ? conflictJson.content
        : [{ type: 'paragraph', content: [{ type: 'text', text: typeof conflictContent === 'string' ? conflictContent : JSON.stringify(conflictContent) }] }];

      const mergedContent = [
        ...mainJson.content,
        {
          type: 'paragraph',
          content: [{ type: 'text', text: `--- [${conflictSource} - Nội dung xung đột được lưu lại] ---` }]
        },
        ...conflictBlocks
      ];
      return JSON.stringify({ ...mainJson, content: mergedContent });
    } else if (conflictJson && typeof conflictJson === 'object' && Array.isArray(conflictJson.content)) {
      // Main is plain text, but conflict is TipTap JSON: convert main to TipTap document
      const mainText = typeof mainContent === 'string' ? mainContent : '';
      const mainBlocks = mainText
        ? [{ type: 'paragraph', content: [{ type: 'text', text: mainText }] }]
        : [];
      const mergedContent = [
        ...mainBlocks,
        {
          type: 'paragraph',
          content: [{ type: 'text', text: `--- [${conflictSource} - Nội dung xung đột được lưu lại] ---` }]
        },
        ...conflictJson.content
      ];
      return JSON.stringify({ type: 'doc', content: mergedContent });
    }
  } catch {}

  const mainStr = typeof mainContent === 'string' ? mainContent : JSON.stringify(mainContent);
  const conflictStr = typeof conflictContent === 'string' ? conflictContent : JSON.stringify(conflictContent);
  return `${mainStr}\n\n--- [${conflictSource} - Nội dung xung đột được lưu lại] ---\n\n${conflictStr}`;
}

/**
 * Intelligent bidirectional merge for workspaces based on strict Last-Write-Wins (LWW) with Tombstones.
 * Guarantees that:
 * 1. "Cái nào là cuối cùng tại thời điểm viết thì ngay lập tức là bản chính"
 *    The version written/saved latest in time (higher updatedAt) is strictly the canonical source of truth.
 *    Any edits (additions, rewrites, trimming, typo fixes) are preserved faithfully without word count bias.
 * 2. If Device A (PC) wrote Chapter 2 and Device B (Mobile) only has Chapter 1, Chapter 2 is NEVER lost (union of active chapters).
 * 3. TOMBSTONES DELETIONS: If an entity was deleted on any device (recorded in tombstones with deletedAt timestamp),
 *    it is NEVER resurrected unless a device wrote a genuinely newer version (updatedAt > deletedAt).
 *    Cascade deletion of projects also suppresses all child chapters, characters, and outline items.
 * 4. orderIndex collisions are resolved sequentially per sibling group (parentId), respecting the tree hierarchy.
 * 5. Project chapterCount and wordCount are strictly recomputed from the merged chapter list.
 */
export function mergeWorkspaces(
  local: any, 
  remote: any
): { merged: any; hasRemoteChanges: boolean; hasLocalChanges: boolean } {
  const unwrappedLocal = unwrapWorkspace(local) || {};
  const unwrappedRemote = unwrapWorkspace(remote) || {};

  let hasRemoteChanges = false;
  let hasLocalChanges = false;

  // --- Merge Tombstones (Retention: 30 days) ---
  const localTombstones: Record<string, number> = (unwrappedLocal.tombstones && typeof unwrappedLocal.tombstones === 'object')
    ? { ...unwrappedLocal.tombstones }
    : {};
  const remoteTombstones: Record<string, number> = (unwrappedRemote.tombstones && typeof unwrappedRemote.tombstones === 'object')
    ? { ...unwrappedRemote.tombstones }
    : {};

  const mergedTombstones: Record<string, number> = {};
  const allTombstoneIds = new Set([...Object.keys(localTombstones), ...Object.keys(remoteTombstones)]);
  const now = Date.now();
  const MAX_TOMBSTONE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

  for (const id of allTombstoneIds) {
    const lDel = Number(localTombstones[id] || 0);
    const rDel = Number(remoteTombstones[id] || 0);
    const maxDel = Math.max(lDel, rDel);
    if (maxDel > 0 && now - maxDel < MAX_TOMBSTONE_AGE) {
      mergedTombstones[id] = maxDel;
    }
  }

  for (const k of Object.keys(mergedTombstones)) {
    if (!localTombstones[k] || localTombstones[k] < mergedTombstones[k]) {
      hasRemoteChanges = true;
    }
    if (!remoteTombstones[k] || remoteTombstones[k] < mergedTombstones[k]) {
      hasLocalChanges = true;
    }
  }

  const isDeleted = (id?: string, parentId?: string, updatedAt: number = 0): boolean => {
    if (id && mergedTombstones[id]) {
      const delTime = mergedTombstones[id];
      if (delTime >= updatedAt) return true;
    }
    if (parentId && mergedTombstones[parentId]) {
      const parentDelTime = mergedTombstones[parentId];
      if (parentDelTime >= updatedAt) return true;
    }
    return false;
  };

  const localProjects: any[] = Array.isArray(unwrappedLocal.projects) ? [...unwrappedLocal.projects] : [];
  const remoteProjects: any[] = Array.isArray(unwrappedRemote.projects) ? [...unwrappedRemote.projects] : [];

  const localChapters: any[] = Array.isArray(unwrappedLocal.chapters) ? [...unwrappedLocal.chapters] : [];
  const remoteChapters: any[] = Array.isArray(unwrappedRemote.chapters) ? [...unwrappedRemote.chapters] : [];

  const localCharacters: any[] = Array.isArray(unwrappedLocal.characters) ? [...unwrappedLocal.characters] : [];
  const remoteCharacters: any[] = Array.isArray(unwrappedRemote.characters) ? [...unwrappedRemote.characters] : [];

  const localEntities: any[] = Array.isArray(unwrappedLocal.entities || unwrappedLocal.worldbuilding) 
    ? [...(unwrappedLocal.entities || unwrappedLocal.worldbuilding)] : [];
  const remoteEntities: any[] = Array.isArray(unwrappedRemote.entities || unwrappedRemote.worldbuilding) 
    ? (unwrappedRemote.entities || unwrappedRemote.worldbuilding) : [];

  const localTimeline: any[] = Array.isArray(unwrappedLocal.timeline || unwrappedLocal.timelineEvents) 
    ? [...(unwrappedLocal.timeline || unwrappedLocal.timelineEvents)] : [];
  const remoteTimeline: any[] = Array.isArray(unwrappedRemote.timeline || unwrappedRemote.timelineEvents) 
    ? (unwrappedRemote.timeline || unwrappedRemote.timelineEvents) : [];

  const localTimelineEras: any[] = Array.isArray(unwrappedLocal.timelineEras) ? [...unwrappedLocal.timelineEras] : [];
  const remoteTimelineEras: any[] = Array.isArray(unwrappedRemote.timelineEras) ? unwrappedRemote.timelineEras : [];

  const localOutline: any[] = Array.isArray(unwrappedLocal.outline || unwrappedLocal.outlines) 
    ? [...(unwrappedLocal.outline || unwrappedLocal.outlines)] : [];
  const remoteOutline: any[] = Array.isArray(unwrappedRemote.outline || unwrappedRemote.outlines) 
    ? (unwrappedRemote.outline || unwrappedRemote.outlines) : [];

  // --- Merge Chapters by id with Strict Last-Write-Wins (LWW) and Tombstones ---
  const chapterMap = new Map<string, any>();
  for (const c of localChapters) {
    if (!c?.id) continue;
    const cUp = Number(c.updatedAt || c.createdAt || 0);
    if (isDeleted(c.id, c.projectId, cUp)) {
      hasLocalChanges = true;
      continue;
    }
    chapterMap.set(c.id, { ...c });
  }

  for (const rc of remoteChapters) {
    if (!rc?.id) continue;
    const remoteUpdated = Number(rc.updatedAt || rc.createdAt || 0);
    if (isDeleted(rc.id, rc.projectId, remoteUpdated)) {
      hasRemoteChanges = true;
      continue;
    }

    const existing = chapterMap.get(rc.id);
    if (!existing) {
      // Remote has a chapter that local does not have and NOT deleted -> ADD IT!
      chapterMap.set(rc.id, { ...rc });
      hasRemoteChanges = true;
    } else {
      const localUpdated = Number(existing.updatedAt || existing.createdAt || 0);
      const remoteUpdated = Number(rc.updatedAt || rc.createdAt || 0);

      const localContentUpdated = Number(existing.contentUpdatedAt || localUpdated);
      const remoteContentUpdated = Number(rc.contentUpdatedAt || remoteUpdated);

      const localTitleUpdated = Number(existing.titleUpdatedAt || localUpdated);
      const remoteTitleUpdated = Number(rc.titleUpdatedAt || remoteUpdated);

      const remoteContentStr = typeof rc.content === 'string' ? rc.content : JSON.stringify(rc.content || '');
      const localContentStr = typeof existing.content === 'string' ? existing.content : JSON.stringify(existing.content || '');

      const isContentDifferent = remoteContentStr !== localContentStr;
      const isTitleDifferent = rc.title !== existing.title;
      const isOrderDifferent = Number(rc.orderIndex ?? 0) !== Number(existing.orderIndex ?? 0);
      const isParentDifferent = (rc.parentId || null) !== (existing.parentId || null);
      const isEmojiDifferent = (rc.emoji || null) !== (existing.emoji || null);

      const isDifferent = isContentDifferent || isTitleDifferent || isOrderDifferent || isParentDifferent || isEmojiDifferent;

      if (!isDifferent) {
        // Content and metadata are identical: unify with the latest timestamp
        const maxUpdated = Math.max(remoteUpdated, localUpdated);
        chapterMap.set(rc.id, {
          ...existing,
          ...rc,
          updatedAt: maxUpdated,
          contentUpdatedAt: Math.max(localContentUpdated, remoteContentUpdated),
          titleUpdatedAt: Math.max(localTitleUpdated, remoteTitleUpdated)
        });
      } else {
        // 1. Field-level merge for Title
        let resolvedTitle = existing.title;
        let resolvedTitleUpdated = Math.max(localTitleUpdated, remoteTitleUpdated);
        if (isTitleDifferent) {
          if (remoteTitleUpdated > localTitleUpdated) {
            resolvedTitle = rc.title;
            resolvedTitleUpdated = remoteTitleUpdated;
            hasRemoteChanges = true;
          } else if (localTitleUpdated > remoteTitleUpdated) {
            resolvedTitle = existing.title;
            resolvedTitleUpdated = localTitleUpdated;
            hasLocalChanges = true;
          } else {
            resolvedTitle = remoteUpdated >= localUpdated ? rc.title : existing.title;
            if (remoteUpdated >= localUpdated) hasRemoteChanges = true;
            else hasLocalChanges = true;
          }
        }

        // 2. Anti-data loss merge for Content
        let resolvedContent = existing.content;
        let resolvedContentUpdated = Math.max(localContentUpdated, remoteContentUpdated);
        if (isContentDifferent) {
          const localTrimmed = localContentStr.trim();
          const remoteTrimmed = remoteContentStr.trim();
          const localLen = localTrimmed.length;
          const remoteLen = remoteTrimmed.length;

          // Check if one side has substantive content while the other is empty or placeholder
          const localHasSubstance = localLen > 40;
          const remoteIsEmpty = remoteLen <= 10;
          const remoteHasSubstance = remoteLen > 40;
          const localIsEmpty = localLen <= 10;

          if (localHasSubstance && remoteIsEmpty && remoteContentUpdated > localContentUpdated) {
            // Guard: Prevent empty/stale remote from wiping substantive local content
            resolvedContent = existing.content;
            resolvedContentUpdated = localContentUpdated;
            hasLocalChanges = true;
          } else if (remoteHasSubstance && localIsEmpty && localContentUpdated > remoteContentUpdated) {
            // Guard: Prevent empty/stale local from wiping substantive remote content
            resolvedContent = rc.content;
            resolvedContentUpdated = remoteContentUpdated;
            hasRemoteChanges = true;
          } else if (remoteContentUpdated > localContentUpdated) {
            resolvedContent = rc.content;
            resolvedContentUpdated = remoteContentUpdated;
            hasRemoteChanges = true;
          } else if (localContentUpdated > remoteContentUpdated) {
            resolvedContent = existing.content;
            resolvedContentUpdated = localContentUpdated;
            hasLocalChanges = true;
          } else {
            // Equal timestamps tie-break: longer substantive text wins
            if (remoteLen >= localLen) {
              resolvedContent = rc.content;
              resolvedContentUpdated = remoteContentUpdated;
              if (remoteContentStr !== localContentStr) hasRemoteChanges = true;
            } else {
              resolvedContent = existing.content;
              resolvedContentUpdated = localContentUpdated;
              if (remoteContentStr !== localContentStr) hasLocalChanges = true;
            }
          }
        }

        // 3. Metadata resolution (orderIndex, parentId, emoji)
        const newerEntity = remoteUpdated >= localUpdated ? rc : existing;
        if (remoteUpdated > localUpdated) hasRemoteChanges = true;
        if (localUpdated > remoteUpdated) hasLocalChanges = true;

        const maxFinalUpdated = Math.max(remoteUpdated, localUpdated, resolvedContentUpdated, resolvedTitleUpdated);
        const resolvedWords = (resolvedContent === rc.content ? rc.wordCount : existing.wordCount) ?? countWords(resolvedContent);

        const mergedChapter = {
          ...existing,
          ...rc,
          title: resolvedTitle,
          content: resolvedContent,
          orderIndex: newerEntity.orderIndex !== undefined ? newerEntity.orderIndex : (existing.orderIndex ?? rc.orderIndex ?? 1),
          parentId: newerEntity.parentId !== undefined ? newerEntity.parentId : (existing.parentId || null),
          emoji: newerEntity.emoji !== undefined ? newerEntity.emoji : (existing.emoji || null),
          updatedAt: maxFinalUpdated,
          contentUpdatedAt: resolvedContentUpdated,
          titleUpdatedAt: resolvedTitleUpdated,
          wordCount: resolvedWords
        };
        chapterMap.set(rc.id, mergedChapter);
      }
    }
  }

  // Check if local has active chapters remote does not have
  for (const lc of localChapters) {
    const lUp = Number(lc?.updatedAt || lc?.createdAt || 0);
    if (lc?.id && !isDeleted(lc.id, lc.projectId, lUp) && !remoteChapters.some(rc => rc?.id === lc.id)) {
      hasLocalChanges = true;
    }
  }

  const rawMergedChapters = Array.from(chapterMap.values());

  // Fix orderIndex collisions: group chapters by sibling level (projectId + '::' + (parentId || 'root'))
  // to ensure sequential orderIndex per sibling group, respecting the document tab hierarchy.
  const byParentGroup = new Map<string, any[]>();
  for (const ch of rawMergedChapters) {
    const parentKey = ch.parentId ? String(ch.parentId) : 'root';
    const groupKey = `${ch.projectId || 'unknown'}::${parentKey}`;
    if (!byParentGroup.has(groupKey)) byParentGroup.set(groupKey, []);
    byParentGroup.get(groupKey)!.push(ch);
  }

  const mergedChapters: any[] = [];
  for (const [, siblingChapters] of byParentGroup) {
    siblingChapters.sort((a: any, b: any) => {
      const oa = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
      const ob = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
      if (oa !== ob) return oa - ob;
      const ca = a.createdAt || 0;
      const cb = b.createdAt || 0;
      if (ca !== cb) return ca - cb;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    siblingChapters.forEach((ch: any, idx: number) => {
      ch.orderIndex = idx + 1;
      mergedChapters.push(ch);
    });
  }

  // --- Merge Projects by id with Strict LWW and Tombstones ---
  const projectMap = new Map<string, any>();
  for (const p of localProjects) {
    if (!p?.id) continue;
    const pUp = Number(p.updatedAt || p.createdAt || 0);
    if (isDeleted(p.id, undefined, pUp)) {
      hasLocalChanges = true;
      continue;
    }
    projectMap.set(p.id, { ...p });
  }

  for (const rp of remoteProjects) {
    if (!rp?.id) continue;
    const remoteUpdated = Number(rp.updatedAt || rp.createdAt || 0);
    if (isDeleted(rp.id, undefined, remoteUpdated)) {
      hasRemoteChanges = true;
      continue;
    }

    const existing = projectMap.get(rp.id);
    if (!existing) {
      projectMap.set(rp.id, { ...rp });
      hasRemoteChanges = true;
    } else {
      const localUpdated = Number(existing.updatedAt || existing.createdAt || 0);
      if (remoteUpdated > localUpdated) {
        projectMap.set(rp.id, { ...existing, ...rp });
        hasRemoteChanges = true;
      } else if (localUpdated > remoteUpdated) {
        projectMap.set(rp.id, { ...rp, ...existing });
        hasLocalChanges = true;
      } else {
        projectMap.set(rp.id, { ...existing, ...rp });
      }
    }
  }

  for (const lp of localProjects) {
    const lUp = Number(lp?.updatedAt || lp?.createdAt || 0);
    if (lp?.id && !isDeleted(lp.id, undefined, lUp) && !remoteProjects.some(rp => rp?.id === lp.id)) {
      hasLocalChanges = true;
    }
  }

  const activeUser = unwrappedRemote.user || unwrappedLocal.user || null;
  const currentUserId = activeUser?.id;

  const hasAnyChapters = localChapters.length > 0 || remoteChapters.length > 0;
  const mergedProjects = Array.from(projectMap.values()).map(p => {
    const pChapters = mergedChapters.filter(c => c.projectId === p.id);
    const calculatedWords = pChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
    return {
      ...p,
      userId: p.userId || currentUserId || 'usr_default',
      chapterCount: hasAnyChapters ? pChapters.length : (p.chapterCount || 0),
      wordCount: hasAnyChapters ? calculatedWords : (p.wordCount || 0)
    };
  });

  // --- Merge helper for characters, entities, timeline, outline with Tombstones ---
  const mergeEntityList = (localList: any[], remoteList: any[]) => {
    const map = new Map<string, any>();
    for (const item of localList) {
      if (!item?.id) continue;
      const lUp = Number(item.updatedAt || item.createdAt || 0);
      if (isDeleted(item.id, item.projectId, lUp)) {
        hasLocalChanges = true;
        continue;
      }
      map.set(item.id, { ...item });
    }
    for (const item of remoteList) {
      if (!item?.id) continue;
      const rUp = Number(item.updatedAt || item.createdAt || 0);
      if (isDeleted(item.id, item.projectId, rUp)) {
        hasRemoteChanges = true;
        continue;
      }
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, { ...item });
        hasRemoteChanges = true;
      } else {
        const lUp = Number(existing.updatedAt || existing.createdAt || 0);
        if (rUp > lUp) {
          map.set(item.id, { ...existing, ...item });
          hasRemoteChanges = true;
        } else if (lUp > rUp) {
          map.set(item.id, { ...item, ...existing });
          hasLocalChanges = true;
        } else {
          map.set(item.id, { ...existing, ...item });
        }
      }
    }
    for (const item of localList) {
      const lUp = Number(item?.updatedAt || item?.createdAt || 0);
      if (item?.id && !isDeleted(item.id, item.projectId, lUp) && !remoteList.some(r => r?.id === item.id)) {
        hasLocalChanges = true;
      }
    }
    return Array.from(map.values());
  };

  const mergedCharacters = mergeEntityList(localCharacters, remoteCharacters);
  const mergedEntities = mergeEntityList(localEntities, remoteEntities);
  const mergedTimeline = mergeEntityList(localTimeline, remoteTimeline);
  const mergedTimelineEras = mergeEntityList(localTimelineEras, remoteTimelineEras);
  const mergedOutline = mergeEntityList(localOutline, remoteOutline);

  const mergedLastModified = Math.max(
    Number(unwrappedLocal.lastModified || 0),
    Number(unwrappedRemote.lastModified || 0),
    ...mergedChapters.map(c => Number(c.updatedAt || 0)),
    Date.now()
  );

  return {
    merged: {
      version: 2,
      lastModified: mergedLastModified,
      exportedAt: Date.now(),
      projects: mergedProjects,
      chapters: mergedChapters,
      characters: mergedCharacters,
      entities: mergedEntities,
      worldbuilding: mergedEntities,
      timeline: mergedTimeline,
      timelineEvents: mergedTimeline,
      timelineEras: mergedTimelineEras,
      outline: mergedOutline,
      outlines: mergedOutline,
      tombstones: mergedTombstones,
      user: unwrappedRemote.user || unwrappedLocal.user || null,
      aiConfig: unwrappedRemote.aiConfig || unwrappedLocal.aiConfig || { provider: 'gemini', model: 'gemini-3.8-flash' }
    },
    hasRemoteChanges,
    hasLocalChanges
  };
}

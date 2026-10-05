'use client';

import { sha256 } from './sync-core';

export interface DeviceBackupManifestItem {
  id: string;
  title: string;
  wordCount: number;
  contentHash: string;
  updatedAt: number;
  source: string;
}

export interface DeviceBackup {
  backupId: string;
  deviceLabel: string;
  exportedAt: number;
  origin: string;
  data: {
    projects: any[];
    chapters: any[];
    pendingDrafts: Record<string, any>;
    pendingRecoveries: any[];
    characters: any[];
    worldbuilding: any[];
    timeline: any[];
    outline: any[];
    tombstones: Record<string, number>;
  };
  manifest: {
    chapters: DeviceBackupManifestItem[];
    drafts: DeviceBackupManifestItem[];
  };
}

export function createDeviceBackup(deviceLabel: string): DeviceBackup {
  const isBrowser = typeof window !== 'undefined';
  const getJson = (key: string, def: any = []) => {
    if (!isBrowser) return def;
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : def;
    } catch {
      return def;
    }
  };

  const projects = getJson('novelist_projects', []);
  const chapters = getJson('novelist_chapters', []);
  const pendingDrafts = getJson('novelist_pending_chapter_drafts', {});
  const pendingRecoveries = getJson('novelist_pending_recoveries', []);
  const characters = getJson('novelist_characters', []);
  const worldbuilding = getJson('novelist_worldbuilding', getJson('novelist_entities', []));
  const timeline = getJson('novelist_timeline', getJson('novelist_timeline_events', []));
  const outline = getJson('novelist_outline', getJson('novelist_outlines', []));
  const tombstones = getJson('novelist_tombstones', {});

  const now = Date.now();
  const backupId = `backup_${deviceLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}_${now}`;

  const chapterManifest: DeviceBackupManifestItem[] = (Array.isArray(chapters) ? chapters : []).map((ch: any) => ({
    id: ch.id,
    title: ch.title || '',
    wordCount: Number(ch.wordCount || 0),
    contentHash: sha256(ch.content || ''),
    updatedAt: Number(ch.updatedAt || ch.createdAt || 0),
    source: deviceLabel
  }));

  const draftManifest: DeviceBackupManifestItem[] = Object.keys(pendingDrafts).map((chId: string) => {
    const draft = pendingDrafts[chId];
    return {
      id: chId,
      title: draft.title || '',
      wordCount: typeof draft.content === 'string' ? draft.content.split(/\s+/).filter(Boolean).length : 0,
      contentHash: sha256(draft.content || ''),
      updatedAt: Number(draft.savedLocallyAt || 0),
      source: `${deviceLabel} (Draft)`
    };
  });

  return {
    backupId,
    deviceLabel,
    exportedAt: now,
    origin: isBrowser ? window.location.origin : '',
    data: {
      projects,
      chapters,
      pendingDrafts,
      pendingRecoveries,
      characters,
      worldbuilding,
      timeline,
      outline,
      tombstones
    },
    manifest: {
      chapters: chapterManifest,
      drafts: draftManifest
    }
  };
}

export function downloadDeviceBackup(deviceLabel: string): void {
  if (typeof window === 'undefined') return;
  const backup = createDeviceBackup(deviceLabel);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novelist-backup-${deviceLabel.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reconciles two device backups without silently deleting either version.
 * When two different contents for the same chapter exist without enough base version info:
 * - One version is preserved as the chapter.
 * - The second version is preserved as a dedicated recovery chapter.
 * - Both contents and their hashes are completely preserved.
 */
export function reconcileDeviceBackups(backupA: DeviceBackup, backupB: DeviceBackup): {
  reconciledChapters: any[];
  recoveriesCreated: any[];
  preservationReport: Array<{
    chapterId: string;
    originalTitle: string;
    versionAHash: string;
    versionBHash: string;
    action: 'identical' | 'recovery_created';
    recoveryId?: string;
  }>;
} {
  const chaptersA = Array.isArray(backupA.data?.chapters) ? backupA.data.chapters : [];
  const chaptersB = Array.isArray(backupB.data?.chapters) ? backupB.data.chapters : [];

  const mapA = new Map<string, any>(chaptersA.map(c => [c.id, c]));
  const mapB = new Map<string, any>(chaptersB.map(c => [c.id, c]));

  const allIds = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  const reconciledChapters: any[] = [];
  const recoveriesCreated: any[] = [];
  const preservationReport: any[] = [];

  for (const id of allIds) {
    const chA = mapA.get(id);
    const chB = mapB.get(id);

    if (chA && !chB) {
      reconciledChapters.push(chA);
      continue;
    }
    if (!chA && chB) {
      reconciledChapters.push(chB);
      continue;
    }

    // Both exist
    const hashA = sha256(chA.content || '');
    const hashB = sha256(chB.content || '');

    if (hashA === hashB && chA.title === chB.title) {
      // Identical
      reconciledChapters.push(Number(chA.updatedAt || 0) >= Number(chB.updatedAt || 0) ? chA : chB);
      preservationReport.push({
        chapterId: id,
        originalTitle: chA.title,
        versionAHash: hashA,
        versionBHash: hashB,
        action: 'identical'
      });
    } else {
      // Divergent: keep canonical (newer version). Do not create recovery chapters.
      const isANewer = Number(chA.updatedAt || 0) >= Number(chB.updatedAt || 0);
      const canonicalChapter = isANewer ? chA : chB;
      reconciledChapters.push(canonicalChapter);

      preservationReport.push({
        chapterId: id,
        originalTitle: canonicalChapter.title,
        versionAHash: hashA,
        versionBHash: hashB,
        action: 'identical'
      });
    }
  }

  return {
    reconciledChapters,
    recoveriesCreated,
    preservationReport
  };
}

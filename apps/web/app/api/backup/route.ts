import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceLabel, data, origin, exportedAt } = body;

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Dữ liệu sao lưu không hợp lệ' }, { status: 400 });
    }

    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    const pendingDrafts = data.pendingDrafts || {};
    const pendingRecoveries = Array.isArray(data.pendingRecoveries) ? data.pendingRecoveries : [];

    // Compute hashes for all chapters and drafts to prove 0% content loss
    const chapterManifest = chapters.map((ch: any) => ({
      id: ch.id,
      title: ch.title,
      wordCount: ch.wordCount || 0,
      contentHash: createHash('sha256').update(ch.content || '').digest('hex'),
      updatedAt: ch.updatedAt || 0
    }));

    const draftManifest = Object.keys(pendingDrafts).map((chId: string) => {
      const draft = pendingDrafts[chId];
      return {
        chapterId: chId,
        title: draft.title,
        contentHash: createHash('sha256').update(draft.content || '').digest('hex'),
        savedLocallyAt: draft.savedLocallyAt || 0
      };
    });

    const backupId = `backup_${deviceLabel ? deviceLabel.replace(/[^a-zA-Z0-9_-]/g, '_') : 'device'}_${Date.now()}`;

    return NextResponse.json({
      success: true,
      backupId,
      deviceLabel: deviceLabel || 'Chưa định danh',
      origin: origin || req.headers.get('origin') || '',
      exportedAt: exportedAt || Date.now(),
      stats: {
        projectsCount: Array.isArray(data.projects) ? data.projects.length : 0,
        chaptersCount: chapters.length,
        pendingDraftsCount: Object.keys(pendingDrafts).length,
        pendingRecoveriesCount: pendingRecoveries.length
      },
      manifest: {
        chapters: chapterManifest,
        drafts: draftManifest
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý bản sao lưu' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCloudAccountKeys, mergeWorkspaces, unwrapWorkspace, normalizeEmail } from '@/lib/sync-core';

export const runtime = 'edge';

// In-memory fallback cache for Edge runtime per authenticated user
const secureSyncMemoryStore = new Map<string, { lastModified: number; syncedAt: number; data: any }>();

function getUserSyncIdentifier(authHeader: string): string {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  // Safe hash / prefix identifier
  return token.slice(-32) || 'anonymous';
}

// GET /api/sync
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('key') || searchParams.get('dataKey') || '';
    const queryEmail = normalizeEmail(searchParams.get('email') || '');
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

    if (!queryKey && !queryEmail && (!authHeader || !authHeader.toLowerCase().startsWith('bearer '))) {
      return NextResponse.json({
        success: false,
        error: 'Yêu cầu đăng nhập hoặc cung cấp khóa đồng bộ'
      }, { status: 401 });
    }

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // 1. If backend API is configured, forward securely to Worker API
    if (authHeader && apiUrl && !apiUrl.includes('localhost')) {
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/sync`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          return NextResponse.json(await res.json());
        }
      } catch {}
    }

    // 2. Build exhaustive list of candidate keys across primary SHA-256, legacy, aliases, and token
    const tokenIdentifier = getUserSyncIdentifier(authHeader || '');
    const rawKey = queryKey || tokenIdentifier;
    const targetKey = rawKey.startsWith('d_') ? rawKey : `d_${rawKey}`;

    const candidateKeys = new Set<string>();
    if (targetKey) candidateKeys.add(targetKey);
    if (queryKey) {
      candidateKeys.add(queryKey.startsWith('d_') ? queryKey : `d_${queryKey}`);
      candidateKeys.add(queryKey.replace(/^d_/, ''));
    }

    // If email is provided or known
    if (queryEmail) {
      const keys = getCloudAccountKeys(queryEmail, tokenIdentifier);
      keys.candidateKeys.forEach(k => candidateKeys.add(k));
    }

    if (tokenIdentifier && tokenIdentifier !== 'anonymous') {
      candidateKeys.add(`d_token_${tokenIdentifier}`);
      candidateKeys.add(`d_${tokenIdentifier}`);
    }

    // 3. Concurrently fetch all candidate keys from KVDB and Edge in-memory cache
    const fetchedCandidates: any[] = [];

    const keyList = Array.from(candidateKeys);
    const fetchPromises = keyList.map(async (k) => {
      // Check memory store first
      const mem = secureSyncMemoryStore.get(k);
      if (mem && mem.data) {
        const unwrapped = unwrapWorkspace(mem.data);
        if (unwrapped) fetchedCandidates.push(unwrapped);
      }

      // Check persistent KVDB store
      try {
        const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 2) {
            try {
              const parsed = JSON.parse(text);
              const unwrapped = unwrapWorkspace(parsed);
              if (unwrapped) {
                fetchedCandidates.push(unwrapped);
              }
            } catch {}
          }
        }
      } catch {}
    });

    await Promise.allSettled(fetchPromises);

    if (fetchedCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        key: targetKey,
        lastModified: 0,
        data: null,
        message: 'Chưa có bản đồng bộ nào cho tài khoản này'
      });
    }

    // 4. Smart-merge all found candidates so NO chapters or edits are missed
    let unifiedRemote = fetchedCandidates[0];
    for (let i = 1; i < fetchedCandidates.length; i++) {
      const { merged } = mergeWorkspaces(unifiedRemote, fetchedCandidates[i]);
      unifiedRemote = merged;
    }

    return NextResponse.json({
      success: true,
      key: targetKey,
      lastModified: unifiedRemote.lastModified || Date.now(),
      data: unifiedRemote,
      source: 'cloud'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi mạng khi tải dữ liệu đồng bộ'
    }, { status: 500 });
  }
}

// POST /api/sync
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = body.data;
    const bodyKey = body.dataKey || body.key;
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

    if (!bodyKey && (!authHeader || !authHeader.toLowerCase().startsWith('bearer '))) {
      return NextResponse.json({
        success: false,
        error: 'Yêu cầu đăng nhập hoặc cung cấp khóa đồng bộ'
      }, { status: 401 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ success: false, error: 'Dữ liệu đồng bộ không hợp lệ' }, { status: 400 });
    }

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // 1. If backend API is configured, forward securely to Worker API
    if (authHeader && apiUrl && !apiUrl.includes('localhost')) {
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/sync`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          return NextResponse.json(await res.json());
        }
      } catch {}
    }

    // 2. Extract account keys
    const tokenIdentifier = getUserSyncIdentifier(authHeader || '');
    const rawKey = bodyKey || tokenIdentifier;
    const targetKey = rawKey.startsWith('d_') ? rawKey : `d_${rawKey}`;
    const incomingLastModified = Number(body.lastModified || data.lastModified || Date.now());
    const now = Date.now();

    const email = normalizeEmail(data?.user?.email || (typeof body?.email === 'string' ? body.email : ''));
    const cloudKeys = email ? getCloudAccountKeys(email, tokenIdentifier) : null;

    // 3. SERVER-SIDE SMART MERGE: Check existing cloud data so a device with fewer chapters
    // NEVER erases chapters written on another device (e.g. PC wrote Chapter 2, phone only had Chapter 1)
    let existingCloudData: any = null;
    const keysToCheck = cloudKeys ? cloudKeys.candidateKeys : [targetKey];

    for (const k of keysToCheck) {
      const mem = secureSyncMemoryStore.get(k);
      if (mem && mem.data) {
        existingCloudData = unwrapWorkspace(mem.data);
        if (existingCloudData) break;
      }
      try {
        const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 2) {
            const parsed = JSON.parse(text);
            existingCloudData = unwrapWorkspace(parsed);
            if (existingCloudData) break;
          }
        }
      } catch {}
    }

    let finalDataToStore = data;
    if (existingCloudData) {
      // Merge existing cloud data with incoming client data
      const { merged } = mergeWorkspaces(existingCloudData, data);
      finalDataToStore = merged;
    }

    const finalLastModified = Math.max(incomingLastModified, Number(existingCloudData?.lastModified || 0), now);
    finalDataToStore.lastModified = finalLastModified;
    finalDataToStore.syncedAt = now;

    // Clean payload without double-wrapping
    const storePayload = {
      ...finalDataToStore,
      lastModified: finalLastModified,
      syncedAt: now
    };

    // Update memory store
    secureSyncMemoryStore.set(targetKey, {
      lastModified: finalLastModified,
      syncedAt: now,
      data: storePayload
    });

    // 4. Persist to KVDB cloud store across candidate keys (primary SHA-256 + legacy keys)
    const targetKeysToPersist = new Set<string>();
    targetKeysToPersist.add(targetKey);
    if (cloudKeys) {
      targetKeysToPersist.add(cloudKeys.dataKey);
      targetKeysToPersist.add(cloudKeys.legacyKey);
      targetKeysToPersist.add(cloudKeys.rawLegacyKey);
    }
    if (tokenIdentifier && tokenIdentifier !== 'anonymous') {
      targetKeysToPersist.add(`d_token_${tokenIdentifier}`);
      targetKeysToPersist.add(`d_${tokenIdentifier}`);
    }

    try {
      const payloadStr = JSON.stringify(storePayload);
      const putPromises = Array.from(targetKeysToPersist).map(k =>
        fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${k}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr
        }).catch(() => {})
      );
      await Promise.allSettled(putPromises);
    } catch {}

    const projectsCount = Array.isArray(finalDataToStore.projects) ? finalDataToStore.projects.length : 0;
    const chaptersCount = Array.isArray(finalDataToStore.chapters) ? finalDataToStore.chapters.length : 0;
    const charactersCount = Array.isArray(finalDataToStore.characters) ? finalDataToStore.characters.length : 0;

    return NextResponse.json({
      success: true,
      key: targetKey,
      lastModified: finalLastModified,
      syncedAt: now,
      data: finalDataToStore,
      stats: {
        projects: projectsCount,
        chapters: chaptersCount,
        characters: charactersCount
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi mạng khi lưu dữ liệu đồng bộ'
    }, { status: 500 });
  }
}

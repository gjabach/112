'use client';
import { useEffect, useState, useCallback, useRef, startTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch, apiFetchRemote, countWords, RemoteApiError } from '@/lib/utils';
import { executeAIChat } from '@/lib/ai';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Sparkles,
  FileText,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  X,
  Loader2,
  PanelLeft,
  Download,
  LockKeyhole,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { DocumentTabsSidebar, buildTabTree, flattenTabTree, extractHeadingsFromContent, getSubtreeHeight, type TabTreeNode } from '@/components/editor/document-tabs-sidebar';
import type { EditorHeading } from '@/components/editor/tiptap-editor';
import { MagicSparkles, GlowingDot } from '@/components/vfx/magic-sparkles';
import { EditorErrorBoundary } from '@/components/editor/editor-boundary';
import { playChapterSwitchSound, playSuccessSound, playPopSound, playDeleteSound } from '@/lib/sound';
import { SoundToggleButton } from '@/components/layout/sound-provider';
import { SyncStatusButton } from '@/components/layout/sync-provider';
import {
  pushSync,
  pullSync,
  triggerAutoPush,
  pauseAutoSync,
  resumeAutoSync,
  protectChapterFromSync,
  unprotectChapterFromSync,
  registerSyncFlushHandler
} from '@/lib/sync';
import { deduplicateConflictBlocks } from '@/lib/sync-core';
import {
  CHAPTER_LOCK_HEARTBEAT_MS,
  acquireChapterLock,
  cacheRemoteChapter,
  clearPendingChapterDraft,
  createRecoveryChapter,
  createRecoveryId,
  getDeviceIdentity,
  getPendingChapterDraft,
  hasRemoteChapterApi,
  heartbeatChapterLock,
  persistLocalChapterDraft,
  probeApiCapabilities,
  releaseChapterLock,
  retryPendingRecoveries,
  type ApiConnectionStatus,
  type ChapterVersion,
  type DeviceIdentity,
  type OwnedChapterLock,
  type PublicChapterLock
} from '@/lib/chapter-lock';
import { MechKeyboardProvider, MechKeyboardToggle } from '@/components/editor/mech-keyboard-provider';

const TiptapEditor = dynamic(
  () => import('@/components/editor/tiptap-editor').then((m) => m.TiptapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh] text-muted-foreground animate-pulse gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm">Đang tải trình soạn thảo văn bản...</span>
      </div>
    )
  }
);

export default function ChapterEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.projectId || '') as string;
  const chapterId = (params?.chapterId || '') as string;

  const [chapter, setChapter] = useState<any>(null);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [liveHeadings, setLiveHeadings] = useState<EditorHeading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ApiConnectionStatus>('checking');
  const [lockState, setLockState] = useState<'acquiring' | 'owned' | 'locked' | 'offline'>('acquiring');
  const [saveStatus, setSaveStatus] = useState<'clean' | 'dirty' | 'local-saved' | 'uploading' | 'server-acked' | 'conflict' | 'failed'>('clean');
  const [visibleLock, setVisibleLock] = useState<PublicChapterLock | null>(null);
  const [recoveryChapterId, setRecoveryChapterId] = useState<string | null>(null);

  // Protection refs against sync race conditions and text reversions
  const isDirtyRef = useRef(false);
  const savingRef = useRef(false);
  savingRef.current = saving;
  const contentRef = useRef(content);
  contentRef.current = content;
  const titleRef = useRef(title);
  titleRef.current = title;
  const chapterRef = useRef(chapter);
  chapterRef.current = chapter;
  const activeChapterIdRef = useRef(chapterId);
  activeChapterIdRef.current = chapterId;
  const lastKeystrokeTimeRef = useRef<number>(0);
  const lastContentEditedTimeRef = useRef<number>(0);
  const lastTitleEditedTimeRef = useRef<number>(0);
  const lockStateRef = useRef(lockState);
  lockStateRef.current = lockState;
  const connectionStatusRef = useRef<ApiConnectionStatus>(connectionStatus);
  connectionStatusRef.current = connectionStatus;
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;
  const ownedLockRef = useRef<OwnedChapterLock | null>(null);
  const identityRef = useRef<DeviceIdentity | null>(null);
  const serverVersionRef = useRef<ChapterVersion>({ updatedAt: 0, contentUpdatedAt: 0, titleUpdatedAt: 0 });
  const offlineBaseVersionRef = useRef<ChapterVersion | null>(null);
  const hasUnsyncedDraftRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const latestSaveRevisionRef = useRef(0);
  const queuedSaveCountRef = useRef(0);
  const pendingRecoveryRef = useRef<{ recoveryId: string; capturedAt: number } | null>(null);
  const lockAcquireInFlightRef = useRef(false);
  const saveChapterRef = useRef<(newContent?: string, newTitle?: string, isManual?: boolean) => Promise<void>>(async () => {});
  const tryAcquireLockRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const transitionLockState = useCallback((next: 'acquiring' | 'owned' | 'locked' | 'offline') => {
    lockStateRef.current = next;
    setLockState(next);
  }, []);

  // Document Tabs sidebar state (persisted)
  const [showTabsSidebar, setShowTabsSidebar] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novelist_tabs_sidebar_open');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const toggleTabsSidebar = () => {
    setShowTabsSidebar(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('novelist_tabs_sidebar_open', String(next));
      }
      return next;
    });
  };

  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(2000);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchDirection, setSwitchDirection] = useState<'next' | 'prev' | 'fade'>('fade');
  const [targetChapterInfo, setTargetChapterInfo] = useState<{ title: string; orderIndex?: number } | null>(null);

  const fetchChapterData = useCallback(async (isInitial = true) => {
    if (!chapterId || !projectId) return;
    try {
      let res: any;
      let listRes: any;
      try {
        const fetcher = hasRemoteChapterApi() ? apiFetchRemote : apiFetch;
        [res, listRes] = await Promise.all([
          fetcher(`/api/chapters/${chapterId}`),
          fetcher(`/api/projects/${projectId}/chapters`)
        ]);
      } catch (error) {
        if (!isInitial) throw error;
        // Initial offline load may use the cached chapter, but background
        // refreshes must never silently substitute stale local data.
        [res, listRes] = await Promise.all([
          apiFetch(`/api/chapters/${chapterId}`),
          apiFetch(`/api/projects/${projectId}/chapters`)
        ]);
        if (hasRemoteChapterApi()) {
          transitionLockState('offline');
          protectChapterFromSync(chapterId);
        }
      }
      if (activeChapterIdRef.current !== chapterId) return;
      if (!res?.chapter) {
        isDirtyRef.current = false;
        toast.error('Thẻ này đã bị xóa hoặc không còn tồn tại', { id: 'chapter-deleted-error' });
        router.push(`/editor/${projectId}`);
        return;
      }
      if (res?.chapter) {
        const normalized = {
          ...res.chapter,
          contentUpdatedAt: Number(res.chapter.contentUpdatedAt || res.chapter.updatedAt || 0),
          titleUpdatedAt: Number(res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0)
        };
        if (hasRemoteChapterApi() && !hasUnsyncedDraftRef.current) cacheRemoteChapter(normalized);
        const rawContent = normalized.content;
        const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');
        const isProtectedEditor = lockStateRef.current === 'owned' || lockStateRef.current === 'offline' || lockStateRef.current === 'acquiring';
        const canApply = !isDirtyRef.current && !savingRef.current && (!isProtectedEditor || !chapterRef.current || chapterRef.current.id !== chapterId);
        if ((isInitial || !chapterRef.current || chapterRef.current.id !== chapterId) && !isDirtyRef.current) {
          setChapter(normalized);
          setTitle(normalized.title || 'Thẻ');
          setContent(safeContent);
          setLiveHeadings(extractHeadingsFromContent(safeContent));
          lastContentEditedTimeRef.current = normalized.contentUpdatedAt;
          lastTitleEditedTimeRef.current = normalized.titleUpdatedAt;
          serverVersionRef.current = {
            updatedAt: Number(normalized.updatedAt || 0),
            contentUpdatedAt: normalized.contentUpdatedAt,
            titleUpdatedAt: normalized.titleUpdatedAt
          };
          isDirtyRef.current = false;
        } else if (canApply && lockStateRef.current === 'locked') {
          setChapter(normalized);
          setTitle(normalized.title || 'Thẻ');
          setContent(safeContent);
          setLiveHeadings(extractHeadingsFromContent(safeContent));
          serverVersionRef.current = {
            updatedAt: Number(normalized.updatedAt || 0),
            contentUpdatedAt: normalized.contentUpdatedAt,
            titleUpdatedAt: normalized.titleUpdatedAt
          };
        }
      }
      setAllChapters(Array.isArray(listRes?.chapters) ? listRes.chapters : []);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi tải thẻ');
    } finally {
      startTransition(() => {
        setLoading(false);
        setIsSwitching(false);
        setTargetChapterInfo(null);
      });
    }
  }, [chapterId, projectId, router, transitionLockState]);

  const preserveDraftAsRecovery = useCallback(async () => {
    if (!hasUnsyncedDraftRef.current && !isDirtyRef.current) return null;
    const identity = identityRef.current || getDeviceIdentity();
    const capturedAt = Date.now();
    const pending = pendingRecoveryRef.current || {
      capturedAt,
      recoveryId: `${createRecoveryId(identity.sessionId, chapterId)}_${capturedAt}`.slice(0, 158)
    };
    pendingRecoveryRef.current = pending;
    try {
      const result = await createRecoveryChapter({
        recoveryId: pending.recoveryId,
        chapterId,
        content: contentRef.current,
        title: titleRef.current,
        deviceLabel: identity.deviceLabel,
        capturedAt: pending.capturedAt
      });
      pendingRecoveryRef.current = null;
      clearPendingChapterDraft(chapterId);
      hasUnsyncedDraftRef.current = false;
      isDirtyRef.current = false;
      setRecoveryChapterId(result?.chapter?.id || pending.recoveryId);
      toast.warning('Bản ngoại tuyến đã được giữ thành một thẻ khôi phục riêng', { id: 'offline-recovery-created' });
      return result?.chapter?.id || pending.recoveryId;
    } catch {
      toast.error('Chưa thể tạo thẻ khôi phục. Bản nháp vẫn được giữ trên thiết bị này.', { id: 'offline-recovery-pending' });
      return null;
    }
  }, [chapterId]);

  const handleLockLost = useCallback(async (lock: PublicChapterLock | null) => {
    ownedLockRef.current = null;
    setVisibleLock(lock);
    transitionLockState('locked');
    const recoveryId = await preserveDraftAsRecovery();
    if (recoveryId) {
      unprotectChapterFromSync(chapterId);
      await fetchChapterData(false);
    }
  }, [chapterId, fetchChapterData, preserveDraftAsRecovery, transitionLockState]);

  const tryAcquireLock = useCallback(async (force = false) => {
    if (!chapterId) return;
    const probe = await probeApiCapabilities(force);
    setConnectionStatus(probe.status);
    if (!probe.available || !hasRemoteChapterApi()) {
      if (!offlineBaseVersionRef.current) offlineBaseVersionRef.current = { ...serverVersionRef.current };
      transitionLockState('offline');
      protectChapterFromSync(chapterId);
      return;
    }
    if (lockAcquireInFlightRef.current) return;
    lockAcquireInFlightRef.current = true;
    const identity = identityRef.current || getDeviceIdentity();
    identityRef.current = identity;
    if (lockStateRef.current !== 'offline') transitionLockState('acquiring');
    try {
      if (isDirtyRef.current || hasUnsyncedDraftRef.current) {
        persistLocalChapterDraft(chapterId, contentRef.current, titleRef.current, serverVersionRef.current);
      }
      const result = await acquireChapterLock(chapterId, identity, force, force ? (visibleLock?.version || '') : '');
      if (activeChapterIdRef.current !== chapterId) {
        await releaseChapterLock(chapterId, result.lock.token);
        return;
      }
      const serverChangedWhileOffline = offlineBaseVersionRef.current
        && (result.chapterVersion.contentUpdatedAt !== offlineBaseVersionRef.current.contentUpdatedAt
          || result.chapterVersion.titleUpdatedAt !== offlineBaseVersionRef.current.titleUpdatedAt);

      if (serverChangedWhileOffline && hasUnsyncedDraftRef.current) {
        transitionLockState('locked');
        const recoveryId = await preserveDraftAsRecovery();
        await releaseChapterLock(chapterId, result.lock.token);
        ownedLockRef.current = null;
        offlineBaseVersionRef.current = null;
        if (recoveryId) {
          unprotectChapterFromSync(chapterId);
          router.push(`/editor/${projectId}/${recoveryId}`);
        } else {
          transitionLockState('locked');
        }
        return;
      }

      ownedLockRef.current = result.lock;
      serverVersionRef.current = result.chapterVersion;
      offlineBaseVersionRef.current = null;
      setVisibleLock(null);
      setConnectionStatus('reachable');
      transitionLockState('owned');
      protectChapterFromSync(chapterId);
      if (hasUnsyncedDraftRef.current) {
        void saveChapterRef.current(contentRef.current, titleRef.current, true);
      } else if (serverChangedWhileOffline) {
        await fetchChapterData(true);
      }
    } catch (error: any) {
      if (error instanceof RemoteApiError && error.status === 423) {
        setConnectionStatus('reachable');
        ownedLockRef.current = null;
        if (hasUnsyncedDraftRef.current || isDirtyRef.current) {
          await handleLockLost(error.data?.lock || null);
        } else {
          setVisibleLock(error.data?.lock || null);
          transitionLockState('locked');
          unprotectChapterFromSync(chapterId);
        }
      } else if (error instanceof RemoteApiError && (error.status === 401 || error.status === 403)) {
        setConnectionStatus('auth-required');
        if (!offlineBaseVersionRef.current) offlineBaseVersionRef.current = { ...serverVersionRef.current };
        transitionLockState('offline');
        protectChapterFromSync(chapterId);
      } else {
        const probeCheck = await probeApiCapabilities(false);
        setConnectionStatus(probeCheck.status);
        if (!offlineBaseVersionRef.current) offlineBaseVersionRef.current = { ...serverVersionRef.current };
        transitionLockState('offline');
        protectChapterFromSync(chapterId);
      }
    } finally {
      lockAcquireInFlightRef.current = false;
    }
  }, [chapterId, fetchChapterData, handleLockLost, projectId, preserveDraftAsRecovery, router, transitionLockState, visibleLock?.version]);
  tryAcquireLockRef.current = tryAcquireLock;

  const retryConnection = useCallback(async () => {
    toast.info('Đang kiểm tra kết nối...', { id: 'retry-conn' });
    const probe = await probeApiCapabilities(true);
    setConnectionStatus(probe.status);
    if (probe.status === 'unconfigured') {
      toast.warning('Dịch vụ đồng bộ chưa được cấu hình (NEXT_PUBLIC_API_URL)');
      return;
    }
    if (probe.status === 'auth-required') {
      toast.error('Cần đăng nhập lại để tiếp tục đồng bộ');
      return;
    }
    if (!probe.available) {
      toast.error('Vẫn chưa kết nối được máy chủ');
      return;
    }
    toast.success('Đã kết nối máy chủ!');
    await retryPendingRecoveries();
    await fetchChapterData(false);
    await tryAcquireLockRef.current(false);
  }, [fetchChapterData]);

  useEffect(() => {
    if (!chapterId || !projectId) return;
    identityRef.current = getDeviceIdentity();
    ownedLockRef.current = null;
    const pendingDraft = getPendingChapterDraft(chapterId);
    isDirtyRef.current = Boolean(pendingDraft);
    hasUnsyncedDraftRef.current = Boolean(pendingDraft);
    offlineBaseVersionRef.current = pendingDraft?.baseVersion || null;
    pendingRecoveryRef.current = null;
    if (pendingDraft) {
      const restoredChapter = {
        id: chapterId,
        projectId,
        title: pendingDraft.title,
        content: pendingDraft.content,
        ...pendingDraft.baseVersion
      };
      contentRef.current = pendingDraft.content;
      titleRef.current = pendingDraft.title;
      chapterRef.current = restoredChapter;
      serverVersionRef.current = pendingDraft.baseVersion;
      setContent(pendingDraft.content);
      setTitle(pendingDraft.title);
      setChapter(restoredChapter);
      setLiveHeadings(extractHeadingsFromContent(pendingDraft.content));
    }
    transitionLockState('acquiring');
    setVisibleLock(null);
    setRecoveryChapterId(null);
    if (navigator.onLine && hasRemoteChapterApi()) void retryPendingRecoveries();
    void fetchChapterData(true);
    void tryAcquireLockRef.current(false);
    void pullSync(false).catch(() => {});

    const handleSync = async () => {
      try {
        const fetcher = hasRemoteChapterApi() ? apiFetchRemote : apiFetch;
        const listRes = await fetcher(`/api/projects/${projectId}/chapters`);
        if (Array.isArray(listRes?.chapters)) setAllChapters(listRes.chapters);
      } catch {}
      if (lockStateRef.current === 'locked' && !isDirtyRef.current && !savingRef.current) {
        await fetchChapterData(false);
      }
    };
    const handleOnline = async () => {
      await retryPendingRecoveries();
      if (lockStateRef.current === 'offline') await tryAcquireLockRef.current(false);
    };
    const unregisterFlush = registerSyncFlushHandler(chapterId, () => {
      if ((lockStateRef.current !== 'owned' && lockStateRef.current !== 'offline') || (!isDirtyRef.current && !hasUnsyncedDraftRef.current)) return;
      return saveChapterRef.current(contentRef.current, titleRef.current, true);
    });
    window.addEventListener('novelist-sync-updated', handleSync);
    window.addEventListener('online', handleOnline);
    return () => {
      unregisterFlush();
      window.removeEventListener('novelist-sync-updated', handleSync);
      window.removeEventListener('online', handleOnline);
      const token = ownedLockRef.current?.token;
      if (isDirtyRef.current || hasUnsyncedDraftRef.current) {
        persistLocalChapterDraft(chapterId, contentRef.current, titleRef.current, serverVersionRef.current);
      }
      if (token) void releaseChapterLock(chapterId, token);
      ownedLockRef.current = null;
      resumeAutoSync(chapterId);
      unprotectChapterFromSync(chapterId);
    };
  }, [chapterId, fetchChapterData, projectId, transitionLockState]);

  useEffect(() => {
    if (lockState !== 'offline' || !hasRemoteChapterApi()) return;
    const timer = window.setInterval(() => {
      void tryAcquireLockRef.current(false);
    }, CHAPTER_LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [lockState]);

  useEffect(() => {
    if (lockState !== 'owned' || !ownedLockRef.current?.token) return;
    const timer = window.setInterval(async () => {
      const token = ownedLockRef.current?.token;
      if (!token) return;
      try {
        if (isDirtyRef.current || hasUnsyncedDraftRef.current) {
          persistLocalChapterDraft(chapterId, contentRef.current, titleRef.current, serverVersionRef.current);
        }
        const result = await heartbeatChapterLock(chapterId, token);
        if (ownedLockRef.current) ownedLockRef.current.expiresAt = result.expiresAt;
      } catch (error: any) {
        if (error instanceof RemoteApiError && error.status === 423) {
          await handleLockLost(error.data?.lock || null);
        } else {
          if (!offlineBaseVersionRef.current) offlineBaseVersionRef.current = { ...serverVersionRef.current };
          transitionLockState('offline');
          hasUnsyncedDraftRef.current = hasUnsyncedDraftRef.current || isDirtyRef.current;
          protectChapterFromSync(chapterId);
        }
      }
    }, CHAPTER_LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [chapterId, handleLockLost, lockState, transitionLockState]);

  // Active visible polling for viewer mode (lockState === 'locked')
  useEffect(() => {
    if (lockState !== 'locked' || !chapterId) return;

    const pollCanonical = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (isDirtyRef.current || savingRef.current || hasUnsyncedDraftRef.current) return;
      try {
        const fetcher = hasRemoteChapterApi() ? apiFetchRemote : apiFetch;
        const res = await fetcher(`/api/chapters/${chapterId}`);
        if (!res?.chapter) return;
        const normalized = {
          ...res.chapter,
          contentUpdatedAt: Number(res.chapter.contentUpdatedAt || res.chapter.updatedAt || 0),
          titleUpdatedAt: Number(res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0)
        };
        const hasNewerContent = normalized.contentUpdatedAt > serverVersionRef.current.contentUpdatedAt;
        const hasNewerTitle = normalized.titleUpdatedAt > serverVersionRef.current.titleUpdatedAt;
        if (hasNewerContent || hasNewerTitle) {
          const rawContent = normalized.content;
          const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');
          serverVersionRef.current = {
            updatedAt: Number(normalized.updatedAt || 0),
            contentUpdatedAt: normalized.contentUpdatedAt,
            titleUpdatedAt: normalized.titleUpdatedAt
          };
          cacheRemoteChapter(normalized);
          setChapter(normalized);
          if (hasNewerTitle) setTitle(normalized.title || 'Thẻ');
          if (hasNewerContent) {
            setContent(safeContent);
            setLiveHeadings(extractHeadingsFromContent(safeContent));
          }
        }
        if (res.activeLock) {
          setVisibleLock(res.activeLock);
        }
      } catch {
        // Silent background polling error
      }
    };

    const timer = window.setInterval(pollCanonical, 8000);
    return () => window.clearInterval(timer);
  }, [chapterId, lockState]);

  const saveChapter = useCallback(async (newContent?: string, newTitle?: string, isManual = false) => {
    if (lockStateRef.current === 'locked' || lockStateRef.current === 'acquiring') return;
    const contentToSave = newContent !== undefined ? newContent : contentRef.current;
    const titleToSave = newTitle !== undefined ? newTitle : titleRef.current;
    const revision = ++latestSaveRevisionRef.current;
    hasUnsyncedDraftRef.current = true;
    persistLocalChapterDraft(chapterId, contentToSave, titleToSave, serverVersionRef.current);
    queuedSaveCountRef.current += 1;
    setSaving(true);
    setSaveStatus('uploading');

    const executeSave = async () => {
      try {
        // Coalesce snapshots which have not started yet. An in-flight older
        // request is still followed by the latest snapshot in this same queue.
        if (revision < latestSaveRevisionRef.current && !isManual) return;

        if (!hasRemoteChapterApi() || lockStateRef.current === 'offline') {
          if (!offlineBaseVersionRef.current) offlineBaseVersionRef.current = { ...serverVersionRef.current };
          setLastSaved(Date.now());
          setSaveStatus('local-saved');
          return;
        }
        const activeLock = ownedLockRef.current;
        if (lockStateRef.current !== 'owned' || !activeLock?.token) {
          setSaveStatus('local-saved');
          return;
        }

        const response = await apiFetchRemote(`/api/chapters/${chapterId}`, {
          method: 'PATCH',
          headers: { 'X-Chapter-Lock-Token': activeLock.token },
          body: JSON.stringify({
            title: titleToSave,
            content: contentToSave,
            contentFormat: 'tiptap-json',
            baseContentUpdatedAt: serverVersionRef.current.contentUpdatedAt,
            baseTitleUpdatedAt: serverVersionRef.current.titleUpdatedAt
          })
        });

        const saved = response?.chapter || {};
        const nextVersion = {
          updatedAt: Number(saved.updatedAt || Date.now()),
          contentUpdatedAt: Number(saved.contentUpdatedAt || saved.updatedAt || Date.now()),
          titleUpdatedAt: Number(saved.titleUpdatedAt || saved.updatedAt || Date.now())
        };
        serverVersionRef.current = nextVersion;
        lastContentEditedTimeRef.current = nextVersion.contentUpdatedAt;
        lastTitleEditedTimeRef.current = nextVersion.titleUpdatedAt;
        cacheRemoteChapter({ ...saved, title: titleToSave, content: contentToSave, ...nextVersion });

        if (revision === latestSaveRevisionRef.current) {
          const stillCurrent = contentRef.current === contentToSave && titleRef.current === titleToSave;
          setChapter((prev: any) => ({ ...prev, ...saved, title: titleToSave, content: contentToSave, ...nextVersion }));
          setLastSaved(nextVersion.updatedAt);
          isDirtyRef.current = !stillCurrent;
          hasUnsyncedDraftRef.current = !stillCurrent;
          if (stillCurrent) {
            clearPendingChapterDraft(chapterId, { content: contentToSave, title: titleToSave });
            setSaveStatus('server-acked');
            playSuccessSound();
          } else {
            setSaveStatus('dirty');
          }
        }

        if (isManual && revision === latestSaveRevisionRef.current) pushSync().catch(() => {});
        else triggerAutoPush(1000);
      } catch (error: any) {
        if (activeChapterIdRef.current !== chapterId) return;
        if (error instanceof RemoteApiError && (error.status === 409 || error.status === 423)) {
          setSaveStatus('conflict');
          if (error.status === 423) await handleLockLost(error.data?.lock || null);
          else {
            transitionLockState('locked');
            await preserveDraftAsRecovery();
            unprotectChapterFromSync(chapterId);
            await fetchChapterData(false);
          }
        } else {
          if (!offlineBaseVersionRef.current) offlineBaseVersionRef.current = { ...serverVersionRef.current };
          transitionLockState('offline');
          setSaveStatus('local-saved');
          protectChapterFromSync(chapterId);
          toast.warning('Mất kết nối. Bản nháp đang được lưu trên thiết bị này.', { id: 'editor-offline-save' });
        }
      } finally {
        queuedSaveCountRef.current = Math.max(0, queuedSaveCountRef.current - 1);
        if (queuedSaveCountRef.current === 0) setSaving(false);
      }
    };

    const queued = saveChainRef.current.then(executeSave, executeSave);
    saveChainRef.current = queued;
    await queued;
  }, [chapterId, fetchChapterData, handleLockLost, preserveDraftAsRecovery, transitionLockState]);
  saveChapterRef.current = saveChapter;

  // Responsive auto-save: debounced 700ms after user stops typing
  useEffect(() => {
    if (!chapter) return;
    if (lockState === 'locked' || lockState === 'acquiring') return;
    if (content === chapter.content && title === chapter.title) return;

    const timer = setTimeout(() => {
      saveChapter(undefined, undefined, false);
    }, 700);

    return () => clearTimeout(timer);
  }, [content, title, chapter, saveChapter, lockState]);

  // BUG 4 FIX: Auto-sync tab title from the first heading if title is currently default (e.g. "Thẻ 1", "Thẻ", "Thẻ con 1")
  useEffect(() => {
    if (lockStateRef.current === 'locked' || lockStateRef.current === 'acquiring') return;
    if (!liveHeadings || liveHeadings.length === 0) return;
    const firstHeading = liveHeadings[0]?.text?.trim();
    if (!firstHeading) return;

    const isDefault = (t: string) => {
      const clean = (t || '').trim();
      return !clean || /^Thẻ(\s+\d+|\s+không\s+tên)?$/i.test(clean) || /.*Thẻ con\s+\d+$/i.test(clean);
    };

    if (isDefault(titleRef.current) && firstHeading !== titleRef.current) {
      setTitle(firstHeading);
      titleRef.current = firstHeading;
      isDirtyRef.current = true;
      setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: firstHeading } : c));
    }
  }, [liveHeadings, chapterId]);

  // Global Ctrl+S / Cmd+S save shortcut
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (lockStateRef.current === 'locked' || lockStateRef.current === 'acquiring') return;
        saveChapter(undefined, undefined, true);
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [saveChapter]);

  // Save before unload / closing tab or switching apps on mobile
  useEffect(() => {
    const handleFlushSave = () => {
      if (content !== chapter?.content || title !== chapter?.title) {
        saveChapter(undefined, undefined, true);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFlushSave();
      }
    };

    window.addEventListener('beforeunload', handleFlushSave);
    window.addEventListener('pagehide', handleFlushSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleFlushSave);
      window.removeEventListener('pagehide', handleFlushSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [content, title, chapter, saveChapter]);

  // Hierarchical Chapter Navigation (depth-first tree order)
  const treeNodes = buildTabTree(allChapters);
  const orderedChapters = flattenTabTree(treeNodes);
  const currentIndex = orderedChapters.findIndex(c => c?.id === chapterId);
  const prevChapter = currentIndex > 0 ? orderedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < orderedChapters.length - 1 ? orderedChapters[currentIndex + 1] : null;

  const navigateToChapter = (targetId: string, forcedDir?: 'next' | 'prev' | 'fade') => {
    if (!targetId || targetId === chapterId || isSwitching) return;

    const targetIdx = orderedChapters.findIndex(c => c?.id === targetId);
    const targetChap = orderedChapters[targetIdx];
    const dir = forcedDir || (targetIdx > currentIndex ? 'next' : targetIdx < currentIndex ? 'prev' : 'fade');

    playChapterSwitchSound();
    setIsSwitching(true);
    setSwitchDirection(dir);
    if (targetChap) {
      setTargetChapterInfo({ title: targetChap.title, orderIndex: targetChap.orderIndex });
    }

    if (content !== chapter?.content || title !== chapter?.title) {
      saveChapter(undefined, undefined, true).catch(() => {});
    }

    setTimeout(() => {
      router.push(`/editor/${projectId}/${targetId}`);
    }, 120);
  };

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleAIContinue = async () => {
    setAiLoading(true);
    setAiSuggestion('');
    try {
      await executeAIChat({
        projectId,
        contextType: 'chapter',
        contextId: chapterId,
        message: content.slice(-2000) || 'Viết tiếp diễn biến cho văn bản này',
        skill: 'continue_writing',
        stream: true,
        onChunk: (chunk) => {
          setAiSuggestion(prev => prev + chunk);
        }
      });
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi gọi AI');
    } finally {
      setAiLoading(false);
    }
  };

  const insertAISuggestion = () => {
    if (!aiSuggestion) return;
    try {
      const current = content ? JSON.parse(content) : { type: 'doc', content: [] };
      const newContent = {
        ...current,
        content: [
          ...(current.content || []),
          { type: 'paragraph', content: [{ type: 'text', text: aiSuggestion }] }
        ]
      };
      const newContentStr = JSON.stringify(newContent);
      isDirtyRef.current = true;
      setContent(newContentStr);
      saveChapter(newContentStr, undefined, true);
      setAiSuggestion('');
      toast.success('Đã chèn nội dung AI vào văn bản');
    } catch {
      setContent(content + '\n\n' + aiSuggestion);
      setAiSuggestion('');
    }
  };

  // Tab Sidebar Operations
  const handleCreateTab = async (tabTitle: string, parentId?: string | null): Promise<string | void> => {
    if (allChapters.length >= 100) {
      toast.error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
      return;
    }
    try {
      const maxOrder = allChapters.length > 0 ? Math.max(...allChapters.map(c => c.orderIndex || 0)) : 0;
      const res = await apiFetch(`/api/projects/${projectId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          title: tabTitle.trim(),
          orderIndex: maxOrder + 1,
          status: 'draft',
          parentId: parentId || null
        })
      });
      const newId = res?.chapter?.id || res?.id;
      if (newId) {
        await fetchChapterData(false);
        pushSync().catch(() => {});
        return newId;
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi tạo thẻ');
    }
  };

  const handleRenameTab = async (targetId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (targetId === chapterId) {
      if (lockStateRef.current !== 'owned' && lockStateRef.current !== 'offline') {
        toast.error('Thẻ này đang ở chế độ chỉ đọc');
        return;
      }
      setTitle(trimmedTitle);
      isDirtyRef.current = true;
      hasUnsyncedDraftRef.current = true;
      await saveChapter(contentRef.current, trimmedTitle, true);
      return;
    }
    await apiFetch(`/api/chapters/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: trimmedTitle })
    });
    await fetchChapterData(false);
    pushSync().catch(() => {});
  };

  const handleDeleteTab = async (targetId: string) => {
    // BUG 3 FIX: Cascade delete all descendants to prevent orphan tabs
    const getAllDescendantIds = (rootId: string): string[] => {
      const children = allChapters.filter(c => c.parentId === rootId);
      return children.flatMap(c => [c.id, ...getAllDescendantIds(c.id)]);
    };
    const descendantIds = getAllDescendantIds(targetId);
    const allIdsToDelete = [targetId, ...descendantIds];

    if (allChapters.length <= allIdsToDelete.length) {
      toast.error('Tài liệu phải có tối thiểu 1 thẻ');
      return;
    }
    try {
      // Delete descendants from leaves to root to avoid FK issues
      for (const id of [...descendantIds].reverse()) {
        await apiFetch(`/api/chapters/${id}`, {
          method: 'DELETE',
          headers: id === chapterId && ownedLockRef.current?.token
            ? { 'X-Chapter-Lock-Token': ownedLockRef.current.token }
            : undefined
        });
      }
      await apiFetch(`/api/chapters/${targetId}`, {
        method: 'DELETE',
        headers: targetId === chapterId && ownedLockRef.current?.token
          ? { 'X-Chapter-Lock-Token': ownedLockRef.current.token }
          : undefined
      });
      playDeleteSound();
      toast.success('Đã xóa thẻ');
      pushSync().catch(() => {});
      if (targetId === chapterId || allIdsToDelete.includes(chapterId)) {
        // BUG 2 FIX: Navigate to adjacent tab instead of first tab
        const currentIdx = orderedChapters.findIndex(c => c.id === chapterId);
        const remaining = orderedChapters.filter(c => !allIdsToDelete.includes(c.id));
        if (remaining.length > 0) {
          const adjacentIdx = Math.min(currentIdx, remaining.length - 1);
          const adjacentTab = remaining[Math.max(0, adjacentIdx)];
          navigateToChapter(adjacentTab.id, currentIdx < orderedChapters.length - 1 ? 'next' : 'prev');
        } else {
          router.push(`/editor/${projectId}`);
        }
      } else {
        await fetchChapterData(false);
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xóa thẻ');
    }
  };

  const handleDuplicateTab = async (targetId: string) => {
    if (allChapters.length >= 100) {
      toast.error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
      return;
    }
    try {
      const res = await apiFetch(`/api/chapters/${targetId}/duplicate`, { method: 'POST' });
      playSuccessSound();
      toast.success('Đã nhân bản thẻ');
      pushSync().catch(() => {});
      await fetchChapterData(false);
      const newId = res?.chapter?.id || res?.id;
      if (newId) {
        navigateToChapter(newId, 'next');
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi nhân bản thẻ');
    }
  };

  // Move tab strictly swaps among siblings of the same parent (Google Docs standard)
  const handleMoveTab = async (targetId: string, direction: 'up' | 'down') => {
    const target = allChapters.find(c => c.id === targetId);
    if (!target) return;
    const parentId = target.parentId || null;

    // Get all siblings with same parentId in their current relative order
    const siblings = allChapters
      .filter(c => (c.parentId || null) === parentId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const idx = siblings.findIndex(c => c.id === targetId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    // Build hierarchical tree
    const tree = buildTabTree(allChapters);

    // Swap strictly within sibling nodes in the tree
    const swapSiblingInTree = (nodes: TabTreeNode[]): boolean => {
      const sIdx = nodes.findIndex(n => n.id === targetId);
      if (sIdx !== -1) {
        const sTargetIdx = direction === 'up' ? sIdx - 1 : sIdx + 1;
        if (sTargetIdx >= 0 && sTargetIdx < nodes.length) {
          const temp = nodes[sIdx];
          nodes[sIdx] = nodes[sTargetIdx];
          nodes[sTargetIdx] = temp;
          return true;
        }
      }
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          if (swapSiblingInTree(n.children)) return true;
        }
      }
      return false;
    };

    swapSiblingInTree(tree);

    // Flatten tree in preorder traversal to retain subtrees and updated sibling order
    const newFlat = flattenTabTree(tree);

    try {
      await apiFetch(`/api/projects/${projectId}/chapters/reorder`, {
        method: 'POST',
        headers: ownedLockRef.current?.token
          ? { 'X-Chapter-Lock-Token': ownedLockRef.current.token }
          : undefined,
        body: JSON.stringify({ chapterIds: newFlat.map(c => c.id) })
      });
      toast.success('Đã chuyển vị trí thẻ');
      await fetchChapterData(false);
      pushSync().catch(() => {});
    } catch (e: any) {
      toast.error(e.message || 'Lỗi sắp xếp thẻ');
    }
  };

  const handleReparentTab = async (targetId: string, newParentId: string | null) => {
    if (newParentId) {
      if (newParentId === targetId) {
        toast.error('Không thể chọn chính thẻ này làm thẻ cha');
        return;
      }
      // Circular check: newParentId must not be a descendant of targetId
      const getAllDescendantIds = (rootId: string): string[] => {
        const children = allChapters.filter(c => c.parentId === rootId);
        const childIds = children.map(c => c.id);
        const nestedIds = childIds.flatMap(cid => getAllDescendantIds(cid));
        return [...childIds, ...nestedIds];
      };
      const descendantIds = new Set(getAllDescendantIds(targetId));
      if (descendantIds.has(newParentId)) {
        toast.error('Quan hệ phân cấp vòng tròn không hợp lệ');
        return;
      }

      // Max 3 levels depth check (Google Docs allows depth 0, 1, 2)
      const tree = buildTabTree(allChapters);
      const findNode = (nodes: TabTreeNode[], id: string): TabTreeNode | null => {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children) {
            const found = findNode(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const parentNode = findNode(tree, newParentId);
      const targetNode = findNode(tree, targetId);
      if (!parentNode) {
        toast.error('Thẻ cha không tồn tại');
        return;
      }
      if (targetNode) {
        const parentDepth = parentNode.depth;
        const subtreeHeight = getSubtreeHeight(targetNode);
        if (parentDepth + 1 + subtreeHeight > 2) {
          toast.error('Google Docs giới hạn phân cấp tối đa 3 cấp thẻ');
          return;
        }
      }
    }

    try {
      await apiFetch(`/api/chapters/${targetId}`, {
        method: 'PATCH',
        headers: targetId === chapterId && ownedLockRef.current?.token
          ? { 'X-Chapter-Lock-Token': ownedLockRef.current.token }
          : undefined,
        body: JSON.stringify({ parentId: newParentId })
      });
      playSuccessSound();
      toast.success(newParentId ? 'Đã thụt lề làm thẻ con' : 'Đã nâng lên làm thẻ cha');
      await fetchChapterData(false);
      pushSync().catch(() => {});
    } catch (e: any) {
      toast.error(e.message || 'Lỗi thay đổi cấp độ thẻ');
    }
  };

  const handleUpdateTabEmoji = async (targetId: string, emoji: string | null) => {
    try {
      await apiFetch(`/api/chapters/${targetId}`, {
        method: 'PATCH',
        headers: targetId === chapterId && ownedLockRef.current?.token
          ? { 'X-Chapter-Lock-Token': ownedLockRef.current.token }
          : undefined,
        body: JSON.stringify({ emoji })
      });
      await fetchChapterData(false);
      pushSync().catch(() => {});
    } catch (e: any) {
      toast.error(e.message || 'Lỗi cập nhật biểu tượng');
    }
  };

  const currentWords = countWords(content);
  const wordGoalProgress = Math.min(100, Math.round((currentWords / targetWordCount) * 100));
  const canEdit = lockState === 'owned' || lockState === 'offline';

  if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Đang mở tài liệu...</div>;

  return (
    <MechKeyboardProvider>
      <div className="h-screen max-h-screen overflow-hidden bg-background flex flex-col">
        {/* Top Header */}
        <header className="border-b bg-card/95 backdrop-blur-sm shrink-0 z-30 shadow-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 max-w-[1600px] mx-auto w-full">
            {/* Back to Project Table of Contents */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 shrink-0" 
              title="Quay lại tổng quan dự án"
              onClick={async () => {
                if (content !== chapter?.content || title !== chapter?.title) {
                  await saveChapter(undefined, undefined, true).catch(() => {});
                }
                router.push(`/editor/${projectId}`);
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {/* Toggle Document Tabs Sidebar (Desktop) */}
            <Button
              variant={showTabsSidebar ? "secondary" : "ghost"}
              size="sm"
              className={`h-8 px-2.5 text-xs font-medium hidden md:flex items-center gap-1.5 ${showTabsSidebar ? 'bg-primary/15 text-primary border border-primary/25' : ''}`}
              onClick={toggleTabsSidebar}
              title={showTabsSidebar ? "Thu gọn Các thẻ trong tài liệu" : "Hiện Các thẻ trong tài liệu"}
            >
              <PanelLeft className="w-4 h-4 text-primary" />
              <span className="hidden lg:inline">Thẻ tài liệu</span>
            </Button>

            {/* Mobile Document Tabs Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={() => setMobileTabsOpen(true)}
              title="Xem Các thẻ trong tài liệu"
            >
              <FileText className="w-4 h-4 text-primary" />
            </Button>

            {/* Document / Tab Title Input */}
            <Input
              value={title}
              onChange={e => {
                if (!canEdit) return;
                isDirtyRef.current = true;
                hasUnsyncedDraftRef.current = true;
                setSaveStatus('dirty');
                lastTitleEditedTimeRef.current = Date.now();
                pauseAutoSync(chapterId);
                setTitle(e.target.value);
              }}
              onBlur={() => canEdit && saveChapter(undefined, title, true)}
              disabled={!canEdit}
              className="flex-1 min-w-0 font-semibold border-0 bg-transparent focus-visible:ring-1 text-xs sm:text-sm h-7 sm:h-8 truncate px-1"
              placeholder="Tên thẻ tài liệu..."
            />

            {/* Header Right Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
              {/* Word count & target progress (desktop) */}
              <div className="hidden xl:flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg text-xs">
                <span className="font-medium">{currentWords.toLocaleString()}</span>
                <span className="text-muted-foreground">/ {targetWordCount.toLocaleString()} từ</span>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${wordGoalProgress}%` }} />
                </div>
              </div>

              {saveStatus === 'uploading' || saving ? (
                <Badge variant="outline" className="animate-pulse text-[10px] sm:text-xs px-1.5 py-0 border-blue-400 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu máy chủ...
                </Badge>
              ) : saveStatus === 'server-acked' ? (
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] sm:text-xs hidden sm:flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Đã đồng bộ {lastSaved ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </Badge>
              ) : saveStatus === 'local-saved' ? (
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-[10px] sm:text-xs flex items-center gap-1" title="Bản nháp đã lưu trên thiết bị này, chưa đồng bộ lên máy chủ">
                  <Save className="w-3 h-3" /> Đã lưu máy này
                </Badge>
              ) : saveStatus === 'dirty' ? (
                <Badge variant="outline" className="text-muted-foreground text-[10px] sm:text-xs">
                  Chưa lưu
                </Badge>
              ) : saveStatus === 'conflict' ? (
                <Badge variant="outline" className="text-rose-600 border-rose-300 text-[10px] sm:text-xs">
                  Xung đột
                </Badge>
              ) : lastSaved ? (
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs hidden sm:flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Đã lưu {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </Badge>
              ) : null}

              {/* Quick AI Continue Button */}
              <MagicSparkles active={!aiLoading}>
                <Button
                  size="sm"
                  onClick={handleAIContinue}
                  disabled={aiLoading || !canEdit}
                  className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm shadow-purple-500/25 btn-interactive"
                  title="AI Viết tiếp văn bản"
                >
                  <Sparkles className={`w-3.5 h-3.5 sm:mr-1 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{aiLoading ? 'Đang viết...' : 'AI Viết tiếp'}</span>
                </Button>
              </MagicSparkles>

              {/* Clicky & Mechanical Keyboard Sound Providers */}
              <SoundToggleButton />
              <MechKeyboardToggle />

              {/* Fullscreen Button */}
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex" onClick={toggleFullscreen} title="Toàn màn hình">
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>

              {/* Export Direct Link */}
              <Link href={`/export/${projectId}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 sm:h-8 px-2 text-xs text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1"
                  title="Xuất bản sách (PDF, DOCX, EPUB)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden md:inline">Xuất bản</span>
                </Button>
              </Link>

              {/* Cloud Sync Button */}
              <SyncStatusButton compact />

              {/* Save Button */}
              <Button
                size="sm"
                className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs font-semibold btn-interactive shadow-xs"
                onClick={() => {
                  saveChapter(undefined, undefined, true);
                }}
                disabled={saving || !canEdit}
              >
                <Save className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Lưu</span>
              </Button>
            </div>
          </div>
        </header>

        {/* AI Suggestion Bar (if generated) */}
        {aiSuggestion && (
          <div className="bg-purple-500/10 border-b border-purple-500/20 p-2.5 px-4 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
              <span className="text-purple-700 dark:text-purple-300 truncate">
                AI gợi ý: {aiSuggestion.slice(0, 120)}...
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={insertAISuggestion}>
                Chèn vào bài
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAiSuggestion('')}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Connection & Lock Status Banners */}
        {connectionStatus === 'unconfigured' && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Chưa cấu hình API đồng bộ đám mây (NEXT_PUBLIC_API_URL). Hệ thống đang hoạt động ở chế độ cục bộ trên thiết bị này.</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void retryConnection()}>Kiểm tra lại</Button>
          </div>
        )}

        {connectionStatus === 'auth-required' && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <LockKeyhole className="w-4 h-4 shrink-0" />
              <span>Phiên đăng nhập đã hết hạn hoặc chưa đồng nhất giữa PC và điện thoại. Vui lòng đăng nhập lại để tiếp tục đồng bộ.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void retryConnection()}>Thử lại</Button>
              <Link href="/login">
                <Button size="sm" className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white">Đăng nhập</Button>
              </Link>
            </div>
          </div>
        )}

        {connectionStatus === 'server-error' && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Máy chủ đồng bộ đang gặp sự cố tạm thời (5xx). Bản nháp của bạn an toàn trên thiết bị này.</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void retryConnection()}>Thử lại</Button>
          </div>
        )}

        {connectionStatus === 'unreachable' && (
          <div className="bg-orange-500/15 border-b border-orange-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-orange-800 dark:text-orange-200">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Không thể kết nối máy chủ đồng bộ. Bản nháp được giữ an toàn trên thiết bị này và sẽ tự đồng bộ khi có mạng.</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void retryConnection()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Thử lại
            </Button>
          </div>
        )}

        {connectionStatus !== 'unconfigured' && connectionStatus !== 'auth-required' && connectionStatus !== 'server-error' && connectionStatus !== 'unreachable' && (
          <>
            {lockState === 'acquiring' && (
              <div className="bg-muted/80 border-b px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra kết nối và quyền chỉnh sửa chương...
              </div>
            )}
            {lockState === 'locked' && (
              <div className="bg-amber-500/15 border-b border-amber-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <LockKeyhole className="w-4 h-4 shrink-0" />
                  <span>Chương này đang được sửa trên <strong>{visibleLock?.deviceLabel || 'thiết bị khác'}</strong>. Bạn đang ở chế độ xem trực tiếp (tự động cập nhật).</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void tryAcquireLock(false)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Thử lại
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => {
                      if (window.confirm('Chuyển quyền sửa sang thiết bị này? Thiết bị cũ sẽ chuyển sang chỉ đọc và phần chưa lưu của nó sẽ được giữ thành thẻ khôi phục.')) {
                        void tryAcquireLock(true);
                      }
                    }}
                  >
                    Chuyển quyền sửa
                  </Button>
                </div>
              </div>
            )}
            {lockState === 'offline' && (
              <div className="bg-orange-500/15 border-b border-orange-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-orange-800 dark:text-orange-200">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>Đang viết ngoại tuyến. Bản nháp được giữ trên thiết bị này và chưa được đồng bộ.</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void retryConnection()}>Kết nối lại</Button>
              </div>
            )}
          </>
        )}

        {recoveryChapterId && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 p-2.5 px-4 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
            <span>Bản nháp ngoại tuyến / xung đột đã được bảo toàn trong một thẻ khôi phục riêng.</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push(`/editor/${projectId}/${recoveryChapterId}`)}>Mở thẻ khôi phục</Button>
          </div>
        )}

        {/* Duplicated Conflict Blocks Cleanup Banner */}
        {content && content.includes('Nội dung xung đột được lưu lại') && (
          <div className="bg-sky-500/15 border-b border-sky-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
              <span className="text-sky-800 dark:text-sky-200">
                Phát hiện khối nội dung xung đột bị nhân bản từ lần đồng bộ trước ({countWords(content).toLocaleString()} từ).
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-xs"
                disabled={!canEdit}
                onClick={() => {
                  const cleaned = deduplicateConflictBlocks(contentRef.current);
                  setContent(cleaned);
                  isDirtyRef.current = true;
                  lastContentEditedTimeRef.current = Date.now();
                  saveChapter(cleaned, undefined, true);
                  toast.success('Đã dọn dẹp các khối nhân bản và khôi phục văn bản chuẩn');
                }}
              >
                Dọn dẹp & Khôi phục bản gốc
              </Button>
            </div>
          </div>
        )}

        {/* Main Body Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Left Sidebar: Google Docs Document Tabs */}
          <DocumentTabsSidebar
            projectId={projectId}
            currentChapterId={chapterId}
            chapters={allChapters}
            headings={liveHeadings}
            isOpen={showTabsSidebar}
            onToggle={toggleTabsSidebar}
            onSelectTab={(selectedId) => navigateToChapter(selectedId, 'fade')}
            onJumpToHeading={(pos, text, index) => {
              window.dispatchEvent(new CustomEvent('novelist-jump-heading', { detail: { pos, text, index } }));
            }}
            onCreateTab={handleCreateTab}
            onRenameTab={handleRenameTab}
            onDeleteTab={handleDeleteTab}
            onDuplicateTab={handleDuplicateTab}
            onMoveTab={handleMoveTab}
            onReparentTab={handleReparentTab}
            onUpdateEmoji={handleUpdateTabEmoji}
            className="hidden md:flex"
          />

          {/* Central Editor Canvas */}
          <main className="flex-1 flex flex-col h-full overflow-hidden min-h-0 relative bg-background">
            <div
              key={chapterId}
              className={`w-full h-full flex flex-col min-h-0 transition-all duration-300 ease-out will-change-transform will-change-opacity ${
                isSwitching
                  ? switchDirection === 'next'
                    ? 'opacity-0 -translate-x-8 blur-xs pointer-events-none'
                    : switchDirection === 'prev'
                      ? 'opacity-0 translate-x-8 blur-xs pointer-events-none'
                      : 'opacity-0 scale-98 blur-xs pointer-events-none'
                  : 'opacity-100 translate-x-0 blur-none animate-in fade-in-50 duration-300'
              }`}
            >
              <EditorErrorBoundary
                content={content}
                editable={canEdit}
                onChange={(newContent) => {
                  if (!canEdit) return;
                  isDirtyRef.current = true;
                  hasUnsyncedDraftRef.current = true;
                  setSaveStatus('dirty');
                  lastKeystrokeTimeRef.current = Date.now();
                  lastContentEditedTimeRef.current = Date.now();
                  pauseAutoSync(chapterId);
                  setContent(newContent);
                }}
                placeholder="Bắt đầu viết những dòng văn bản đầu tiên cho thẻ này..."
              >
                <TiptapEditor
                  key={chapterId}
                  content={content}
                  onChange={(newContent) => {
                    if (!canEdit) return;
                    isDirtyRef.current = true;
                    hasUnsyncedDraftRef.current = true;
                    setSaveStatus('dirty');
                    lastKeystrokeTimeRef.current = Date.now();
                    lastContentEditedTimeRef.current = Date.now();
                    pauseAutoSync(chapterId);
                    setContent(newContent);
                  }}
                  editable={canEdit}
                  onHeadingsChange={setLiveHeadings}
                  placeholder="Bắt đầu viết những dòng văn bản đầu tiên cho thẻ này..."
                />
              </EditorErrorBoundary>
            </div>

            {/* Smooth Chapter Switch Transition Shimmer Overlay */}
            {isSwitching && (
              <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center animate-in fade-in duration-150">
                <div className="glass-card p-6 rounded-2xl border border-primary/25 shadow-2xl flex flex-col items-center gap-3.5 max-w-sm mx-4 text-center transform animate-in zoom-in-95 duration-200">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <FileText className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                    <GlowingDot className="absolute -top-1 -right-1" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span>Đang chuyển thẻ...</span>
                    </div>
                    <div className="text-base font-serif font-bold text-foreground mt-1 truncate max-w-[260px]">
                      {targetChapterInfo?.title || 'Thẻ tiếp theo'}
                    </div>
                  </div>
                  <div className="w-36 bg-muted rounded-full h-1.5 overflow-hidden mt-0.5">
                    <div className="bg-gradient-to-r from-primary to-indigo-500 h-full rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Mobile Document Tabs Drawer / Sheet */}
          {mobileTabsOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
              <div className="bg-card border-t rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250 overflow-hidden">
                <DocumentTabsSidebar
                  projectId={projectId}
                  currentChapterId={chapterId}
                  chapters={allChapters}
                  headings={liveHeadings}
                  isOpen={true}
                  onToggle={() => setMobileTabsOpen(false)}
                  onSelectTab={(selectedId) => {
                    setMobileTabsOpen(false);
                    navigateToChapter(selectedId, 'fade');
                  }}
                  onJumpToHeading={(pos, text, index) => {
                    setMobileTabsOpen(false);
                    window.dispatchEvent(new CustomEvent('novelist-jump-heading', { detail: { pos, text, index } }));
                  }}
                  onCreateTab={handleCreateTab}
                  onRenameTab={handleRenameTab}
                  onDeleteTab={handleDeleteTab}
                  onDuplicateTab={handleDuplicateTab}
                  onMoveTab={handleMoveTab}
                  onReparentTab={handleReparentTab}
                  onUpdateEmoji={handleUpdateTabEmoji}
                  className="w-full border-r-0 h-full max-h-[85vh]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </MechKeyboardProvider>
  );
}

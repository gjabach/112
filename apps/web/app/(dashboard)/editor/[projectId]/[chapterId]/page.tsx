'use client';
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  startTransition,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  apiFetch,
  apiFetchRemote,
  countWords,
  RemoteApiError,
} from '@/lib/utils';
import {
  advanceChapterLayoutRevision,
  getCachedChapters,
  readWorkspaceCache,
  setChapterLayoutPending,
} from '@/lib/workspace-cache';
import { createTabDropQueue } from '@/lib/tab-drop-queue';
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
  RefreshCw,
} from 'lucide-react';
import {
  DocumentTabsSidebar,
  buildTabTree,
  flattenTabTree,
  extractHeadingsFromContent,
  getSubtreeHeight,
  type TabTreeNode,
} from '@/components/editor/document-tabs-sidebar';
import { type TabDrop } from '@novelist/shared';
import type { EditorHeading } from '@/components/editor/tiptap-editor';
import { MagicSparkles, GlowingDot } from '@/components/vfx/magic-sparkles';
import { EditorErrorBoundary } from '@/components/editor/editor-boundary';
import {
  playChapterSwitchSound,
  playSuccessSound,
  playPopSound,
  playDeleteSound,
} from '@/lib/sound';
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
  registerSyncFlushHandler,
} from '@/lib/sync';
import { deduplicateConflictBlocks } from '@/lib/sync-core';
import { deleteChapterWithSync, archiveDraft } from '@/lib/delete-service';
import {
  CHAPTER_LOCK_HEARTBEAT_MS,
  acquireChapterLock,
  cacheRemoteChapter,
  clearPendingChapterDraft,
  getDeviceIdentity,
  getPendingChapterDraft,
  hasRemoteChapterApi,
  heartbeatChapterLock,
  persistLocalChapterDraft,
  probeApiCapabilities,
  releaseChapterLock,
  type ApiConnectionStatus,
  type ChapterVersion,
  type DeviceIdentity,
  type OwnedChapterLock,
  type PublicChapterLock,
} from '@/lib/chapter-lock';
import { ActionMenu } from '@/components/studio/action-menu';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from 'next-themes';
import {
  MechKeyboardProvider,
  MechKeyboardToggle,
} from '@/components/editor/mech-keyboard-provider';

const TiptapEditor = dynamic(
  () => import('@/components/editor/tiptap-editor').then((m) => m.TiptapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh] text-muted-foreground animate-pulse gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm">Đang tải trình soạn thảo văn bản...</span>
      </div>
    ),
  }
);

export default function ChapterEditorPage() {
  const { theme, setTheme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.projectId || '') as string;
  const chapterId = (params?.chapterId || '') as string;

  const [chapter, setChapter] = useState<any>(null);
  const [allChapters, setAllChaptersState] = useState<any[]>([]);
  const allChaptersRef = useRef<any[]>([]);
  const setAllChapters = useCallback(
    (next: any[] | ((current: any[]) => any[])) => {
      const chapters =
        typeof next === 'function' ? next(allChaptersRef.current) : next;
      allChaptersRef.current = chapters;
      setAllChaptersState(chapters);
    },
    []
  );
  const [isMovingTab, setIsMovingTab] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [liveHeadings, setLiveHeadings] = useState<EditorHeading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ApiConnectionStatus>('checking');
  const [lockState, setLockState] = useState<
    'acquiring' | 'owned' | 'locked' | 'offline'
  >('acquiring');
  const [saveStatus, setSaveStatus] = useState<
    | 'clean'
    | 'dirty'
    | 'local-saved'
    | 'uploading'
    | 'server-acked'
    | 'conflict'
    | 'failed'
  >('clean');
  const [visibleLock, setVisibleLock] = useState<PublicChapterLock | null>(
    null
  );

  // Protection refs against sync race conditions and text reversions
  const isDirtyRef = useRef(false);
  const isDeletingRef = useRef(false);
  const selfDeletedChapterRef = useRef<string | null>(null);
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
  const serverVersionRef = useRef<ChapterVersion>({
    updatedAt: 0,
    contentUpdatedAt: 0,
    titleUpdatedAt: 0,
  });
  const offlineBaseVersionRef = useRef<ChapterVersion | null>(null);
  const hasUnsyncedDraftRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const latestSaveRevisionRef = useRef(0);
  const queuedSaveCountRef = useRef(0);
  const lockAcquireInFlightRef = useRef(false);
  const saveChapterRef = useRef<
    (
      newContent?: string,
      newTitle?: string,
      isManual?: boolean
    ) => Promise<void>
  >(async () => {});
  const tryAcquireLockRef = useRef<(force?: boolean) => Promise<void>>(
    async () => {}
  );
  const transitionLockState = useCallback(
    (next: 'acquiring' | 'owned' | 'locked' | 'offline') => {
      lockStateRef.current = next;
      setLockState(next);
    },
    []
  );

  const tabDropQueue = useMemo(
    () =>
      createTabDropQueue<any>({
        getChapters: () => allChaptersRef.current,
        setChapters: setAllChapters,
        saveDrop: async (drop: TabDrop) => {
          const res = await apiFetch(
            `/api/projects/${projectId}/chapters/reorder`,
            {
              method: 'POST',
              headers: ownedLockRef.current?.token
                ? { 'X-Chapter-Lock-Token': ownedLockRef.current.token }
                : undefined,
              body: JSON.stringify({
                chapterIds: drop.chapterIds,
                move: { chapterId: drop.chapterId, parentId: drop.parentId },
              }),
            }
          );
          return Array.isArray(res?.chapters) ? res.chapters : undefined;
        },
        onPendingChange: (pending) => {
          setChapterLayoutPending(projectId, pending);
          setIsMovingTab(pending);
        },
        onRevisionChange: () => advanceChapterLayoutRevision(projectId),
        onError: (error, restored) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Không thể lưu vị trí thẻ.';
          toast.error(
            restored
              ? `${message} Đã khôi phục vị trí đã lưu gần nhất.`
              : message
          );
        },
        onIdle: () => {
          void pushSync().catch(() => {});
        },
      }),
    [projectId, setAllChapters]
  );

  useEffect(() => () => tabDropQueue.cancel(), [tabDropQueue]);

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
    setShowTabsSidebar((prev) => {
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
  const [switchDirection, setSwitchDirection] = useState<
    'next' | 'prev' | 'fade'
  >('fade');
  const [targetChapterInfo, setTargetChapterInfo] = useState<{
    title: string;
    orderIndex?: number;
  } | null>(null);

  const fetchChapterData = useCallback(
    async (isInitial = true) => {
      if (!chapterId || !projectId) return;
      const listRevision = tabDropQueue.getRefreshRevision();
      try {
        let res: any;
        let listRes: any;
        try {
          const fetcher = hasRemoteChapterApi() ? apiFetchRemote : apiFetch;
          [res, listRes] = await Promise.all([
            fetcher(`/api/chapters/${chapterId}`),
            fetcher(`/api/projects/${projectId}/chapters`),
          ]);
        } catch (error) {
          if (!isInitial) throw error;
          // Initial offline load may use the cached chapter, but background
          // refreshes must never silently substitute stale local data.
          [res, listRes] = await Promise.all([
            apiFetch(`/api/chapters/${chapterId}`),
            apiFetch(`/api/projects/${projectId}/chapters`),
          ]);
          if (hasRemoteChapterApi()) {
            transitionLockState('offline');
            protectChapterFromSync(chapterId);
          }
        }
        if (activeChapterIdRef.current !== chapterId) return;
        const tombstones = readWorkspaceCache('novelist_tombstones', {});
        if (tombstones[chapterId] || tombstones[projectId]) return;
        if (!res?.chapter) {
          isDirtyRef.current = false;
          toast.error('Thẻ này đã bị xóa hoặc không còn tồn tại', {
            id: 'chapter-deleted-error',
          });
          router.push(`/editor/${projectId}`);
          return;
        }
        if (res?.chapter) {
          const normalized = {
            ...res.chapter,
            contentUpdatedAt: Number(
              res.chapter.contentUpdatedAt || res.chapter.updatedAt || 0
            ),
            titleUpdatedAt: Number(
              res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0
            ),
          };
          if (hasRemoteChapterApi() && !hasUnsyncedDraftRef.current)
            cacheRemoteChapter(normalized);
          const rawContent = normalized.content;
          const safeContent =
            typeof rawContent === 'string'
              ? rawContent
              : rawContent
                ? JSON.stringify(rawContent)
                : '';
          const isProtectedEditor =
            lockStateRef.current === 'owned' ||
            lockStateRef.current === 'offline' ||
            lockStateRef.current === 'acquiring';
          const canApply =
            !isDirtyRef.current &&
            !savingRef.current &&
            (!isProtectedEditor ||
              !chapterRef.current ||
              chapterRef.current.id !== chapterId);
          if (
            (isInitial ||
              !chapterRef.current ||
              chapterRef.current.id !== chapterId) &&
            !isDirtyRef.current
          ) {
            setChapter(normalized);
            setTitle(normalized.title || 'Thẻ');
            setContent(safeContent);
            setLiveHeadings(extractHeadingsFromContent(safeContent));
            lastContentEditedTimeRef.current = normalized.contentUpdatedAt;
            lastTitleEditedTimeRef.current = normalized.titleUpdatedAt;
            serverVersionRef.current = {
              updatedAt: Number(normalized.updatedAt || 0),
              contentUpdatedAt: normalized.contentUpdatedAt,
              titleUpdatedAt: normalized.titleUpdatedAt,
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
              titleUpdatedAt: normalized.titleUpdatedAt,
            };
          }
        }
        tabDropQueue.refresh(getCachedChapters(projectId), listRevision);
      } catch (e: any) {
        toast.error(e.message || 'Lỗi tải thẻ');
      } finally {
        startTransition(() => {
          setLoading(false);
          setIsSwitching(false);
          setTargetChapterInfo(null);
        });
      }
    },
    [chapterId, projectId, router, tabDropQueue, transitionLockState]
  );

  const handleLockLost = useCallback(
    async (lock: PublicChapterLock | null) => {
      ownedLockRef.current = null;
      setVisibleLock(lock);
      transitionLockState('locked');
      isDirtyRef.current = false;
      hasUnsyncedDraftRef.current = false;
      clearPendingChapterDraft(chapterId);
      unprotectChapterFromSync(chapterId);
      await fetchChapterData(false);
    },
    [chapterId, fetchChapterData, transitionLockState]
  );

  const tryAcquireLock = useCallback(
    async (force = false) => {
      if (!chapterId) return;
      const probe = await probeApiCapabilities(force);
      setConnectionStatus(probe.status);
      if (!probe.available || !hasRemoteChapterApi()) {
        if (!offlineBaseVersionRef.current)
          offlineBaseVersionRef.current = { ...serverVersionRef.current };
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
          persistLocalChapterDraft(
            chapterId,
            contentRef.current,
            titleRef.current,
            serverVersionRef.current
          );
        }
        const result = await acquireChapterLock(
          chapterId,
          identity,
          force,
          force ? visibleLock?.version || '' : ''
        );
        if (activeChapterIdRef.current !== chapterId) {
          await releaseChapterLock(chapterId, result.lock.token);
          return;
        }
        const serverChangedWhileOffline =
          offlineBaseVersionRef.current &&
          (result.chapterVersion.contentUpdatedAt !==
            offlineBaseVersionRef.current.contentUpdatedAt ||
            result.chapterVersion.titleUpdatedAt !==
              offlineBaseVersionRef.current.titleUpdatedAt);

        ownedLockRef.current = result.lock;
        serverVersionRef.current = result.chapterVersion;
        offlineBaseVersionRef.current = null;
        setVisibleLock(null);
        setConnectionStatus('reachable');
        transitionLockState('owned');
        protectChapterFromSync(chapterId);
        if (hasUnsyncedDraftRef.current) {
          void saveChapterRef.current(
            contentRef.current,
            titleRef.current,
            true
          );
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
        } else if (
          error instanceof RemoteApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          setConnectionStatus('auth-required');
          if (!offlineBaseVersionRef.current)
            offlineBaseVersionRef.current = { ...serverVersionRef.current };
          transitionLockState('offline');
          protectChapterFromSync(chapterId);
        } else {
          const probeCheck = await probeApiCapabilities(false);
          setConnectionStatus(probeCheck.status);
          if (!offlineBaseVersionRef.current)
            offlineBaseVersionRef.current = { ...serverVersionRef.current };
          transitionLockState('offline');
          protectChapterFromSync(chapterId);
        }
      } finally {
        lockAcquireInFlightRef.current = false;
      }
    },
    [
      chapterId,
      fetchChapterData,
      handleLockLost,
      transitionLockState,
      visibleLock?.version,
    ]
  );
  tryAcquireLockRef.current = tryAcquireLock;

  const retryConnection = useCallback(async () => {
    toast.info('Đang kiểm tra kết nối...', { id: 'retry-conn' });
    const probe = await probeApiCapabilities(true);
    setConnectionStatus(probe.status);
    if (probe.status === 'unconfigured') {
      toast.warning(
        'Đồng bộ đám mây chưa được kết nối. Bản nháp vẫn lưu trên thiết bị.'
      );
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
    if (pendingDraft) {
      const restoredChapter = {
        id: chapterId,
        projectId,
        title: pendingDraft.title,
        content: pendingDraft.content,
        ...pendingDraft.baseVersion,
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
    void fetchChapterData(true);
    void tryAcquireLockRef.current(false);
    void pullSync(false).catch(() => {});

    const handleSync = async () => {
      const listRevision = tabDropQueue.getRefreshRevision();
      try {
        const fetcher = hasRemoteChapterApi() ? apiFetchRemote : apiFetch;
        const listRes = await fetcher(`/api/projects/${projectId}/chapters`);
        if (
          activeChapterIdRef.current === chapterId &&
          Array.isArray(listRes?.chapters)
        ) {
          tabDropQueue.refresh(getCachedChapters(projectId), listRevision);
        }
      } catch {}
      if (
        lockStateRef.current === 'locked' &&
        !isDirtyRef.current &&
        !savingRef.current
      ) {
        await fetchChapterData(false);
      }
    };
    const handleWorkspace = () => {
      if (activeChapterIdRef.current !== chapterId) return;
      const active = getCachedChapters(projectId);
      tabDropQueue.refresh(active);
      const tombstones = readWorkspaceCache('novelist_tombstones', {});
      if (!tombstones[chapterId] && !tombstones[projectId]) return;
      if (isDirtyRef.current || hasUnsyncedDraftRef.current) {
        archiveDraft(
          chapterId,
          contentRef.current,
          titleRef.current,
          'chapter_deleted'
        );
      }
      isDirtyRef.current = false;
      hasUnsyncedDraftRef.current = false;
      clearPendingChapterDraft(chapterId);
      unprotectChapterFromSync(chapterId);
      ownedLockRef.current = null;
      if (isDeletingRef.current || selfDeletedChapterRef.current === chapterId)
        return;
      router.replace(`/editor/${projectId}`);
    };
    const handleSyncUpdate = () => {
      handleWorkspace();
      if (!readWorkspaceCache('novelist_tombstones', {})[chapterId])
        void handleSync();
    };
    const handleOnline = async () => {
      if (lockStateRef.current === 'offline')
        await tryAcquireLockRef.current(false);
    };
    const unregisterFlush = registerSyncFlushHandler(chapterId, () => {
      if (
        (lockStateRef.current !== 'owned' &&
          lockStateRef.current !== 'offline') ||
        (!isDirtyRef.current && !hasUnsyncedDraftRef.current)
      )
        return;
      return saveChapterRef.current(contentRef.current, titleRef.current, true);
    });
    window.addEventListener('novelist-sync-updated', handleSyncUpdate);
    window.addEventListener('novelist-workspace-updated', handleWorkspace);
    window.addEventListener('novelist-chapters-deleted', handleWorkspace);
    window.addEventListener('online', handleOnline);
    return () => {
      unregisterFlush();
      window.removeEventListener('novelist-sync-updated', handleSyncUpdate);
      window.removeEventListener('novelist-workspace-updated', handleWorkspace);
      window.removeEventListener('novelist-chapters-deleted', handleWorkspace);
      window.removeEventListener('online', handleOnline);
      const token = ownedLockRef.current?.token;
      if (isDirtyRef.current || hasUnsyncedDraftRef.current) {
        persistLocalChapterDraft(
          chapterId,
          contentRef.current,
          titleRef.current,
          serverVersionRef.current
        );
      }
      if (token) void releaseChapterLock(chapterId, token);
      ownedLockRef.current = null;
      resumeAutoSync(chapterId);
      unprotectChapterFromSync(chapterId);
    };
  }, [
    chapterId,
    fetchChapterData,
    projectId,
    tabDropQueue,
    transitionLockState,
  ]);

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
          persistLocalChapterDraft(
            chapterId,
            contentRef.current,
            titleRef.current,
            serverVersionRef.current
          );
        }
        const result = await heartbeatChapterLock(chapterId, token);
        if (ownedLockRef.current)
          ownedLockRef.current.expiresAt = result.expiresAt;
      } catch (error: any) {
        if (error instanceof RemoteApiError && error.status === 423) {
          await handleLockLost(error.data?.lock || null);
        } else {
          if (!offlineBaseVersionRef.current)
            offlineBaseVersionRef.current = { ...serverVersionRef.current };
          transitionLockState('offline');
          hasUnsyncedDraftRef.current =
            hasUnsyncedDraftRef.current || isDirtyRef.current;
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
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      )
        return;
      if (
        isDirtyRef.current ||
        savingRef.current ||
        hasUnsyncedDraftRef.current
      )
        return;
      try {
        const fetcher = hasRemoteChapterApi() ? apiFetchRemote : apiFetch;
        const res = await fetcher(`/api/chapters/${chapterId}`);
        if (!res?.chapter) return;
        const normalized = {
          ...res.chapter,
          contentUpdatedAt: Number(
            res.chapter.contentUpdatedAt || res.chapter.updatedAt || 0
          ),
          titleUpdatedAt: Number(
            res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0
          ),
        };
        const hasNewerContent =
          normalized.contentUpdatedAt >
          serverVersionRef.current.contentUpdatedAt;
        const hasNewerTitle =
          normalized.titleUpdatedAt > serverVersionRef.current.titleUpdatedAt;
        if (hasNewerContent || hasNewerTitle) {
          const rawContent = normalized.content;
          const safeContent =
            typeof rawContent === 'string'
              ? rawContent
              : rawContent
                ? JSON.stringify(rawContent)
                : '';
          serverVersionRef.current = {
            updatedAt: Number(normalized.updatedAt || 0),
            contentUpdatedAt: normalized.contentUpdatedAt,
            titleUpdatedAt: normalized.titleUpdatedAt,
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

  const saveChapter = useCallback(
    async (newContent?: string, newTitle?: string, isManual = false) => {
      if (
        lockStateRef.current === 'locked' ||
        lockStateRef.current === 'acquiring'
      )
        return;
      const contentToSave =
        newContent !== undefined ? newContent : contentRef.current;
      const titleToSave = newTitle !== undefined ? newTitle : titleRef.current;
      const revision = ++latestSaveRevisionRef.current;
      hasUnsyncedDraftRef.current = true;
      persistLocalChapterDraft(
        chapterId,
        contentToSave,
        titleToSave,
        serverVersionRef.current
      );
      queuedSaveCountRef.current += 1;
      setSaving(true);
      setSaveStatus('uploading');

      const executeSave = async () => {
        try {
          const tombstones = readWorkspaceCache('novelist_tombstones', {});
          if (tombstones[chapterId] || tombstones[projectId]) return;
          // Coalesce snapshots which have not started yet. An in-flight older
          // request is still followed by the latest snapshot in this same queue.
          if (revision < latestSaveRevisionRef.current && !isManual) return;

          if (!hasRemoteChapterApi() || lockStateRef.current === 'offline') {
            if (!offlineBaseVersionRef.current)
              offlineBaseVersionRef.current = { ...serverVersionRef.current };
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
              baseTitleUpdatedAt: serverVersionRef.current.titleUpdatedAt,
            }),
          });

          const saved = response?.chapter || {};
          const nextVersion = {
            updatedAt: Number(saved.updatedAt || Date.now()),
            contentUpdatedAt: Number(
              saved.contentUpdatedAt || saved.updatedAt || Date.now()
            ),
            titleUpdatedAt: Number(
              saved.titleUpdatedAt || saved.updatedAt || Date.now()
            ),
          };
          serverVersionRef.current = nextVersion;
          lastContentEditedTimeRef.current = nextVersion.contentUpdatedAt;
          lastTitleEditedTimeRef.current = nextVersion.titleUpdatedAt;
          cacheRemoteChapter({
            ...saved,
            title: titleToSave,
            content: contentToSave,
            ...nextVersion,
          });

          if (revision === latestSaveRevisionRef.current) {
            const stillCurrent =
              contentRef.current === contentToSave &&
              titleRef.current === titleToSave;
            setChapter((prev: any) => ({
              ...prev,
              ...saved,
              title: titleToSave,
              content: contentToSave,
              ...nextVersion,
            }));
            setLastSaved(nextVersion.updatedAt);
            isDirtyRef.current = !stillCurrent;
            hasUnsyncedDraftRef.current = !stillCurrent;
            if (stillCurrent) {
              clearPendingChapterDraft(chapterId, {
                content: contentToSave,
                title: titleToSave,
              });
              setSaveStatus('server-acked');
              playSuccessSound();
            } else {
              setSaveStatus('dirty');
            }
          }

          if (isManual && revision === latestSaveRevisionRef.current)
            pushSync().catch(() => {});
          else triggerAutoPush(1000);
        } catch (error: any) {
          if (activeChapterIdRef.current !== chapterId) return;
          if (
            error instanceof RemoteApiError &&
            (error.status === 409 || error.status === 423)
          ) {
            setSaveStatus('conflict');
            if (error.status === 423)
              await handleLockLost(error.data?.lock || null);
            else {
              transitionLockState('locked');
              isDirtyRef.current = false;
              hasUnsyncedDraftRef.current = false;
              clearPendingChapterDraft(chapterId);
              unprotectChapterFromSync(chapterId);
              await fetchChapterData(false);
            }
          } else {
            if (!offlineBaseVersionRef.current)
              offlineBaseVersionRef.current = { ...serverVersionRef.current };
            transitionLockState('offline');
            setSaveStatus('local-saved');
            protectChapterFromSync(chapterId);
            toast.warning(
              'Mất kết nối. Bản nháp đang được lưu trên thiết bị này.',
              { id: 'editor-offline-save' }
            );
          }
        } finally {
          queuedSaveCountRef.current = Math.max(
            0,
            queuedSaveCountRef.current - 1
          );
          if (queuedSaveCountRef.current === 0) setSaving(false);
        }
      };

      const queued = saveChainRef.current.then(executeSave, executeSave);
      saveChainRef.current = queued;
      await queued;
    },
    [chapterId, fetchChapterData, handleLockLost, transitionLockState]
  );
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
    if (
      lockStateRef.current === 'locked' ||
      lockStateRef.current === 'acquiring'
    )
      return;
    if (!liveHeadings || liveHeadings.length === 0) return;
    const firstHeading = liveHeadings[0]?.text?.trim();
    if (!firstHeading) return;

    const isDefault = (t: string) => {
      const clean = (t || '').trim();
      return (
        !clean ||
        /^Thẻ(\s+\d+|\s+không\s+tên)?$/i.test(clean) ||
        /.*Thẻ con\s+\d+$/i.test(clean)
      );
    };

    if (isDefault(titleRef.current) && firstHeading !== titleRef.current) {
      setTitle(firstHeading);
      titleRef.current = firstHeading;
      isDirtyRef.current = true;
      setAllChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId ? { ...c, title: firstHeading } : c
        )
      );
    }
  }, [liveHeadings, chapterId]);

  // Global Ctrl+S / Cmd+S save shortcut
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (
          lockStateRef.current === 'locked' ||
          lockStateRef.current === 'acquiring'
        )
          return;
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
  const currentIndex = orderedChapters.findIndex((c) => c?.id === chapterId);
  const prevChapter =
    currentIndex > 0 ? orderedChapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex >= 0 && currentIndex < orderedChapters.length - 1
      ? orderedChapters[currentIndex + 1]
      : null;

  const navigateToChapter = (
    targetId: string,
    forcedDir?: 'next' | 'prev' | 'fade',
    skipSave = false
  ) => {
    if (!targetId || targetId === chapterId || isSwitching) return;

    const targetIdx = orderedChapters.findIndex((c) => c?.id === targetId);
    const targetChap = orderedChapters[targetIdx];
    const dir =
      forcedDir ||
      (targetIdx > currentIndex
        ? 'next'
        : targetIdx < currentIndex
          ? 'prev'
          : 'fade');

    playChapterSwitchSound();
    setIsSwitching(true);
    setSwitchDirection(dir);
    if (targetChap) {
      setTargetChapterInfo({
        title: targetChap.title,
        orderIndex: targetChap.orderIndex,
      });
    }

    if (
      !skipSave &&
      (content !== chapter?.content || title !== chapter?.title)
    ) {
      saveChapter(undefined, undefined, true).catch(() => {});
    }

    setTimeout(
      () => {
        router.push(`/editor/${projectId}/${targetId}`);
      },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120
    );
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
          setAiSuggestion((prev) => prev + chunk);
        },
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
      const current = content
        ? JSON.parse(content)
        : { type: 'doc', content: [] };
      const newContent = {
        ...current,
        content: [
          ...(current.content || []),
          {
            type: 'paragraph',
            content: [{ type: 'text', text: aiSuggestion }],
          },
        ],
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
  const handleCreateTab = async (
    tabTitle: string,
    parentId?: string | null
  ): Promise<string | void> => {
    if (allChapters.length >= 100) {
      toast.error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
      return;
    }
    try {
      const maxOrder =
        allChapters.length > 0
          ? Math.max(...allChapters.map((c) => c.orderIndex || 0))
          : 0;
      const res = await apiFetch(`/api/projects/${projectId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          title: tabTitle.trim(),
          orderIndex: maxOrder + 1,
          status: 'draft',
          parentId: parentId || null,
        }),
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
      if (
        lockStateRef.current !== 'owned' &&
        lockStateRef.current !== 'offline'
      ) {
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
      body: JSON.stringify({ title: trimmedTitle }),
    });
    await fetchChapterData(false);
    pushSync().catch(() => {});
  };

  const handleDeleteTab = async (targetId: string) => {
    if (allChapters.length <= 1) {
      toast.error('Tài liệu phải có tối thiểu 1 thẻ');
      return;
    }
    try {
      isDeletingRef.current = true;
      const lockToken =
        targetId === chapterId ? ownedLockRef.current?.token : undefined;
      const res = await deleteChapterWithSync({
        projectId: projectId as string,
        chapterId: targetId,
        lockToken,
      });
      if (!res.success) {
        toast.error(res.error || 'Lỗi xóa thẻ');
        return;
      }
      playDeleteSound();
      toast.success('Đã xóa thẻ');

      const deletedSet = new Set(res.deletedIds);
      if (deletedSet.has(chapterId)) {
        selfDeletedChapterRef.current = chapterId;
        // Navigate to adjacent tab without triggering save on the deleted chapter
        const currentIdx = orderedChapters.findIndex((c) => c.id === chapterId);
        const remaining = orderedChapters.filter((c) => !deletedSet.has(c.id));
        if (remaining.length > 0) {
          const adjacentIdx = Math.min(currentIdx, remaining.length - 1);
          const adjacentTab = remaining[Math.max(0, adjacentIdx)];
          navigateToChapter(
            adjacentTab.id,
            currentIdx < orderedChapters.length - 1 ? 'next' : 'prev',
            true
          );
        } else {
          router.push(`/editor/${projectId}`);
        }
      } else {
        await fetchChapterData(false);
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xóa thẻ');
    } finally {
      isDeletingRef.current = false;
    }
  };

  const handleDuplicateTab = async (targetId: string) => {
    if (allChapters.length >= 100) {
      toast.error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
      return;
    }
    try {
      const res = await apiFetch(`/api/chapters/${targetId}/duplicate`, {
        method: 'POST',
      });
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

  const handleDropTab = (drop: TabDrop): Promise<void> =>
    tabDropQueue.drop(drop);

  // Move tab strictly swaps among siblings of the same parent (Google Docs standard)
  const handleMoveTab = async (targetId: string, direction: 'up' | 'down') => {
    const target = allChapters.find((c) => c.id === targetId);
    if (!target) return;
    const parentId = target.parentId || null;

    // Get all siblings with same parentId in their current relative order
    const siblings = allChapters
      .filter((c) => (c.parentId || null) === parentId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const idx = siblings.findIndex((c) => c.id === targetId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    // Build hierarchical tree
    const tree = buildTabTree(allChapters);

    // Swap strictly within sibling nodes in the tree
    const swapSiblingInTree = (nodes: TabTreeNode[]): boolean => {
      const sIdx = nodes.findIndex((n) => n.id === targetId);
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
      await handleDropTab({
        chapterId: targetId,
        parentId,
        chapterIds: newFlat.map((c) => c.id),
      });
      toast.success('Đã chuyển vị trí thẻ');
    } catch {
      /* The shared drop handler reports the error. */
    }
  };

  const handleReparentTab = async (
    targetId: string,
    newParentId: string | null
  ) => {
    if (newParentId) {
      if (newParentId === targetId) {
        toast.error('Không thể chọn chính thẻ này làm thẻ cha');
        return;
      }
      // Circular check: newParentId must not be a descendant of targetId
      const getAllDescendantIds = (rootId: string): string[] => {
        const children = allChapters.filter((c) => c.parentId === rootId);
        const childIds = children.map((c) => c.id);
        const nestedIds = childIds.flatMap((cid) => getAllDescendantIds(cid));
        return [...childIds, ...nestedIds];
      };
      const descendantIds = new Set(getAllDescendantIds(targetId));
      if (descendantIds.has(newParentId)) {
        toast.error('Quan hệ phân cấp vòng tròn không hợp lệ');
        return;
      }

      // Max 3 levels depth check (Google Docs allows depth 0, 1, 2)
      const tree = buildTabTree(allChapters);
      const findNode = (
        nodes: TabTreeNode[],
        id: string
      ): TabTreeNode | null => {
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
          toast.error('Tài liệu chỉ hỗ trợ tối đa 3 cấp thẻ');
          return;
        }
      }
    }

    try {
      const tree = buildTabTree(allChapters);
      let moved: TabTreeNode | undefined;
      const detach = (nodes: TabTreeNode[]) => {
        const index = nodes.findIndex((n) => n.id === targetId);
        if (index >= 0) {
          [moved] = nodes.splice(index, 1);
          return;
        }
        for (const node of nodes) detach(node.children);
      };
      detach(tree);
      if (!moved) return;
      moved.parentId = newParentId;
      const parent = newParentId
        ? (flattenTabTree(tree).find((n) => n.id === newParentId) as
            TabTreeNode | undefined)
        : undefined;
      if (newParentId && !parent) throw new Error('Thẻ cha không tồn tại');
      (parent?.children || tree).push(moved);
      await handleDropTab({
        chapterId: targetId,
        parentId: newParentId,
        chapterIds: flattenTabTree(tree).map((c) => c.id),
      });
      playSuccessSound();
      toast.success(
        newParentId ? 'Đã thụt lề làm thẻ con' : 'Đã nâng lên làm thẻ cha'
      );
    } catch {
      /* The shared drop handler reports the error. */
    }
  };

  const handleUpdateTabEmoji = async (
    targetId: string,
    emoji: string | null
  ) => {
    try {
      await apiFetch(`/api/chapters/${targetId}`, {
        method: 'PATCH',
        headers:
          targetId === chapterId && ownedLockRef.current?.token
            ? { 'X-Chapter-Lock-Token': ownedLockRef.current.token }
            : undefined,
        body: JSON.stringify({ emoji }),
      });
      await fetchChapterData(false);
      pushSync().catch(() => {});
    } catch (e: any) {
      toast.error(e.message || 'Lỗi cập nhật biểu tượng');
    }
  };

  const currentWords = countWords(content);
  const wordGoalProgress = Math.min(
    100,
    Math.round((currentWords / targetWordCount) * 100)
  );
  const canEdit = lockState === 'owned' || lockState === 'offline';

  if (loading)
    return (
      <div className="p-8 animate-pulse text-muted-foreground">
        Đang mở tài liệu...
      </div>
    );

  return (
    <MechKeyboardProvider>
      <div className="studio-editor overflow-hidden bg-background flex flex-col">
        {/* Top Header */}
        <header className="shrink-0 border-b bg-card z-30">
          <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
            <Button
              variant="ghost"
              size="icon"
              title="Quay lại tổng quan tác phẩm"
              onClick={async () => {
                if (content !== chapter?.content || title !== chapter?.title)
                  await saveChapter(undefined, undefined, true).catch(() => {});
                router.push('/editor/' + projectId);
              }}
            >
              <ArrowLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={toggleTabsSidebar}
              title={showTabsSidebar ? 'Thu gọn mục lục' : 'Mở mục lục'}
              aria-expanded={showTabsSidebar}
            >
              <PanelLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileTabsOpen(true)}
              title="Mở mục lục chương"
            >
              <FileText />
            </Button>
            <Input
              value={title}
              onChange={(e) => {
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
              aria-label="Tên chương đang viết"
              className="flex-1 min-w-0 font-semibold border-0 bg-transparent focus-visible:ring-1 text-xs sm:text-sm h-7 sm:h-8 truncate px-1"
              placeholder="Tên thẻ tài liệu..."
            />
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAIContinue}
                disabled={aiLoading || !canEdit}
                title="AI viết tiếp"
              >
                <Sparkles className={aiLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">
                  {aiLoading ? 'Đang viết…' : 'AI viết tiếp'}
                </span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void saveChapter(undefined, undefined, true);
                }}
                disabled={saving || !canEdit}
                title="Lưu bản thảo"
              >
                <Save />
                <span className="hidden sm:inline">Lưu</span>
              </Button>
              <ActionMenu label="Công cụ phòng viết">
                <div
                  data-keep-menu
                  className="flex items-center justify-between gap-3 border-b px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">
                    Âm thanh
                  </span>
                  <SoundToggleButton />
                </div>
                <div
                  data-keep-menu
                  className="flex items-center justify-between gap-3 border-b px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">
                    Bàn phím
                  </span>
                  <MechKeyboardToggle />
                </div>
                <div data-keep-menu className="px-3 py-3">
                  <label
                    htmlFor="editor-theme"
                    className="mb-2 block text-xs text-muted-foreground"
                  >
                    Giao diện
                  </label>
                  <select
                    id="editor-theme"
                    className="w-full rounded-lg border px-2 py-2 text-sm"
                    value={theme || 'light'}
                    onChange={(event) => setTheme(event.target.value)}
                  >
                    <option value="light">Giấy ấm</option>
                    <option value="dark">Mực đêm</option>
                    <option value="sepia">Sepia</option>
                    <option value="system">Theo thiết bị</option>
                  </select>
                </div>
                <Button variant="ghost" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                  {isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                </Button>
                <Button variant="ghost" asChild>
                  <Link
                    href={
                      '/ai-assistant?projectId=' +
                      projectId +
                      '&chapterId=' +
                      chapterId
                    }
                  >
                    <Sparkles />
                    Trợ lý AI
                  </Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href={'/export/' + projectId}>
                    <Download />
                    Xuất bản thảo
                  </Link>
                </Button>
                <div data-keep-menu className="border-t p-2">
                  <SyncStatusButton compact />
                </div>
              </ActionMenu>
            </div>
          </div>
          <div className="flex min-h-8 items-center justify-between gap-3 border-t border-border/50 px-5 py-1 text-[11px]">
            <div role="status" aria-live="polite" className="min-w-0">
              {' '}
              {saveStatus === 'uploading' || saving ? (
                <Badge
                  variant="outline"
                  className="studio-info text-[11px] px-1.5 py-0 flex items-center gap-1"
                >
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu máy
                  chủ...
                </Badge>
              ) : saveStatus === 'server-acked' ? (
                <Badge
                  variant="outline"
                  className="studio-success text-[11px] flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>
                    Đã đồng bộ{' '}
                    {lastSaved
                      ? new Date(lastSaved).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                </Badge>
              ) : saveStatus === 'local-saved' ? (
                <Badge
                  variant="outline"
                  className="studio-warning text-[11px] flex items-center gap-1"
                  title="Bản nháp đã lưu trên thiết bị này, chưa đồng bộ lên máy chủ"
                >
                  <Save className="w-3 h-3" /> Đã lưu máy này
                </Badge>
              ) : saveStatus === 'dirty' ? (
                <Badge
                  variant="outline"
                  className="text-muted-foreground text-[11px]"
                >
                  Chưa lưu
                </Badge>
              ) : saveStatus === 'conflict' ? (
                <Badge variant="outline" className="studio-danger text-[11px]">
                  Xung đột
                </Badge>
              ) : lastSaved ? (
                <Badge
                  variant="outline"
                  className="studio-success text-[11px] flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>
                    Đã lưu{' '}
                    {new Date(lastSaved).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </Badge>
              ) : null}
            </div>
            <span className="shrink-0 text-muted-foreground">
              {currentWords.toLocaleString()} từ
              <span className="hidden sm:inline">
                {' '}
                · {wordGoalProgress}% mục tiêu
              </span>
            </span>
          </div>
        </header>

        {/* AI Suggestion Bar (if generated) */}
        {aiSuggestion && (
          <div className="bg-primary/5 border-b border-primary/20 p-2.5 px-4 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span className="text-primary truncate">
                AI gợi ý: {aiSuggestion.slice(0, 120)}...
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={insertAISuggestion}
              >
                Chèn vào bài
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setAiSuggestion('')}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Connection & Lock Status Banners */}
        {connectionStatus === 'unconfigured' && (
          <div className="studio-warning border-b p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                Đang viết trên thiết bị này. Đồng bộ đám mây chưa được kết nối.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => void retryConnection()}
            >
              Kiểm tra lại
            </Button>
          </div>
        )}

        {connectionStatus === 'auth-required' && (
          <div className="studio-danger border-b p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <LockKeyhole className="w-4 h-4 shrink-0" />
              <span>
                Phiên đăng nhập đã hết hạn hoặc chưa đồng nhất giữa PC và điện
                thoại. Vui lòng đăng nhập lại để tiếp tục đồng bộ.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => void retryConnection()}
              >
                Thử lại
              </Button>
              <Link href="/login">
                <Button
                  size="sm"
                  className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Đăng nhập
                </Button>
              </Link>
            </div>
          </div>
        )}

        {connectionStatus === 'server-error' && (
          <div className="studio-danger border-b p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                Dịch vụ đồng bộ tạm thời gián đoạn. Bản nháp của bạn an toàn
                trên thiết bị này.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => void retryConnection()}
            >
              Thử lại
            </Button>
          </div>
        )}

        {connectionStatus === 'unreachable' && (
          <div className="studio-warning border-b p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                Không thể kết nối máy chủ đồng bộ. Bản nháp được giữ an toàn
                trên thiết bị này và sẽ tự đồng bộ khi có mạng.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => void retryConnection()}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Thử lại
            </Button>
          </div>
        )}

        {connectionStatus !== 'unconfigured' &&
          connectionStatus !== 'auth-required' &&
          connectionStatus !== 'server-error' &&
          connectionStatus !== 'unreachable' && (
            <>
              {lockState === 'acquiring' && (
                <div className="bg-muted/80 border-b px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra kết
                  nối và quyền chỉnh sửa chương...
                </div>
              )}
              {lockState === 'locked' && (
                <div className="studio-warning border-b p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <LockKeyhole className="w-4 h-4 shrink-0" />
                    <span>
                      Chương này đang được sửa trên{' '}
                      <strong>
                        {visibleLock?.deviceLabel || 'thiết bị khác'}
                      </strong>
                      . Bạn đang ở chế độ xem trực tiếp (tự động cập nhật).
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => void tryAcquireLock(false)}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Thử lại
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Chuyển quyền sửa sang thiết bị này? Thiết bị cũ sẽ chuyển sang chế độ xem.'
                          )
                        ) {
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
                <div className="studio-warning border-b p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 shrink-0" />
                    <span>
                      Đang viết ngoại tuyến. Bản nháp được giữ trên thiết bị này
                      và chưa được đồng bộ.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => void retryConnection()}
                  >
                    Kết nối lại
                  </Button>
                </div>
              )}
            </>
          )}

        {/* Duplicated Conflict Blocks Cleanup Banner */}
        {content && content.includes('Nội dung xung đột được lưu lại') && (
          <div className="bg-sky-500/15 border-b border-sky-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
              <span className="text-sky-800 dark:text-sky-200">
                Phát hiện khối nội dung xung đột bị nhân bản từ lần đồng bộ
                trước ({countWords(content).toLocaleString()} từ).
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
                  toast.success(
                    'Đã dọn dẹp các khối nhân bản và khôi phục văn bản chuẩn'
                  );
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
              window.dispatchEvent(
                new CustomEvent('novelist-jump-heading', {
                  detail: { pos, text, index },
                })
              );
            }}
            onCreateTab={handleCreateTab}
            onRenameTab={handleRenameTab}
            onDeleteTab={handleDeleteTab}
            onDuplicateTab={handleDuplicateTab}
            onMoveTab={handleMoveTab}
            onDropTab={handleDropTab}
            isMovingTab={isMovingTab}
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
                    <div className="bg-primary h-full rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Mobile Document Tabs Drawer / Sheet */}
          <Dialog
            open={mobileTabsOpen}
            onOpenChange={setMobileTabsOpen}
            drawer
            className="bg-card"
          >
            <DialogTitle className="sr-only">Mục lục chương</DialogTitle>
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
                window.dispatchEvent(
                  new CustomEvent('novelist-jump-heading', {
                    detail: { pos, text, index },
                  })
                );
              }}
              onCreateTab={handleCreateTab}
              onRenameTab={handleRenameTab}
              onDeleteTab={handleDeleteTab}
              onDuplicateTab={handleDuplicateTab}
              onMoveTab={handleMoveTab}
              onDropTab={handleDropTab}
              isMovingTab={isMovingTab}
              onReparentTab={handleReparentTab}
              onUpdateEmoji={handleUpdateTabEmoji}
              className="w-full border-r-0 h-dvh max-h-dvh"
            />
          </Dialog>
        </div>
      </div>
    </MechKeyboardProvider>
  );
}

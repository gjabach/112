'use client';
import { useEffect, useState, useCallback, useRef, startTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch, countWords } from '@/lib/utils';
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
  AlertCircle
} from 'lucide-react';
import { DocumentTabsSidebar, buildTabTree, flattenTabTree, extractHeadingsFromContent, getSubtreeHeight, type TabTreeNode } from '@/components/editor/document-tabs-sidebar';
import type { EditorHeading } from '@/components/editor/tiptap-editor';
import { MagicSparkles, GlowingDot } from '@/components/vfx/magic-sparkles';
import { EditorErrorBoundary } from '@/components/editor/editor-boundary';
import { playChapterSwitchSound, playSuccessSound, playPopSound, playDeleteSound } from '@/lib/sound';
import { SoundToggleButton } from '@/components/layout/sound-provider';
import { SyncStatusButton } from '@/components/layout/sync-provider';
import { pushSync, pullSync, triggerAutoPush, pauseAutoSync, resumeAutoSync } from '@/lib/sync';
import { appendConflictContent, deduplicateConflictBlocks } from '@/lib/sync-core';
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
  const lastKeystrokeTimeRef = useRef<number>(0);
  const lastContentEditedTimeRef = useRef<number>(0);
  const lastTitleEditedTimeRef = useRef<number>(0);
  const [cloudConflict, setCloudConflict] = useState<any>(null);

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

  const fetchChapterData = async (isInitial = true) => {
    if (!chapterId || !projectId) return;
    try {
      const [res, listRes] = await Promise.all([
        apiFetch(`/api/chapters/${chapterId}`),
        apiFetch(`/api/projects/${projectId}/chapters`)
      ]);
      if (!res?.chapter) {
        isDirtyRef.current = false;
        toast.error('Thẻ này đã bị xóa hoặc không còn tồn tại', { id: 'chapter-deleted-error' });
        router.push(`/editor/${projectId}`);
        return;
      }
      if (res?.chapter) {
        if (isInitial || !chapterRef.current || chapterRef.current.id !== chapterId) {
          setChapter(res.chapter);
          setTitle(res.chapter.title || 'Thẻ');
          const rawContent = res.chapter.content;
          const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');
          setContent(safeContent);
          setLiveHeadings(extractHeadingsFromContent(safeContent));
          lastContentEditedTimeRef.current = Number(res.chapter.contentUpdatedAt || res.chapter.updatedAt || 0);
          lastTitleEditedTimeRef.current = Number(res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0);
          isDirtyRef.current = false;
        } else {
          // Background sync refresh:
          if (savingRef.current) return;
          const incomingUpdated = Number(res.chapter.updatedAt || res.chapter.createdAt || 0);
          const currentLocalUpdated = Number(chapterRef.current?.updatedAt || chapterRef.current?.createdAt || 0);

          if (incomingUpdated > currentLocalUpdated) {
            const rawContent = res.chapter.content;
            const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');

            if (!isDirtyRef.current) {
              setChapter(res.chapter);
              setTitle(res.chapter.title || 'Thẻ');
              setContent(safeContent);
              setLiveHeadings(extractHeadingsFromContent(safeContent));
              lastContentEditedTimeRef.current = Number(res.chapter.contentUpdatedAt || res.chapter.updatedAt || 0);
              lastTitleEditedTimeRef.current = Number(res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0);
              setCloudConflict(null);
              toast.info('Đã tự động cập nhật văn bản mới nhất từ đám mây', { id: 'sync-updated-notice', duration: 2500 });
            } else if (safeContent !== contentRef.current) {
              // User has active uncommitted typing in content: present conflict merge options
              setCloudConflict(res.chapter);
            } else if (res.chapter.title !== titleRef.current) {
              // Content is identical, but title was changed in cloud
              const userEditedTitle = titleRef.current !== (chapterRef.current?.title ?? '');
              if (!userEditedTitle) {
                // User only edited content, didn't edit title: safe to accept new title without touching editor
                setTitle(res.chapter.title || 'Thẻ');
                setChapter((prev: any) => ({ ...prev, title: res.chapter.title, titleUpdatedAt: res.chapter.titleUpdatedAt }));
                lastTitleEditedTimeRef.current = Number(res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0);
              } else {
                setCloudConflict(res.chapter);
              }
            }
          } else if (!isDirtyRef.current && contentRef.current === chapterRef.current?.content) {
            const rawContent = res.chapter.content;
            const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');
            if (safeContent !== contentRef.current) {
              setChapter(res.chapter);
              setTitle(res.chapter.title || 'Thẻ');
              setContent(safeContent);
              setLiveHeadings(extractHeadingsFromContent(safeContent));
              lastContentEditedTimeRef.current = Number(res.chapter.contentUpdatedAt || res.chapter.updatedAt || 0);
              lastTitleEditedTimeRef.current = Number(res.chapter.titleUpdatedAt || res.chapter.updatedAt || 0);
            }
          }
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
  };

  useEffect(() => {
    if (chapterId && projectId) {
      fetchChapterData(true);
      pullSync(true)
        .then(() => {
          if (!isDirtyRef.current && !savingRef.current) {
            fetchChapterData(true);
          }
        })
        .catch(() => {});
    }

    const handleSync = async () => {
      try {
        const listRes = await apiFetch(`/api/projects/${projectId}/chapters`);
        if (Array.isArray(listRes?.chapters)) {
          setAllChapters(listRes.chapters);
        }
      } catch {}
      if (!savingRef.current) {
        fetchChapterData(false);
      }
    };

    const handleFlushSync = () => {
      if (contentRef.current !== chapterRef.current?.content || titleRef.current !== chapterRef.current?.title) {
        saveChapter(contentRef.current, titleRef.current, true);
      }
    };

    window.addEventListener('novelist-sync-updated', handleSync);
    window.addEventListener('novelist-flush-save', handleFlushSync);
    return () => {
      resumeAutoSync();
      window.removeEventListener('novelist-sync-updated', handleSync);
      window.removeEventListener('novelist-flush-save', handleFlushSync);
    };
  }, [chapterId, projectId]);

  const saveChapter = useCallback(async (newContent?: string, newTitle?: string, isManual = false) => {
    const contentToSave = newContent !== undefined ? newContent : contentRef.current;
    const titleToSave = newTitle !== undefined ? newTitle : titleRef.current;
    setSaving(true);
    try {
      const now = Date.now();
      const contentChanged = contentToSave !== (chapterRef.current?.content ?? '');
      const titleChanged = titleToSave !== (chapterRef.current?.title ?? '');

      const contentUp = contentChanged
        ? (lastContentEditedTimeRef.current || now)
        : Number(chapterRef.current?.contentUpdatedAt || chapterRef.current?.updatedAt || now);

      const titleUp = titleChanged
        ? (lastTitleEditedTimeRef.current || now)
        : Number(chapterRef.current?.titleUpdatedAt || chapterRef.current?.updatedAt || now);

      await apiFetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: titleToSave,
          content: contentToSave,
          contentFormat: 'tiptap-json',
          updatedAt: now,
          contentUpdatedAt: contentUp,
          titleUpdatedAt: titleUp
        })
      });
      setLastSaved(now);
      lastContentEditedTimeRef.current = contentUp;
      lastTitleEditedTimeRef.current = titleUp;
      setChapter((prev: any) => ({
        ...prev,
        title: titleToSave,
        content: contentToSave,
        updatedAt: now,
        contentUpdatedAt: contentUp,
        titleUpdatedAt: titleUp
      }));
      isDirtyRef.current = false;
      setCloudConflict(null);
      resumeAutoSync();
      playSuccessSound();
      if (isManual) {
        pushSync().catch(() => {});
      } else {
        triggerAutoPush(1000);
      }
    } catch (e: any) {
      toast.error('Lỗi lưu: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [chapterId]);

  const handleMergeConflict = () => {
    if (!cloudConflict) return;
    const mergedText = appendConflictContent(contentRef.current, cloudConflict.content, 'Bản đám mây');
    const cloudTitleUpdated = Number(cloudConflict.titleUpdatedAt || cloudConflict.updatedAt || 0);
    const localTitleUpdated = Number(chapterRef.current?.titleUpdatedAt || chapterRef.current?.updatedAt || 0);
    const userEditedTitle = titleRef.current !== (chapterRef.current?.title ?? '');
    const resolvedTitle = (!userEditedTitle && cloudTitleUpdated > localTitleUpdated)
      ? (cloudConflict.title || titleRef.current)
      : titleRef.current;

    setContent(mergedText);
    if (resolvedTitle !== titleRef.current) {
      setTitle(resolvedTitle);
    }
    isDirtyRef.current = true;
    lastContentEditedTimeRef.current = Date.now();
    saveChapter(mergedText, resolvedTitle, true);
    setCloudConflict(null);
    toast.success('Đã hợp nhất nội dung từ đám mây vào văn bản hiện tại');
  };

  const handleKeepCurrent = () => {
    lastContentEditedTimeRef.current = Date.now();
    lastTitleEditedTimeRef.current = Date.now();
    saveChapter(contentRef.current, titleRef.current, true);
    setCloudConflict(null);
    toast.info('Đã giữ bản thảo hiện tại trên thiết bị này');
  };

  // Responsive auto-save: debounced 700ms after user stops typing
  useEffect(() => {
    if (!chapter) return;
    if (content === chapter.content && title === chapter.title) return;

    const timer = setTimeout(() => {
      saveChapter(undefined, undefined, false);
    }, 700);

    return () => clearTimeout(timer);
  }, [content, title, chapter, saveChapter]);

  // BUG 4 FIX: Auto-sync tab title from the first heading if title is currently default (e.g. "Thẻ 1", "Thẻ", "Thẻ con 1")
  useEffect(() => {
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
    await apiFetch(`/api/chapters/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle.trim() })
    });
    if (targetId === chapterId) {
      setTitle(newTitle.trim());
    }
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
        await apiFetch(`/api/chapters/${id}`, { method: 'DELETE' });
      }
      await apiFetch(`/api/chapters/${targetId}`, { method: 'DELETE' });
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
                isDirtyRef.current = true;
                lastTitleEditedTimeRef.current = Date.now();
                setTitle(e.target.value);
              }}
              onBlur={() => saveChapter(undefined, title, true)}
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

              {saving ? (
                <Badge variant="outline" className="animate-pulse text-[10px] sm:text-xs px-1.5 py-0">Đang lưu...</Badge>
              ) : lastSaved ? (
                <Badge variant="outline" className="text-green-600 dark:text-green-400 text-[10px] sm:text-xs hidden sm:flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {(() => {
                    try {
                      return new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch {
                      return 'Đã lưu';
                    }
                  })()}
                </Badge>
              ) : null}

              {/* Quick AI Continue Button */}
              <MagicSparkles active={!aiLoading}>
                <Button
                  size="sm"
                  onClick={handleAIContinue}
                  disabled={aiLoading}
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
                disabled={saving}
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

        {/* Cloud Conflict Warning Banner */}
        {cloudConflict && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-amber-800 dark:text-amber-200">
                <strong>Xung đột chỉnh sửa:</strong> Phát hiện bản cập nhật mới hơn từ đám mây trong khi bạn đang soạn thảo.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="default" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium" onClick={handleMergeConflict}>
                Xem & Hợp nhất
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10" onClick={handleKeepCurrent}>
                Giữ bản hiện tại
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
                onChange={(newContent) => {
                  isDirtyRef.current = true;
                  lastKeystrokeTimeRef.current = Date.now();
                  lastContentEditedTimeRef.current = Date.now();
                  pauseAutoSync();
                  setContent(newContent);
                }}
                placeholder="Bắt đầu viết những dòng văn bản đầu tiên cho thẻ này..."
              >
                <TiptapEditor
                  key={chapterId}
                  content={content}
                  onChange={(newContent) => {
                    isDirtyRef.current = true;
                    lastKeystrokeTimeRef.current = Date.now();
                    lastContentEditedTimeRef.current = Date.now();
                    pauseAutoSync();
                    setContent(newContent);
                  }}
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

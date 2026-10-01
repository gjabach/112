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
  BookOpen,
  Search,
  LayoutList
} from 'lucide-react';
import { WriterStudioDock } from '@/components/editor/writer-studio-dock';
import { QuickReferenceHud } from '@/components/editor/quick-reference-hud';
import { MagicSparkles, SparkleIcon, GlowingDot } from '@/components/vfx/magic-sparkles';
import { EditorErrorBoundary } from '@/components/editor/editor-boundary';
import { playChapterSwitchSound, playSuccessSound, playPopSound } from '@/lib/sound';
import { SoundToggleButton } from '@/components/layout/sound-provider';
import { SyncStatusButton } from '@/components/layout/sync-provider';
import { pushSync, pullSync, triggerAutoPush, pauseAutoSync, resumeAutoSync } from '@/lib/sync';
import { MechKeyboardProvider, MechKeyboardToggle } from '@/components/editor/mech-keyboard-provider';

const TiptapEditor = dynamic(
  () => import('@/components/editor/tiptap-editor').then((m) => m.TiptapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh] text-muted-foreground animate-pulse gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm">Đang tải trình soạn thảo thông minh...</span>
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

  const [showInspector, setShowInspector] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novelist_editor_inspector');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const toggleInspector = () => {
    setShowInspector(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('novelist_editor_inspector', String(next));
      }
      return next;
    });
  };
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(2000);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchDirection, setSwitchDirection] = useState<'next' | 'prev' | 'fade'>('fade');
  const [targetChapterInfo, setTargetChapterInfo] = useState<{ title: string; orderIndex?: number } | null>(null);
  const [showSpotlight, setShowSpotlight] = useState(false);

  const fetchChapterData = async (isInitial = true) => {
    if (!chapterId || !projectId) return;
    try {
      const [res, listRes] = await Promise.all([
        apiFetch(`/api/chapters/${chapterId}`),
        apiFetch(`/api/projects/${projectId}/chapters`)
      ]);
      if (!res?.chapter) {
        // Chapter was deleted or does not exist
        isDirtyRef.current = false;
        toast.error('Chương này đã bị xóa hoặc không còn tồn tại', { id: 'chapter-deleted-error' });
        router.push(`/editor/${projectId}`);
        return;
      }
      if (res?.chapter) {
        if (isInitial || !chapterRef.current || chapterRef.current.id !== chapterId) {
          setChapter(res.chapter);
          setTitle(res.chapter.title || 'Chương');
          const rawContent = res.chapter.content;
          const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');
          setContent(safeContent);
          isDirtyRef.current = false;
        } else {
          // Background sync refresh:
          if (savingRef.current) return;
          const incomingUpdated = Number(res.chapter.updatedAt || res.chapter.createdAt || 0);
          const currentLocalUpdated = Number(chapterRef.current?.updatedAt || chapterRef.current?.createdAt || 0);
          const isActivelyTypingNow = Date.now() - lastKeystrokeTimeRef.current < 5000;

          if (incomingUpdated > currentLocalUpdated && !isActivelyTypingNow) {
            const rawContent = res.chapter.content;
            const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');
            setChapter(res.chapter);
            setTitle(res.chapter.title || 'Chương');
            setContent(safeContent);
            isDirtyRef.current = false;
            toast.info('Đã tự động cập nhật văn bản mới nhất từ đám mây', { id: 'sync-updated-notice', duration: 2500 });
          } else if (!isDirtyRef.current && !isActivelyTypingNow && contentRef.current === chapterRef.current?.content) {
            const rawContent = res.chapter.content;
            const safeContent = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : '');
            if (safeContent !== contentRef.current) {
              setChapter(res.chapter);
              setTitle(res.chapter.title || 'Chương');
              setContent(safeContent);
            }
          }
        }
      }
      setAllChapters(Array.isArray(listRes?.chapters) ? listRes.chapters : []);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi tải chương');
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
          if (!isDirtyRef.current && !savingRef.current && Date.now() - lastKeystrokeTimeRef.current > 5000) {
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
      // Chỉ load lại content nếu KHÔNG đang chỉnh sửa
      if (!isDirtyRef.current && !savingRef.current && Date.now() - lastKeystrokeTimeRef.current > 5000) {
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
      await apiFetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: titleToSave,
          content: contentToSave,
          contentFormat: 'tiptap-json',
          updatedAt: now
        })
      });
      setLastSaved(now);
      setChapter((prev: any) => ({ ...prev, title: titleToSave, content: contentToSave, updatedAt: now }));
      isDirtyRef.current = false;
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

  // Responsive auto-save: debounced 700ms after user stops typing
  useEffect(() => {
    if (!chapter) return;
    if (content === chapter.content && title === chapter.title) return;

    const timer = setTimeout(() => {
      saveChapter(undefined, undefined, false);
    }, 700);

    return () => clearTimeout(timer);
  }, [content, title, chapter, saveChapter]);

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

  // Global shortcuts for Spotlight HUD (Ctrl+Shift+K) and Studio Dock toggle (Alt+D)
  useEffect(() => {
    const handleStudioShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowSpotlight(prev => !prev);
      }
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        toggleInspector();
      }
    };
    window.addEventListener('keydown', handleStudioShortcuts);
    return () => window.removeEventListener('keydown', handleStudioShortcuts);
  }, []);

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

  // Chapter Navigation
  const currentIndex = allChapters.findIndex(c => c?.id === chapterId);
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  const navigateToChapter = (targetId: string, forcedDir?: 'next' | 'prev' | 'fade') => {
    if (!targetId || targetId === chapterId || isSwitching) return;

    const targetIdx = allChapters.findIndex(c => c?.id === targetId);
    const targetChap = allChapters[targetIdx];
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
        message: content.slice(-2000) || 'Viết tiếp diễn biến cho chương này',
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

  const currentWords = countWords(content);
  const wordGoalProgress = Math.min(100, Math.round((currentWords / targetWordCount) * 100));

  if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Đang mở trình soạn thảo...</div>;

  const renderInspectorContent = () => (
    <WriterStudioDock
      projectId={projectId}
      chapterId={chapterId}
      chapter={chapter}
      setChapter={setChapter}
      currentWords={currentWords}
      contentLength={(content || '').length}
      targetWordCount={targetWordCount}
      setTargetWordCount={setTargetWordCount}
      aiLoading={aiLoading}
      aiSuggestion={aiSuggestion}
      setAiSuggestion={setAiSuggestion}
      handleAIContinue={handleAIContinue}
      insertAISuggestion={insertAISuggestion}
      onExecuteAIChat={async (customMessage, skill) => {
        setAiLoading(true);
        setAiSuggestion('');
        try {
          await executeAIChat({
            projectId,
            contextType: 'chapter',
            contextId: chapterId,
            message: content.slice(-1500) || customMessage,
            skill: skill || 'continue_writing',
            stream: true,
            onChunk: (chunk) => setAiSuggestion(prev => prev + chunk)
          });
        } catch (e: any) {
          toast.error(e.message || 'Lỗi AI');
        } finally {
          setAiLoading(false);
        }
      }}
      onOpenSpotlight={() => setShowSpotlight(true)}
      onInsertText={(text) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('novelist-insert-text', { detail: { text } }));
        }
      }}
    />
  );

  return (
    <MechKeyboardProvider>
    <div className="h-screen max-h-screen overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur-sm shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 max-w-[1600px] mx-auto w-full">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 shrink-0" 
            title="Quay lại mục lục"
            onClick={async () => {
              if (content !== chapter?.content || title !== chapter?.title) {
                await saveChapter(undefined, undefined, true).catch(() => {});
              }
              router.push(`/editor/${projectId}`);
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Chapter Quick Switcher */}
          <div className="flex items-center gap-0.5 border-r pr-1.5 mr-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!prevChapter || isSwitching}
              onClick={() => prevChapter && navigateToChapter(prevChapter.id, 'prev')}
              title={prevChapter ? `Chương trước: ${prevChapter?.title || ''}` : 'Đầu danh sách'}
            >
              {isSwitching && switchDirection === 'prev' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </Button>

            {allChapters.length > 0 && (
              <select
                className="h-7 text-xs border rounded bg-transparent px-1 max-w-[90px] sm:max-w-[140px] md:max-w-[180px] truncate"
                value={chapterId}
                disabled={isSwitching}
                onChange={e => navigateToChapter(e.target.value, 'fade')}
              >
                {allChapters.filter(Boolean).map((ch, idx) => (
                  <option key={ch.id || idx} value={ch.id || ''}>
                    {idx + 1}. {ch.title || 'Chương'}
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!nextChapter || isSwitching}
              onClick={() => nextChapter && navigateToChapter(nextChapter.id, 'next')}
              title={nextChapter ? `Chương sau: ${nextChapter?.title || ''}` : 'Cuối danh sách'}
            >
              {isSwitching && switchDirection === 'next' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          <Input
            value={title}
            onChange={e => {
              isDirtyRef.current = true;
              setTitle(e.target.value);
            }}
            onBlur={() => saveChapter(undefined, title, true)}
            className="flex-1 min-w-0 font-semibold border-0 bg-transparent focus-visible:ring-1 text-xs sm:text-sm h-7 sm:h-8 truncate px-1"
            placeholder="Tên chương..."
          />

          <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
            {/* Word count & target progress (desktop) */}
            <div className="hidden lg:flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg text-xs">
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

            {/* Quick AI Continue Button with Magic Sparkles */}
            <MagicSparkles active={!aiLoading}>
              <Button
                size="sm"
                onClick={handleAIContinue}
                disabled={aiLoading}
                className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm shadow-purple-500/25 btn-interactive"
                title="AI Viết tiếp"
              >
                <Sparkles className={`w-3.5 h-3.5 sm:mr-1 ${aiLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{aiLoading ? 'Đang viết...' : 'AI Viết tiếp'}</span>
              </Button>
            </MagicSparkles>

            {/* Clicky Sound Controller */}
            <SoundToggleButton />
            
            {/* Mechanical Keyboard Sound */}
            <MechKeyboardToggle />

            <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex" onClick={toggleFullscreen} title="Toàn màn hình">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            {/* Quick Spotlight Search Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 sm:h-8 px-2 text-xs text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1.5"
              onClick={() => setShowSpotlight(true)}
              title="Tra cứu nhanh Dàn ý, Nhân vật, Thế giới, Timeline (Ctrl+Shift+K)"
            >
              <Search className="w-3.5 h-3.5 text-primary" />
              <span className="hidden xl:inline">Tra cứu</span>
              <kbd className="hidden 2xl:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-muted border">Ctrl+Shift+K</kbd>
            </Button>

            {/* Lore Wiki Direct Access */}
            <Link href={`/wiki/${projectId}`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-8 px-2 text-xs text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-1"
                title="Mở Lore Wiki bách khoa thế giới & nhân vật"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Wiki</span>
              </Button>
            </Link>

            {/* Studio Dock Toggle */}
            <Button
              variant={showInspector ? "secondary" : "ghost"}
              size="sm"
              className={`h-7 sm:h-8 px-2 sm:px-2.5 text-xs font-medium ${showInspector ? 'bg-primary/15 text-primary border border-primary/30' : ''}`}
              onClick={toggleInspector}
              title={showInspector ? "Ẩn Studio Dock (Alt+D)" : "Hiện Studio Dock (Alt+D)"}
            >
              <LayoutList className="w-3.5 h-3.5 sm:mr-1 text-primary" />
              <span className="hidden sm:inline">Studio Dock</span>
            </Button>

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

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Editor Canvas with independently scrolling text and docked top toolbar */}
        <main className="flex-1 flex flex-col h-full overflow-hidden min-h-0 relative">
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
                pauseAutoSync();
                setContent(newContent);
              }}
              placeholder="Bắt đầu viết những dòng đầu tiên cho chương này..."
            >
              <TiptapEditor
                key={chapterId}
                content={content}
                onChange={(newContent) => {
                  isDirtyRef.current = true;
                  lastKeystrokeTimeRef.current = Date.now();
                  pauseAutoSync();
                  setContent(newContent);
                }}
                placeholder="Bắt đầu viết những dòng đầu tiên cho chương này..."
              />
            </EditorErrorBoundary>
          </div>

          {/* Smooth Chapter Switch Transition Shimmer Overlay */}
          {isSwitching && (
            <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center animate-in fade-in duration-150">
              <div className="glass-card p-6 rounded-2xl border border-primary/25 shadow-2xl flex flex-col items-center gap-3.5 max-w-sm mx-4 text-center transform animate-in zoom-in-95 duration-200">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                    <BookOpen className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <GlowingDot className="absolute -top-1 -right-1" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                    <span>Đang chuyển bản thảo...</span>
                  </div>
                  <div className="text-base font-serif font-bold text-foreground mt-1 truncate max-w-[260px]">
                    {targetChapterInfo?.title || 'Chương tiếp theo'}
                  </div>
                </div>
                <div className="w-36 bg-muted rounded-full h-1.5 overflow-hidden mt-0.5">
                  <div className="bg-gradient-to-r from-primary to-indigo-500 h-full rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Desktop Inspector Sidebar: Docked, full-height, independent scroll */}
        {showInspector && (
          <aside className="hidden md:flex w-84 lg:w-96 h-full border-l bg-card flex-col inspector overflow-y-auto shrink-0 z-10">
            {renderInspectorContent()}
          </aside>
        )}

        {/* Mobile Inspector Bottom Sheet */}
        {showInspector && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-card border-t rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250">
              <div className="flex items-center justify-between p-3.5 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <LayoutList className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Studio Dock</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShowInspector(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="overflow-y-auto flex-1 pb-6">
                {renderInspectorContent()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Reference Spotlight HUD */}
      <QuickReferenceHud
        isOpen={showSpotlight}
        onClose={() => setShowSpotlight(false)}
        projectId={projectId}
        onInsertText={(text) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('novelist-insert-text', { detail: { text } }));
          }
        }}
      />
    </div>
    </MechKeyboardProvider>
  );
}

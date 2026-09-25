'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { apiFetch, countWords } from '@/lib/utils';
import { executeAIChat } from '@/lib/ai';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Eye,
  EyeOff,
  Type,
  FileText,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  X
} from 'lucide-react';
import { useEditorStore } from '@/lib/store';

export default function ChapterEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const chapterId = params.chapterId as string;

  const [chapter, setChapter] = useState<any>(null);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(2000);

  const { focusMode, setFocusMode, typewriterMode, setTypewriterMode } = useEditorStore();

  const fetchChapterData = async () => {
    try {
      const [res, listRes] = await Promise.all([
        apiFetch(`/api/chapters/${chapterId}`),
        apiFetch(`/api/projects/${projectId}/chapters`)
      ]);
      setChapter(res.chapter);
      setTitle(res.chapter.title || 'Chương');
      setContent(res.chapter.content || '');
      setAllChapters(Array.isArray(listRes?.chapters) ? listRes.chapters : []);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi tải chương');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChapterData();
  }, [chapterId]);

  const saveChapter = useCallback(async (newContent?: string, newTitle?: string) => {
    const contentToSave = newContent !== undefined ? newContent : content;
    const titleToSave = newTitle !== undefined ? newTitle : title;
    setSaving(true);
    try {
      await apiFetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: titleToSave,
          content: contentToSave,
          contentFormat: 'tiptap-json'
        })
      });
      setLastSaved(Date.now());
      setChapter((prev: any) => ({ ...prev, title: titleToSave, content: contentToSave }));
    } catch (e: any) {
      toast.error('Lỗi lưu: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [content, title, chapterId]);

  // Auto-save every 5 seconds if changed
  useEffect(() => {
    if (!chapter) return;
    const interval = setInterval(() => {
      if (content !== chapter.content || title !== chapter.title) {
        saveChapter();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [content, title, chapter, saveChapter]);

  // Chapter Navigation
  const currentIndex = allChapters.findIndex(c => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  const navigateToChapter = async (targetId: string) => {
    if (content !== chapter?.content || title !== chapter?.title) {
      await saveChapter();
    }
    router.push(`/editor/${projectId}/${targetId}`);
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
      setContent(newContentStr);
      saveChapter(newContentStr);
      setAiSuggestion('');
      toast.success('Đã chèn nội dung AI vào văn bản');
    } catch {
      setContent(content + '\n\n' + aiSuggestion);
      setAiSuggestion('');
    }
  };

  if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Đang mở trình soạn thảo...</div>;

  const currentWords = countWords(content);
  const wordGoalProgress = Math.min(100, Math.round((currentWords / targetWordCount) * 100));

  const renderInspectorContent = () => (
    <>
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-primary" /> Thông số chương
        </h3>
        <div className="mt-3 space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Số từ</span>
            <span className="font-medium">{currentWords.toLocaleString()} từ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ký tự</span>
            <span>{content.length.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Thời gian đọc ước tính</span>
            <span>~{Math.max(1, Math.ceil(currentWords / 200))} phút</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground">Trạng thái</span>
            <select
              className="h-8 text-xs border rounded-lg bg-transparent px-2 font-medium"
              value={chapter?.status || 'draft'}
              onChange={async (e) => {
                const newStatus = e.target.value;
                setChapter({ ...chapter, status: newStatus });
                await apiFetch(`/api/chapters/${chapterId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ status: newStatus })
                });
                toast.success('Đã cập nhật trạng thái');
              }}
            >
              <option value="outline">Dàn ý (Outline)</option>
              <option value="draft">Bản nháp (Draft)</option>
              <option value="revised">Đã sửa (Revised)</option>
              <option value="completed">Hoàn thành (Done)</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Mục tiêu từ</span>
            <input
              type="number"
              value={targetWordCount}
              onChange={e => setTargetWordCount(Math.max(100, parseInt(e.target.value) || 2000))}
              className="w-24 h-7 text-xs text-right border rounded bg-transparent px-2"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-b">
        <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-primary" /> Trợ lý viết AI
        </h4>
        <div className="space-y-2">
          <Button size="sm" className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handleAIContinue} disabled={aiLoading}>
            {aiLoading ? 'Đang sáng tác...' : '✍️ Viết tiếp đoạn văn'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
              setAiLoading(true);
              setAiSuggestion('');
              try {
                await executeAIChat({
                  projectId,
                  contextType: 'chapter',
                  contextId: chapterId,
                  message: content.slice(-1000) || 'Viết lại đoạn văn này cho hấp dẫn và mượt mà hơn',
                  skill: 'rewrite',
                  stream: true,
                  onChunk: (chunk) => setAiSuggestion(prev => prev + chunk)
                });
              } catch (e: any) {
                toast.error(e.message || 'Lỗi AI');
              } finally {
                setAiLoading(false);
              }
            }}>
              🔄 Viết lại
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
              setAiLoading(true);
              setAiSuggestion('');
              try {
                await executeAIChat({
                  projectId,
                  contextType: 'chapter',
                  contextId: chapterId,
                  message: content.slice(-1500) || 'Phê bình chi tiết và nhận xét chương này',
                  skill: 'critique',
                  stream: true,
                  onChunk: (chunk) => setAiSuggestion(prev => prev + chunk)
                });
              } catch (e: any) {
                toast.error(e.message || 'Lỗi AI');
              } finally {
                setAiLoading(false);
              }
            }}>
              🔍 Phê bình
            </Button>
          </div>

          {aiSuggestion && (
            <div className="mt-3 border rounded-lg p-3 bg-muted/40">
              <div className="text-xs font-semibold mb-1.5 flex items-center gap-1 text-primary">
                <Sparkles className="w-3 h-3" /> Gợi ý từ AI:
              </div>
              <div className="text-xs whitespace-pre-wrap max-h-56 overflow-auto leading-relaxed text-foreground">
                {aiSuggestion}
              </div>
              <div className="flex gap-2 mt-3 pt-2 border-t">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={insertAISuggestion}>
                  Chèn vào văn bản
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAiSuggestion('')}>
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h4 className="font-medium mb-2 text-xs">Ghi chú tác giả</h4>
        <textarea
          className="w-full min-h-[90px] rounded-lg border border-input bg-transparent p-2 text-xs"
          placeholder="Ghi chú ý tưởng, việc cần làm cho chương này..."
          defaultValue={chapter?.notes || ''}
          onBlur={e => {
            apiFetch(`/api/chapters/${chapterId}`, {
              method: 'PATCH',
              body: JSON.stringify({ notes: e.target.value })
            });
          }}
        />
      </div>

      <div className="mt-auto p-4 border-t">
        <Link href={`/ai-assistant?projectId=${projectId}&chapterId=${chapterId}`}>
          <Button variant="outline" size="sm" className="w-full text-xs">
            <Sparkles className="w-3.5 h-3.5 mr-2 text-primary" /> Mở AI Assistant toàn diện
          </Button>
        </Link>
      </div>
    </>
  );

  return (
    <div className={`min-h-screen bg-background flex flex-col ${focusMode ? 'focus-mode' : ''}`}>
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 max-w-[1600px] mx-auto w-full">
          <Link href={`/editor/${projectId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Quay lại mục lục">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          {/* Chapter Quick Switcher */}
          <div className="flex items-center gap-0.5 border-r pr-1.5 mr-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!prevChapter}
              onClick={() => prevChapter && navigateToChapter(prevChapter.id)}
              title={prevChapter ? `Chương trước: ${prevChapter.title}` : 'Đầu danh sách'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            {allChapters.length > 0 && (
              <select
                className="h-7 text-xs border rounded bg-transparent px-1 max-w-[90px] sm:max-w-[140px] md:max-w-[180px] truncate"
                value={chapterId}
                onChange={e => navigateToChapter(e.target.value)}
              >
                {allChapters.map((ch, idx) => (
                  <option key={ch.id} value={ch.id}>
                    {idx + 1}. {ch.title}
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!nextChapter}
              onClick={() => nextChapter && navigateToChapter(nextChapter.id)}
              title={nextChapter ? `Chương sau: ${nextChapter.title}` : 'Cuối danh sách'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => saveChapter(undefined, title)}
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
                <CheckCircle2 className="w-3 h-3" /> {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            ) : null}

            {/* Quick AI Continue Button */}
            <Button
              size="sm"
              onClick={handleAIContinue}
              disabled={aiLoading}
              className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs"
              title="AI Viết tiếp"
            >
              <Sparkles className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">AI Viết tiếp</span>
            </Button>

            <Button variant="ghost" size="sm" className="h-8 text-xs hidden md:flex" onClick={() => setFocusMode(!focusMode)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> {focusMode ? 'Thoát Focus' : 'Focus'}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs hidden lg:flex" onClick={() => setTypewriterMode(!typewriterMode)}>
              <Type className="w-3.5 h-3.5 mr-1" /> Typewriter
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex" onClick={toggleFullscreen} title="Toàn màn hình">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            {/* Inspector Toggle */}
            <Button
              variant={showInspector ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => setShowInspector(!showInspector)}
              title="Thông tin chương"
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>

            {/* Save Button */}
            <Button size="sm" className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs" onClick={() => saveChapter()} disabled={saving}>
              <Save className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Lưu</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor Canvas */}
        <main className={`flex-1 overflow-auto ${typewriterMode ? 'flex items-center' : ''}`}>
          <div className={`w-full ${typewriterMode ? 'py-[40vh]' : ''}`}>
            <TiptapEditor content={content} onChange={setContent} placeholder="Bắt đầu viết những dòng đầu tiên cho chương này..." />
          </div>
        </main>

        {/* Desktop Inspector Sidebar */}
        {showInspector && (
          <aside className="hidden md:flex w-80 border-l bg-card flex-col inspector overflow-y-auto shrink-0">
            {renderInspectorContent()}
          </aside>
        )}

        {/* Mobile Inspector Bottom Sheet */}
        {showInspector && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-card border-t rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250">
              <div className="flex items-center justify-between p-3.5 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Thông tin chương</h3>
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
    </div>
  );
}

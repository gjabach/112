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
import { ArrowLeft, Save, Sparkles, Eye, EyeOff, Type, Clock, FileText } from 'lucide-react';
import { useEditorStore } from '@/lib/store';

export default function ChapterEditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const chapterId = params.chapterId as string;

  const [chapter, setChapter] = useState<any>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  const { focusMode, setFocusMode, typewriterMode, setTypewriterMode } = useEditorStore();

  useEffect(() => {
    fetchChapter();
  }, [chapterId]);

  const fetchChapter = async () => {
    try {
      const res = await apiFetch(`/api/chapters/${chapterId}`);
      setChapter(res.chapter);
      setTitle(res.chapter.title);
      setContent(res.chapter.content || '');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (e: any) {
      toast.error('Lỗi lưu: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [content, title, chapterId]);

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!chapter) return;
    const interval = setInterval(() => {
      if (content !== chapter.content || title !== chapter.title) {
        saveChapter();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [content, title, chapter, saveChapter]);

  const handleAIContinue = async () => {
    setAiLoading(true);
    setAiSuggestion('');
    try {
      await executeAIChat({
        projectId,
        contextType: 'chapter',
        contextId: chapterId,
        message: content.slice(-2000) || 'Viết tiếp chương này',
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
      // Simple append as paragraph
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
      toast.success('Đã chèn gợi ý AI');
    } catch {
      // fallback plain
      setContent(content + '\n\n' + aiSuggestion);
      setAiSuggestion('');
    }
  };

  if (loading) return <div className="p-8">Đang tải chương...</div>;

  return (
    <div className={`min-h-screen bg-background flex flex-col ${focusMode ? 'focus-mode' : ''}`}>
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3 p-3">
          <Link href={`/editor/${projectId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          
          <Input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => saveChapter(undefined, title)} className="max-w-xs font-semibold border-0 bg-transparent focus-visible:ring-1" />

          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="secondary" className="hidden md:flex">{countWords(content)} từ</Badge>
            {saving ? <Badge variant="outline" className="animate-pulse">Đang lưu...</Badge> : lastSaved ? <Badge variant="outline" className="text-green-600">Đã lưu {new Date(lastSaved).toLocaleTimeString()}</Badge> : null}
            
            <Button variant="ghost" size="sm" onClick={() => setFocusMode(!focusMode)}><Eye className="w-4 h-4 mr-1" /> {focusMode ? 'Thoát Focus' : 'Focus'}</Button>
            <Button variant="ghost" size="sm" onClick={() => setTypewriterMode(!typewriterMode)}><Type className="w-4 h-4 mr-1" /> Typewriter</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowInspector(!showInspector)}>{showInspector ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
            <Button size="sm" onClick={() => saveChapter()} disabled={saving}><Save className="w-4 h-4 mr-1" /> Lưu</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <main className={`flex-1 overflow-auto ${typewriterMode ? 'flex items-center' : ''}`}>
          <div className={`w-full ${typewriterMode ? 'py-[40vh]' : ''}`}>
            <TiptapEditor content={content} onChange={setContent} placeholder="Bắt đầu viết chương này..." />
          </div>
        </main>

        {/* Inspector */}
        {showInspector && (
          <aside className="w-80 border-l bg-card flex flex-col inspector">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Thông tin chương</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Số từ</span><span>{countWords(content)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ký tự</span><span>{content.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Thời gian đọc</span><span>{Math.ceil(countWords(content)/200)} phút</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái</span><Badge variant="secondary">{chapter?.status}</Badge></div>
              </div>
            </div>

            <div className="p-4 border-b">
              <h4 className="font-medium mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Assistant</h4>
              <div className="space-y-2">
                <Button size="sm" className="w-full" onClick={handleAIContinue} disabled={aiLoading}>
                  {aiLoading ? 'Đang viết...' : '✍️ Viết tiếp'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={async () => {
                    setAiLoading(true);
                    setAiSuggestion('');
                    try {
                      await executeAIChat({
                        projectId,
                        contextType: 'chapter',
                        contextId: chapterId,
                        message: content.slice(-1000) || 'Viết lại đoạn văn này',
                        skill: 'rewrite',
                        stream: true,
                        onChunk: (chunk) => setAiSuggestion(prev => prev + chunk)
                      });
                    } catch (e: any) { toast.error(e.message || 'Lỗi AI'); } finally { setAiLoading(false); }
                  }}>🔄 Viết lại</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    setAiLoading(true);
                    setAiSuggestion('');
                    try {
                      await executeAIChat({
                        projectId,
                        contextType: 'chapter',
                        contextId: chapterId,
                        message: content.slice(-1500) || 'Phê bình chương này',
                        skill: 'critique',
                        stream: true,
                        onChunk: (chunk) => setAiSuggestion(prev => prev + chunk)
                      });
                    } catch (e: any) { toast.error(e.message || 'Lỗi AI'); } finally { setAiLoading(false); }
                  }}>🔍 Phê bình</Button>
                </div>

                {aiSuggestion && (
                  <div className="mt-3 border rounded-lg p-3 bg-muted/50">
                    <div className="text-xs font-medium mb-2">Gợi ý AI:</div>
                    <div className="text-sm whitespace-pre-wrap max-h-64 overflow-auto">{aiSuggestion}</div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={insertAISuggestion}>Chèn vào</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAiSuggestion('')}>Đóng</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              <h4 className="font-medium mb-2">Ghi chú</h4>
              <textarea className="w-full min-h-[100px] rounded-lg border border-input bg-transparent p-2 text-sm" placeholder="Ghi chú cho chương này..." defaultValue={chapter?.notes || ''} onBlur={e => {
                apiFetch(`/api/chapters/${chapterId}`, { method: 'PATCH', body: JSON.stringify({ notes: e.target.value }) });
              }} />
            </div>

            <div className="mt-auto p-4 border-t">
              <Link href={`/ai-assistant?projectId=${projectId}&chapterId=${chapterId}`}><Button variant="outline" size="sm" className="w-full"><Sparkles className="w-4 h-4 mr-2" /> Mở AI Chat đầy đủ</Button></Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

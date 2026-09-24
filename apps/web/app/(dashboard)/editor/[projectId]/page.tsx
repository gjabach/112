'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Plus, FileText, GripVertical, Trash2, Edit3, Sparkles, Users, Map as MapIcon, LayoutList, Clock, Download, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useProjectStore } from '@/lib/store';

interface Chapter {
  id: string;
  title: string;
  wordCount: number;
  status: string;
  orderIndex: number;
}

export default function ProjectEditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [searchChapter, setSearchChapter] = useState('');
  const setCurrentProjectId = useProjectStore(s => s.setCurrentProjectId);

  const moveChapter = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    const newChapters = [...chapters];
    const temp = newChapters[index];
    newChapters[index] = newChapters[targetIndex];
    newChapters[targetIndex] = temp;
    setChapters(newChapters);

    try {
      await apiFetch(`/api/projects/${projectId}/chapters/reorder`, {
        method: 'POST',
        body: JSON.stringify({ chapterIds: newChapters.map(c => c.id) })
      });
      toast.success(`Đã chuyển vị trí chương`);
    } catch (e: any) {
      toast.error('Lỗi sắp xếp: ' + (e.message || ''));
      fetchData();
    }
  };

  useEffect(() => {
    setCurrentProjectId(projectId);
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [projRes, chapRes] = await Promise.all([
        apiFetch(`/api/projects/${projectId}`),
        apiFetch(`/api/projects/${projectId}/chapters`)
      ]);
      setProject(projRes.project);
      setChapters(chapRes.chapters);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const createChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      await apiFetch(`/api/projects/${projectId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          title: newChapterTitle,
          orderIndex: chapters.length,
          status: 'outline'
        })
      });
      setNewChapterTitle('');
      toast.success('Tạo chương mới');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteChapter = async (id: string) => {
    if (!confirm('Xóa chương này?')) return;
    try {
      await apiFetch(`/api/chapters/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="p-8 animate-pulse">Đang tải...</div>;
  if (!project) return <div className="p-8">Không tìm thấy dự án</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-4 p-4">
          <Link href="/projects"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">{project.title}</h1>
            <p className="text-xs text-muted-foreground">{project.wordCount?.toLocaleString() || 0} từ • {chapters.length} chương</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/outline/${projectId}`}><Button variant="outline" size="sm" className="bg-blue-50 dark:bg-blue-950/20 border-blue-200"><LayoutList className="w-4 h-4 mr-1" /> Dàn ý</Button></Link>
            <Link href={`/timeline/${projectId}`}><Button variant="outline" size="sm" className="bg-purple-50 dark:bg-purple-950/20 border-purple-200"><Clock className="w-4 h-4 mr-1" /> Timeline</Button></Link>
            <Link href={`/characters/${projectId}`}><Button variant="outline" size="sm"><Users className="w-4 h-4 mr-1" /> Nhân vật</Button></Link>
            <Link href={`/worldbuilding/${projectId}`}><Button variant="outline" size="sm"><MapIcon className="w-4 h-4 mr-1" /> Thế giới</Button></Link>
            <Link href={`/export/${projectId}`}><Button variant="outline" size="sm" className="bg-green-50 dark:bg-green-950/20 border-green-200"><Download className="w-4 h-4 mr-1" /> Xuất bản</Button></Link>
            <Link href={`/ai-assistant?projectId=${projectId}`}><Button size="sm"><Sparkles className="w-4 h-4 mr-1" /> AI</Button></Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar Chapters */}
        <aside className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Mục lục ({chapters.length})</h2>
              <span className="text-[11px] text-muted-foreground">{project.wordCount?.toLocaleString() || 0} từ</span>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Tên chương mới..." value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createChapter()} className="h-8 text-xs" />
              <Button size="sm" className="h-8 px-2.5" onClick={createChapter}><Plus className="w-4 h-4" /></Button>
            </div>
            {chapters.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Tìm chương..."
                  value={searchChapter}
                  onChange={e => setSearchChapter(e.target.value)}
                  className="pl-7 h-7 text-xs bg-muted/30"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-1">
            {chapters
              .filter(ch => (ch.title || '').toLowerCase().includes(searchChapter.toLowerCase()))
              .map((ch, idx) => (
                <div key={ch.id} className="group flex items-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveChapter(idx, 'up')}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Chuyển lên"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === chapters.length - 1}
                      onClick={() => moveChapter(idx, 'down')}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Chuyển xuống"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Link href={`/editor/${projectId}/${ch.id}`} className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">{ch.title}</div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{ch.status || 'draft'}</Badge>
                      <span className="text-[10px] text-muted-foreground">{ch.wordCount || 0} từ</span>
                    </div>
                  </Link>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/editor/${projectId}/${ch.id}`}>
                      <Button variant="ghost" size="icon" className="h-6 w-6"><Edit3 className="w-3 h-3" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteChapter(ch.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>

          <div className="p-3 border-t text-[11px] text-muted-foreground">
            <p>💡 Dùng mũi tên lên/xuống để đổi thứ tự chương. Click để bắt đầu viết.</p>
          </div>
        </aside>

        {/* Main Content - Project Overview */}
        <main className="flex-1 p-8 max-w-4xl">
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Tổng quan dự án</h2>
              <p className="text-muted-foreground">{project.description || 'Chưa có mô tả'}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-xl p-4">
                <div className="text-2xl font-bold">{project.wordCount?.toLocaleString() || 0}</div>
                <div className="text-sm text-muted-foreground">Tổng số từ</div>
                {project.wordCountGoal && <div className="mt-2 w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, (project.wordCount / project.wordCountGoal) * 100)}%` }}></div></div>}
              </div>
              <div className="border rounded-xl p-4">
                <div className="text-2xl font-bold">{chapters.length}</div>
                <div className="text-sm text-muted-foreground">Chương</div>
              </div>
              <div className="border rounded-xl p-4">
                <div className="text-2xl font-bold">{project.status}</div>
                <div className="text-sm text-muted-foreground">Trạng thái</div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Chọn một chương để bắt đầu viết</h3>
              <div className="grid gap-2">
                {chapters.map(ch => (
                  <Link key={ch.id} href={`/editor/${projectId}/${ch.id}`} className="border rounded-lg p-3 hover:border-primary/50 hover:bg-accent/50 transition-colors flex justify-between items-center">
                    <div>
                      <div className="font-medium">{ch.title}</div>
                      <div className="text-xs text-muted-foreground">{ch.wordCount} từ • {ch.status}</div>
                    </div>
                    <Button size="sm" variant="ghost">Viết →</Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

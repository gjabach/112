'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Plus, FileText, GripVertical, Trash2, Edit3, Sparkles, Users, Map as MapIcon, LayoutList, Clock, Download, ChevronUp, ChevronDown, Search, Check, X, Upload, Image as ImageIcon } from 'lucide-react';
import { useProjectStore } from '@/lib/store';
import { BookCoverArt } from '@/components/vfx/book-cover';
import { fireConfetti } from '@/components/vfx/confetti';
import { SparkleIcon } from '@/components/vfx/magic-sparkles';
import { playSuccessSound, playDeleteSound, playPopSound } from '@/lib/sound';
import { SoundToggleButton } from '@/components/layout/sound-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const genreLabels: Record<string, string> = {
  fantasy: 'Huyền Huyễn', scifi: 'Khoa Huyễn', romance: 'Lãng Mạn', mystery: 'Trinh Thám',
  thriller: 'Giật Gân', horror: 'Kinh Dị', literary: 'Văn Học', historical: 'Lịch Sử',
  blank: 'Chung'
};

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
  const [activeTab, setActiveTab] = useState<'chapters' | 'overview'>('chapters');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const setCurrentProjectId = useProjectStore(s => s.setCurrentProjectId);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    genre: 'fantasy',
    coverUrl: '',
    wordCountGoal: 50000,
    status: 'planning'
  });

  const openEditDialog = (proj: any) => {
    setEditForm({
      title: proj?.title || '',
      subtitle: proj?.subtitle || '',
      description: proj?.description || '',
      genre: proj?.genre || 'fantasy',
      coverUrl: proj?.coverUrl || '',
      wordCountGoal: proj?.wordCountGoal || 50000,
      status: proj?.status || 'planning'
    });
    setShowEditDialog(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn một tệp hình ảnh hợp lệ (PNG, JPG, WebP)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setEditForm(prev => ({ ...prev, coverUrl: compressed }));
          toast.success('Đã tải ảnh bìa lên thành công!');
        } else {
          setEditForm(prev => ({ ...prev, coverUrl: dataUrl }));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const saveProjectEdit = async () => {
    if (!editForm.title.trim()) {
      toast.error('Tên tác phẩm không được để trống');
      return;
    }
    setSavingEdit(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title.trim(),
          subtitle: editForm.subtitle.trim(),
          description: editForm.description.trim(),
          genre: editForm.genre,
          coverUrl: editForm.coverUrl.trim(),
          wordCountGoal: Number(editForm.wordCountGoal) || 50000,
          status: editForm.status
        })
      });
      toast.success('Đã cập nhật thông tin và ảnh bìa thành công!');
      setShowEditDialog(false);
      fetchData();
    } catch (e: any) {
      toast.error('Lỗi khi lưu: ' + (e.message || 'Không xác định'));
    } finally {
      setSavingEdit(false);
    }
  };

  const startRename = (ch: Chapter) => {
    setEditingChapterId(ch.id);
    setEditingTitle(ch.title || '');
  };

  const cancelRename = () => {
    setEditingChapterId(null);
    setEditingTitle('');
  };

  const saveChapterRename = async (chapterId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      toast.error('Tên chương không được để trống');
      return;
    }
    const prevChapters = [...chapters];
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: trimmed } : c));
    setEditingChapterId(null);

    try {
      await apiFetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: trimmed })
      });
      playSuccessSound();
      toast.success('Đã cập nhật tên chương thành công');
      fetchData();
    } catch (e: any) {
      toast.error('Lỗi khi sửa tên chương: ' + (e.message || ''));
      setChapters(prevChapters);
    }
  };

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
    const handleSync = () => fetchData();
    window.addEventListener('novelist-sync-updated', handleSync);
    return () => window.removeEventListener('novelist-sync-updated', handleSync);
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
      playSuccessSound();
      toast.success('Tạo chương mới thành công');
      fireConfetti({ type: 'stardust', particleCount: 20 });
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteChapter = async (id: string) => {
    if (!confirm('Xóa chương này?')) return;
    try {
      await apiFetch(`/api/chapters/${id}`, { method: 'DELETE' });
      playDeleteSound();
      toast.success('Đã xóa chương');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="p-8 animate-pulse text-muted-foreground text-sm">Đang tải dự án...</div>;
  if (!project) return <div className="p-8 text-sm">Không tìm thấy dự án</div>;

  const goalProgress = project.wordCountGoal && project.wordCount
    ? Math.min(100, Math.round(((project.wordCount || 0) / project.wordCountGoal) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="border-b bg-card sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5 p-3 sm:p-4 max-w-7xl mx-auto w-full">
          <Link href="/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <div className="flex-1 min-w-0 pr-1">
            <h1 className="font-bold text-base sm:text-lg truncate leading-tight" title={project.title}>
              {project.title}
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
              {(project.wordCount || 0).toLocaleString()} từ • {chapters.length} chương
            </p>
          </div>

          {/* Mobile Action Buttons */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <SoundToggleButton />
            <Button
              size="sm"
              onClick={() => {
                const title = prompt('Nhập tên chương mới:');
                if (title?.trim()) {
                  setNewChapterTitle(title.trim());
                  apiFetch(`/api/projects/${projectId}/chapters`, {
                    method: 'POST',
                    body: JSON.stringify({
                      title: title.trim(),
                      orderIndex: chapters.length,
                      status: 'outline'
                    })
                  }).then(() => {
                    playSuccessSound();
                    toast.success('Đã tạo chương mới');
                    fetchData();
                  });
                }
              }}
              className="h-8 px-2.5 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Chương</span>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-8 w-8 p-0">
              <Link href={`/ai-assistant?projectId=${projectId}`} title="Trợ lý AI">
                <Sparkles className="w-4 h-4 text-primary" />
              </Link>
            </Button>
          </div>

          {/* Desktop Navigation Buttons */}
          <div className="hidden md:flex gap-2 items-center shrink-0">
            <SoundToggleButton />
            <Link href={`/outline/${projectId}`}>
              <Button variant="outline" size="sm" className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50">
                <LayoutList className="w-4 h-4 mr-1 text-blue-500" /> Dàn ý
              </Button>
            </Link>
            <Link href={`/timeline/${projectId}`}>
              <Button variant="outline" size="sm" className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/50">
                <Clock className="w-4 h-4 mr-1 text-purple-500" /> Timeline
              </Button>
            </Link>
            <Link href={`/characters/${projectId}`}>
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-1 text-emerald-500" /> Nhân vật
              </Button>
            </Link>
            <Link href={`/worldbuilding/${projectId}`}>
              <Button variant="outline" size="sm">
                <MapIcon className="w-4 h-4 mr-1 text-amber-500" /> Thế giới
              </Button>
            </Link>
            <Link href={`/export/${projectId}`}>
              <Button variant="outline" size="sm" className="bg-green-50/50 dark:bg-green-950/20 border-green-200/50">
                <Download className="w-4 h-4 mr-1 text-green-500" /> Xuất bản
              </Button>
            </Link>
            <Link href={`/ai-assistant?projectId=${projectId}`}>
              <Button size="sm">
                <Sparkles className="w-4 h-4 mr-1" /> AI Trợ lý
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Swipeable Feature Tool Bar */}
        <div className="md:hidden flex items-center gap-1.5 px-3 py-2 border-t bg-muted/20 overflow-x-auto no-scrollbar scroll-smooth">
          <Link
            href={`/ai-assistant?projectId=${projectId}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>AI Trợ lý</span>
          </Link>
          <Link
            href={`/outline/${projectId}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card hover:bg-accent border text-foreground shadow-xs"
          >
            <LayoutList className="w-3.5 h-3.5 text-blue-500" />
            <span>Dàn ý</span>
          </Link>
          <Link
            href={`/characters/${projectId}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card hover:bg-accent border text-foreground shadow-xs"
          >
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span>Nhân vật</span>
          </Link>
          <Link
            href={`/worldbuilding/${projectId}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card hover:bg-accent border text-foreground shadow-xs"
          >
            <MapIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>Thế giới</span>
          </Link>
          <Link
            href={`/timeline/${projectId}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card hover:bg-accent border text-foreground shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <span>Timeline</span>
          </Link>
          <Link
            href={`/export/${projectId}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card hover:bg-accent border text-foreground shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-rose-500" />
            <span>Xuất bản</span>
          </Link>
        </div>

        {/* Mobile Segmented Tab Selector */}
        <div className="md:hidden px-3 py-1.5 border-t bg-card">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('chapters');
                playPopSound();
              }}
              className={`py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'chapters'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Mục lục ({chapters.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview');
                playPopSound();
              }}
              className={`py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Tổng quan dự án</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col md:flex-row min-w-0 overflow-hidden">
        {/* Chapters Section (Full-width on mobile when activeTab=chapters, sidebar on desktop) */}
        <aside
          className={`w-full md:w-80 md:border-r bg-card flex flex-col shrink-0 ${
            activeTab === 'chapters' ? 'flex flex-1 min-h-0' : 'hidden md:flex'
          }`}
        >
          <div className="p-3 sm:p-4 border-b space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Danh sách chương ({chapters.length})</h2>
              <span className="text-[11px] text-muted-foreground font-mono">
                {(project.wordCount || 0).toLocaleString()} từ
              </span>
            </div>

            {/* Word goal progress indicator */}
            {project.wordCountGoal ? (
              <div className="p-2.5 bg-muted/40 rounded-lg border space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Mục tiêu:</span>
                  <span className="font-semibold text-primary">
                    {goalProgress}% ({(project.wordCount || 0).toLocaleString()} / {project.wordCountGoal.toLocaleString()} từ)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {/* Create chapter input */}
            <div className="flex gap-2">
              <Input
                placeholder="Tên chương mới..."
                value={newChapterTitle}
                onChange={e => setNewChapterTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createChapter()}
                className="h-9 text-xs"
              />
              <Button size="sm" className="h-9 px-3 shrink-0" onClick={createChapter}>
                <Plus className="w-4 h-4 mr-1" />
                <span>Thêm</span>
              </Button>
            </div>

            {/* Search filter */}
            {chapters.length > 3 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm chương..."
                  value={searchChapter}
                  onChange={e => setSearchChapter(e.target.value)}
                  className="pl-8 h-8 text-xs bg-muted/30"
                />
              </div>
            )}
          </div>

          {/* Chapters list */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5">
            {chapters.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Chưa có chương nào. Nhập tên và bấm "Thêm" để bắt đầu viết.
              </div>
            ) : (
              chapters
                .filter(ch => (ch.title || '').toLowerCase().includes(searchChapter.toLowerCase()))
                .map((ch, idx) => (
                  <div
                    key={ch.id}
                    className="group flex items-center gap-2 p-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:bg-accent/40 transition-all shadow-2xs"
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveChapter(idx, 'up')}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        title="Chuyển lên"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === chapters.length - 1}
                        onClick={() => moveChapter(idx, 'down')}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        title="Chuyển xuống"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />

                    {/* Chapter details link or inline rename */}
                    {editingChapterId === ch.id ? (
                      <div className="flex-1 min-w-0 flex items-center gap-1.5 py-0.5" onClick={e => e.stopPropagation()}>
                        <Input
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveChapterRename(ch.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          className="h-8 text-xs font-medium py-1 px-2.5 flex-1 bg-background border-primary/50 focus-visible:ring-1"
                          autoFocus
                          placeholder="Nhập tên chương..."
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 shrink-0"
                          onClick={() => saveChapterRename(ch.id)}
                          title="Lưu tên chương (Enter)"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={cancelRename}
                          title="Hủy (Esc)"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Link href={`/editor/${projectId}/${ch.id}`} className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            {ch.title}
                          </div>
                          <div className="flex gap-2 items-center mt-0.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              {ch.status || 'draft'}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {(ch.wordCount || 0).toLocaleString()} từ
                            </span>
                          </div>
                        </Link>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startRename(ch);
                            }}
                            title="Sửa tên chương"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => deleteChapter(ch.id)}
                            title="Xóa chương"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
            )}
          </div>

          <div className="p-3 border-t text-[11px] text-muted-foreground hidden md:block">
            <p>💡 Click vào chương để mở trình soạn thảo chuyên dụng.</p>
          </div>
        </aside>

        {/* Project Overview (Full-width on mobile when activeTab=overview, right panel on desktop) */}
        <main
          className={`flex-1 p-4 sm:p-6 md:p-8 max-w-4xl overflow-y-auto ${
            activeTab === 'overview' ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="space-y-6">
            {/* Book showcase with 3D cover */}
            <div className="flex flex-col sm:flex-row gap-5 items-start glass-card p-5 rounded-2xl border border-border/70">
              <BookCoverArt
                title={project.title}
                genre={project.genre}
                coverUrl={project.coverUrl}
                wordCount={project.wordCount}
                size="md"
                className="shadow-xl shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-2 py-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary font-medium">
                      {genreLabels[project.genre] || project.genre || 'Huyền Huyễn'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {project.status || 'planning'}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-border/80 hover:border-primary/50"
                    onClick={() => openEditDialog(project)}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-primary" />
                    <span>Sửa thông tin & ảnh bìa</span>
                  </Button>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground">
                  {project.title}
                </h2>
                {project.subtitle ? (
                  <p className="text-xs text-muted-foreground italic -mt-1">{project.subtitle}</p>
                ) : null}
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {project.description || 'Chưa có mô tả cho tiểu thuyết này.'}
                </p>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="glass-card glow-card border border-border/70 rounded-2xl p-4 shadow-xs">
                <div className="text-2xl font-bold font-mono">{(project.wordCount || 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Tổng số từ</div>
                {project.wordCountGoal ? (
                  <div className="mt-2.5 w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${goalProgress}%` }} />
                  </div>
                ) : null}
              </div>

              <div className="glass-card glow-card border border-border/70 rounded-2xl p-4 shadow-xs">
                <div className="text-2xl font-bold font-mono">{chapters.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Tổng số chương</div>
              </div>

              <div className="glass-card glow-card border border-border/70 rounded-2xl p-4 shadow-xs">
                <div className="text-2xl font-bold capitalize">{project.status}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Trạng thái sáng tác</div>
              </div>
            </div>

            {/* Quick chapter access section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm sm:text-base">Mục lục bản thảo</h3>
                <span className="text-xs text-muted-foreground">Chọn chương để bắt đầu viết</span>
              </div>

              <div className="grid gap-2">
                {chapters.map(ch => (
                  <Link
                    key={ch.id}
                    href={`/editor/${projectId}/${ch.id}`}
                    className="border rounded-xl p-3.5 hover:border-primary/50 hover:bg-accent/40 transition-colors flex justify-between items-center bg-card shadow-2xs"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-medium text-sm truncate">{ch.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(ch.wordCount || 0).toLocaleString()} từ • {ch.status || 'draft'}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 h-8 text-xs text-primary font-medium">
                      Viết →
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              <span>Chỉnh sửa thông tin tác phẩm</span>
            </DialogTitle>
            <DialogDescription>
              Tùy chỉnh tên tác phẩm, ảnh bìa, tóm tắt nội dung và thể loại.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Live Cover Preview & Upload Row */}
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start p-3.5 bg-muted/30 border border-border/70 rounded-xl">
              <div className="shrink-0 flex flex-col items-center">
                <BookCoverArt
                  title={editForm.title || 'Tiêu đề tác phẩm'}
                  genre={editForm.genre}
                  coverUrl={editForm.coverUrl}
                  wordCount={project?.wordCount || 0}
                  size="sm"
                  className="shadow-md"
                />
                <span className="text-[10px] text-muted-foreground mt-1.5 font-medium">Bìa xem trước</span>
              </div>

              <div className="flex-1 min-w-0 space-y-3 w-full">
                <div>
                  <label className="text-xs font-semibold block mb-1.5 flex items-center justify-between">
                    <span>Ảnh bìa tác phẩm</span>
                    {editForm.coverUrl ? (
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, coverUrl: '' }))}
                        className="text-[11px] text-rose-500 hover:underline flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Gỡ ảnh bìa
                      </button>
                    ) : null}
                  </label>

                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Dán link ảnh bìa (URL https://...)"
                      value={editForm.coverUrl.startsWith('data:') ? '[Ảnh tải từ máy tính]' : editForm.coverUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val.startsWith('[Ảnh')) {
                          setEditForm(prev => ({ ...prev, coverUrl: val }));
                        }
                      }}
                      className="text-xs h-9"
                    />
                    <label className="shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 px-3 text-xs gap-1.5 cursor-pointer"
                        asChild
                      >
                        <span>
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          <span>Tải ảnh</span>
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Hỗ trợ tệp PNG, JPG hoặc dán liên kết URL ảnh. Hệ thống sẽ tối ưu hóa để hiển thị 3D sắc nét.
                  </p>
                </div>
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Tên tác phẩm *</label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ví dụ: Thiên Mệnh Kỷ"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Tên phụ / Bút danh</label>
                <Input
                  value={editForm.subtitle}
                  onChange={(e) => setEditForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Ví dụ: Quyển 1: Khởi nguyên"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Genre & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Thể loại</label>
                <select
                  value={editForm.genre}
                  onChange={(e) => setEditForm(prev => ({ ...prev, genre: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(genreLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Trạng thái</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="planning">Đang lập dàn ý</option>
                  <option value="drafting">Đang sáng tác</option>
                  <option value="revising">Đang biên tập</option>
                  <option value="completed">Đã hoàn thành</option>
                  <option value="published">Đã xuất bản</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Mục tiêu số từ</label>
                <Input
                  type="number"
                  value={editForm.wordCountGoal}
                  onChange={(e) => setEditForm(prev => ({ ...prev, wordCountGoal: Number(e.target.value) || 0 }))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold block mb-1">Tóm tắt / Giới thiệu tác phẩm</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tóm tắt bối cảnh thế giới, nhân vật chính, xung đột mở đầu..."
                rows={3}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>
              Hủy
            </Button>
            <Button size="sm" onClick={saveProjectEdit} disabled={savingEdit} className="bg-primary hover:bg-primary/90">
              {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

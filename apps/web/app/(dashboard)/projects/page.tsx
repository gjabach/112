'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiFetch, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, BookOpen, Search, Trash2, Copy, FileText, Sparkles, Layers, Edit3, Upload, Image as ImageIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { BookCoverArt } from '@/components/vfx/book-cover';
import { fireConfetti } from '@/components/vfx/confetti';
import { MagicSparkles, SparkleIcon, GlowingDot } from '@/components/vfx/magic-sparkles';

interface Project {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  genre?: string;
  coverUrl?: string;
  status: string;
  wordCount: number;
  chapterCount: number;
  wordCountGoal?: number;
  createdAt: number;
  updatedAt: number;
}

const genreLabels: Record<string, string> = {
  fantasy: 'Huyền Huyễn', scifi: 'Khoa Huyễn', romance: 'Lãng Mạn', mystery: 'Trinh Thám',
  thriller: 'Giật Gân', horror: 'Kinh Dị', literary: 'Văn Học', historical: 'Lịch Sử',
  blank: 'Chung'
};

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: 'Đang lập dàn ý', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' },
  drafting: { label: 'Đang sáng tác', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  revising: { label: 'Đang biên tập', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  completed: { label: 'Đã hoàn thành', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  published: { label: 'Đã xuất bản', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' }
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', genre: 'fantasy', template: 'fantasy' });

  const fetchProjects = async () => {
    try {
      const res = await apiFetch('/api/projects');
      setProjects(res.projects);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchProjects(); 
    const handleSyncUpdated = () => fetchProjects();
    window.addEventListener('novelist-sync-updated', handleSyncUpdated);
    return () => window.removeEventListener('novelist-sync-updated', handleSyncUpdated);
  }, []);

  // Edit Project Dialog State
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    genre: 'fantasy',
    coverUrl: '',
    wordCountGoal: 50000,
    status: 'planning'
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditDialog = (proj: Project) => {
    setEditingProject(proj);
    setEditForm({
      title: proj.title || '',
      subtitle: proj.subtitle || '',
      description: proj.description || '',
      genre: proj.genre || 'fantasy',
      coverUrl: proj.coverUrl || '',
      wordCountGoal: proj.wordCountGoal || 50000,
      status: proj.status || 'planning'
    });
    setShowEditDialog(true);
  };

  const handleCoverImageFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
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
    if (!editingProject) return;
    if (!editForm.title.trim()) {
      toast.error('Tên tác phẩm không được để trống');
      return;
    }
    setSavingEdit(true);
    try {
      await apiFetch(`/api/projects/${editingProject.id}`, {
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
      toast.success('Đã cập nhật thông tin tác phẩm thành công!');
      setShowEditDialog(false);
      setEditingProject(null);
      fetchProjects();
    } catch (e: any) {
      toast.error('Lỗi khi lưu: ' + (e.message || 'Không xác định'));
    } finally {
      setSavingEdit(false);
    }
  };

  const createProject = async () => {
    if (!newProject.title.trim()) {
      toast.error('Vui lòng nhập tên dự án');
      return;
    }
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: newProject.title,
          description: newProject.description,
          genre: newProject.genre,
          template: newProject.template,
          status: 'planning'
        })
      });
      toast.success('Tạo dự án thành công! Bạn có thể chỉnh sửa bìa và thông tin chi tiết ngay bây giờ.');
      fireConfetti({ type: 'celebration' });
      setShowNewDialog(false);
      const created = res?.project;
      setNewProject({ title: '', description: '', genre: 'fantasy', template: 'fantasy' });
      await fetchProjects();
      if (created) {
        openEditDialog(created);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const duplicateProject = async (id: string) => {
    try {
      await apiFetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
      toast.success('Nhân bản dự án thành công');
      fireConfetti({ type: 'stardust' });
      fetchProjects();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa dự án này? Thao tác này sẽ xóa tất cả chương và dữ liệu liên quan.')) return;
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa dự án');
      fetchProjects();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto relative z-10">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Kệ Sách Sáng Tác</h1>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary font-mono">
                {projects.length} tác phẩm
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Quản lý bản thảo, tiến độ từ ngữ và kiến thiết các vũ trụ truyện
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowNewDialog(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/25 btn-interactive flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Dự án mới</span>
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm tiểu thuyết..."
              className="pl-9 bg-card/70 border-border/70 backdrop-blur-md rounded-xl text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse glass-card p-4 rounded-2xl h-56 flex gap-4">
                <div className="w-32 bg-muted/60 rounded-xl shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-5 bg-muted/80 rounded w-3/4" />
                  <div className="h-3 bg-muted/60 rounded w-1/2" />
                  <div className="h-12 bg-muted/40 rounded mt-4" />
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Enchanting Empty State */
          <div className="rounded-3xl border border-dashed border-primary/30 p-8 sm:p-14 text-center glass-card relative overflow-hidden my-6">
            <div className="absolute inset-0 bg-radial-gradient from-primary/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary shadow-inner">
                <SparkleIcon size={32} color="currentColor" />
              </div>
              <h3 className="text-xl font-serif font-bold text-foreground">
                {search ? 'Không tìm thấy tiểu thuyết phù hợp' : 'Kệ sách đang chờ tác phẩm đầu tay của bạn'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {search
                  ? 'Thử tìm với tên hoặc từ khóa khác xem sao nhé.'
                  : 'Hãy mở đầu câu chuyện bằng một thế giới mới, những nhân vật sống động và hành trình phiêu lưu đang vẫy gọi.'}
              </p>
              {!search && (
                <div className="pt-2">
                  <MagicSparkles>
                    <Button
                      onClick={() => setShowNewDialog(true)}
                      size="lg"
                      className="font-semibold shadow-lg shadow-primary/25 btn-interactive"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Bắt đầu cuốn sách đầu tiên
                    </Button>
                  </MagicSparkles>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(project => {
              const progress =
                project.wordCountGoal && project.wordCount
                  ? Math.min(100, Math.round(((project.wordCount || 0) / project.wordCountGoal) * 100))
                  : 0;

              const statusInfo = statusLabels[project.status] || {
                label: project.status,
                color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
              };

              return (
                <Card
                  key={project.id}
                  className="glass-card glow-card border border-border/70 hover:border-primary/50 rounded-2xl p-4 flex flex-col justify-between group transition-all duration-300"
                >
                  <div className="flex gap-4 items-start">
                    {/* 3D Artistic Procedural Book Cover */}
                    <Link href={`/editor/${project.id}`} className="shrink-0 group/cover">
                      <BookCoverArt
                        title={project.title}
                        genre={project.genre}
                        coverUrl={project.coverUrl}
                        wordCount={project.wordCount}
                        size="sm"
                        className="group-hover/cover:scale-105 transition-transform duration-300"
                      />
                    </Link>

                    {/* Book Metadata */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <Link href={`/editor/${project.id}`} className="block truncate">
                            <h3 className="font-serif font-bold text-base text-foreground group-hover:text-primary transition-colors truncate tracking-tight">
                              {project.title}
                            </h3>
                          </Link>
                          {/* Actions */}
                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-primary"
                              title="Chỉnh sửa thông tin tác phẩm (Tên, Bìa, Thể loại, Tóm tắt...)"
                              onClick={() => openEditDialog(project)}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Nhân bản tiểu thuyết"
                              onClick={() => duplicateProject(project.id)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              title="Xóa tiểu thuyết"
                              onClick={() => deleteProject(project.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {project.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{project.subtitle}</p>
                        )}

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-border/70 font-normal">
                            {genreLabels[project.genre || 'blank'] || project.genre}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                        {project.description || 'Chưa có tóm tắt nội dung tác phẩm.'}
                      </p>
                    </div>
                  </div>

                  {/* Progress & Quick Enter Footer */}
                  <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                        <span>{(project.wordCount || 0).toLocaleString()} từ</span>
                        <span>•</span>
                        <span>{project.chapterCount || 0} chương</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                    </div>

                    {/* Word goal progress bar */}
                    {project.wordCountGoal ? (
                      <div className="space-y-1">
                        <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary to-indigo-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{progress}% mục tiêu</span>
                          <span>{(project.wordCountGoal || 0).toLocaleString()} từ</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="pt-1 flex justify-end">
                      <Link href={`/editor/${project.id}`} className="w-full sm:w-auto">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto h-7 text-xs font-semibold px-3 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all duration-200"
                        >
                          Mở bản thảo <FileText className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent onClose={() => setShowNewDialog(false)} className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <SparkleIcon size={18} color="currentColor" />
              <span>Khởi tạo tiểu thuyết mới</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Điền thông tin ban đầu để xây dựng thế giới của tác phẩm
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Tên tiểu thuyết *</label>
              <Input
                placeholder="Ví dụ: Thiên Mệnh Kỷ, Đêm Trăng Máu..."
                value={newProject.title}
                onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                className="bg-card/70"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Tóm tắt ngắn (Synopsis)</label>
              <Textarea
                placeholder="Ý tưởng hoặc tóm tắt ngắn về cốt truyện..."
                value={newProject.description}
                onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                className="bg-card/70 h-20 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Thể loại</label>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-card/70 px-3 text-xs"
                  value={newProject.genre}
                  onChange={e => setNewProject({ ...newProject, genre: e.target.value })}
                >
                  <option value="fantasy">Huyền Huyễn (Fantasy)</option>
                  <option value="scifi">Khoa Huyễn (Sci-Fi)</option>
                  <option value="romance">Lãng Mạn (Romance)</option>
                  <option value="mystery">Trinh Thám (Mystery)</option>
                  <option value="thriller">Giật Gân (Thriller)</option>
                  <option value="horror">Kinh Dị (Horror)</option>
                  <option value="literary">Văn Học (Literary)</option>
                  <option value="historical">Lịch Sử (Historical)</option>
                  <option value="blank">Chung / Tự do</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Khung mẫu (Template)</label>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-card/70 px-3 text-xs"
                  value={newProject.template}
                  onChange={e => setNewProject({ ...newProject, template: e.target.value })}
                >
                  <option value="fantasy">Fantasy (7 chương khởi đầu)</option>
                  <option value="scifi">Sci-Fi (Vũ trụ & thế giới)</option>
                  <option value="romance">Romance (Tuyến tình cảm)</option>
                  <option value="mystery">Trinh thám (Nút thắt manh mối)</option>
                  <option value="blank">Trống (1 chương tự do)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowNewDialog(false)}>
                Hủy
              </Button>
              <Button size="sm" onClick={createProject} className="bg-primary hover:bg-primary/90">
                Tạo tiểu thuyết
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Modal */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent onClose={() => setShowEditDialog(false)} className="glass-card sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              <span>Chỉnh sửa thông tin tác phẩm</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tùy chỉnh tên, ảnh bìa, thể loại, thông tin tóm tắt và mục tiêu sáng tác
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
            {/* Left: Live Book Cover Preview & Upload */}
            <div className="md:col-span-5 flex flex-col items-center text-center space-y-3 p-3 rounded-2xl bg-muted/20 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Xem trước bìa sách</span>
              <BookCoverArt
                title={editForm.title}
                genre={editForm.genre}
                coverUrl={editForm.coverUrl}
                author={editForm.subtitle || 'Tác giả'}
                size="md"
              />
              <div className="w-full space-y-2 pt-2">
                <label
                  htmlFor="cover-upload-input"
                  className="cursor-pointer flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all duration-200"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải ảnh từ máy tính</span>
                  <input
                    id="cover-upload-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        handleCoverImageFile(e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>

                {editForm.coverUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-destructive h-7"
                    onClick={() => setEditForm(prev => ({ ...prev, coverUrl: '' }))}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Dùng bìa đồ họa mặc định
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
                  💡 Hỗ trợ tải file ảnh trực tiếp hoặc dán đường dẫn link ảnh online bên cạnh.
                </p>
              </div>
            </div>

            {/* Right: Metadata Form Fields */}
            <div className="md:col-span-7 space-y-3.5">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Tên tiểu thuyết *</label>
                <Input
                  placeholder="Ví dụ: Thiên Mệnh Kỷ, Đêm Trăng Máu..."
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="bg-card/70 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Thể loại tác phẩm</label>
                  <select
                    className="flex h-9 w-full rounded-lg border border-input bg-card/70 px-3 text-xs"
                    value={editForm.genre}
                    onChange={e => setEditForm({ ...editForm, genre: e.target.value })}
                  >
                    <option value="fantasy">Huyền Huyễn (Fantasy)</option>
                    <option value="scifi">Khoa Huyễn (Sci-Fi)</option>
                    <option value="romance">Lãng Mạn (Romance)</option>
                    <option value="mystery">Trinh Thám (Mystery)</option>
                    <option value="thriller">Giật Gân (Thriller)</option>
                    <option value="horror">Kinh Dị (Horror)</option>
                    <option value="literary">Văn Học (Literary)</option>
                    <option value="historical">Lịch Sử (Historical)</option>
                    <option value="blank">Chung / Tự do</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Trạng thái sáng tác</label>
                  <select
                    className="flex h-9 w-full rounded-lg border border-input bg-card/70 px-3 text-xs"
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="planning">Đang lập dàn ý</option>
                    <option value="drafting">Đang sáng tác</option>
                    <option value="revising">Đang biên tập</option>
                    <option value="completed">Đã hoàn thành</option>
                    <option value="published">Đã xuất bản</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Link ảnh bìa online (URL)</label>
                <Input
                  placeholder="https://images.unsplash.com/... hoặc link ảnh"
                  value={editForm.coverUrl.startsWith('data:') ? '(Ảnh đã tải lên từ máy tính)' : editForm.coverUrl}
                  disabled={editForm.coverUrl.startsWith('data:')}
                  onChange={e => setEditForm({ ...editForm, coverUrl: e.target.value })}
                  className="bg-card/70 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Phụ đề / Bút danh tác giả</label>
                <Input
                  placeholder="Ví dụ: Cuốn 1 - Bút danh tác giả..."
                  value={editForm.subtitle}
                  onChange={e => setEditForm({ ...editForm, subtitle: e.target.value })}
                  className="bg-card/70 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Tóm tắt tác phẩm (Synopsis)</label>
                <Textarea
                  placeholder="Giới thiệu bối cảnh, nhân vật chính, xung đột mở đầu cốt truyện..."
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="bg-card/70 h-20 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Mục tiêu số từ dự kiến</label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={editForm.wordCountGoal}
                  onChange={e => setEditForm({ ...editForm, wordCountGoal: parseInt(e.target.value) || 0 })}
                  className="bg-card/70 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={saveProjectEdit}
              disabled={savingEdit || !editForm.title.trim()}
              className="bg-primary hover:bg-primary/90 font-semibold"
            >
              {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

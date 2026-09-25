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
import { Plus, BookOpen, Search, Trash2, Copy, FileText, Sparkles, Layers } from 'lucide-react';
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

  const createProject = async () => {
    if (!newProject.title.trim()) {
      toast.error('Vui lòng nhập tên dự án');
      return;
    }
    try {
      await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: newProject.title,
          description: newProject.description,
          genre: newProject.genre,
          template: newProject.template,
          status: 'planning'
        })
      });
      toast.success('Tạo dự án thành công!');
      fireConfetti({ type: 'celebration' });
      setShowNewDialog(false);
      setNewProject({ title: '', description: '', genre: 'fantasy', template: 'fantasy' });
      fetchProjects();
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
    </DashboardLayout>
  );
}

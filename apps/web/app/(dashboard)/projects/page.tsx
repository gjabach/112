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
import { Plus, BookOpen, Search, MoreHorizontal, Trash2, Copy, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

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
  fantasy: 'Fantasy', scifi: 'Sci-Fi', romance: 'Romance', mystery: 'Trinh thám',
  thriller: 'Thriller', horror: 'Kinh dị', literary: 'Văn học', historical: 'Lịch sử',
  blank: 'Trống'
};

const statusColors: Record<string, string> = {
  planning: 'bg-gray-500', drafting: 'bg-yellow-500', revising: 'bg-blue-500',
  completed: 'bg-green-500', published: 'bg-purple-500'
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

  useEffect(() => { fetchProjects(); }, []);

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
      toast.success('Nhân bản thành công');
      fetchProjects();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa dự án này?')) return;
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
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dự án của bạn</h1>
            <p className="text-muted-foreground">Quản lý tất cả tiểu thuyết đang viết</p>
          </div>
          <Button onClick={() => setShowNewDialog(true)}><Plus className="w-4 h-4 mr-2" /> Dự án mới</Button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm dự án..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardHeader><div className="h-6 bg-muted rounded w-3/4"></div><div className="h-4 bg-muted rounded w-1/2 mt-2"></div></CardHeader><CardContent><div className="h-20 bg-muted rounded"></div></CardContent></Card>)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">{search ? 'Không tìm thấy dự án' : 'Chưa có dự án nào'}</h3>
              <p className="text-muted-foreground mb-4">{search ? 'Thử từ khóa khác' : 'Bắt đầu tiểu thuyết đầu tiên của bạn'}</p>
              {!search && <Button onClick={() => setShowNewDialog(true)}><Plus className="w-4 h-4 mr-2" /> Tạo dự án đầu tiên</Button>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(project => {
              const progress = project.wordCountGoal && project.wordCount ? Math.min(100, Math.round(((project.wordCount || 0) / project.wordCountGoal) * 100)) : 0;
              return (
                <Card key={project.id} className="group hover:shadow-lg transition-all hover:border-primary/50 flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate group-hover:text-primary transition-colors">
                          <Link href={`/editor/${project.id}`}>{project.title}</Link>
                        </CardTitle>
                        {project.subtitle && <CardDescription className="truncate">{project.subtitle}</CardDescription>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateProject(project.id)}><Copy className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteProject(project.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">{genreLabels[project.genre || 'blank'] || project.genre}</Badge>
                      <Badge className={`text-xs text-white ${statusColors[project.status] || 'bg-gray-500'}`}>{project.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{project.description || 'Chưa có mô tả'}</p>
                    
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{(project.wordCount || 0).toLocaleString()} từ</span>
                        <span>{project.chapterCount || 0} chương</span>
                      </div>
                      {project.wordCountGoal ? (
                        <div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{progress}% mục tiêu {(project.wordCountGoal || 0).toLocaleString()} từ</div>
                        </div>
                      ) : null}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(project.updatedAt)}</span>
                        <Link href={`/editor/${project.id}`}><Button size="sm">Mở <FileText className="w-3 h-3 ml-1" /></Button></Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent onClose={() => setShowNewDialog(false)}>
          <DialogHeader>
            <DialogTitle>Tạo dự án mới</DialogTitle>
            <DialogDescription>Bắt đầu tiểu thuyết mới của bạn</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Tên tiểu thuyết *" value={newProject.title} onChange={e => setNewProject({ ...newProject, title: e.target.value })} />
            <Textarea placeholder="Mô tả ngắn..." value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={newProject.genre} onChange={e => setNewProject({ ...newProject, genre: e.target.value })}>
                <option value="fantasy">Fantasy</option>
                <option value="scifi">Sci-Fi</option>
                <option value="romance">Romance</option>
                <option value="mystery">Trinh thám</option>
                <option value="thriller">Thriller</option>
                <option value="literary">Văn học</option>
                <option value="blank">Trống</option>
              </select>
              <select className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={newProject.template} onChange={e => setNewProject({ ...newProject, template: e.target.value })}>
                <option value="fantasy">Template: Fantasy 7 chương</option>
                <option value="scifi">Template: Sci-Fi</option>
                <option value="romance">Template: Romance</option>
                <option value="mystery">Template: Mystery</option>
                <option value="blank">Trống - 1 chương</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Hủy</Button>
              <Button onClick={createProject}>Tạo dự án</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

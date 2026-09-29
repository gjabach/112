'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { OutlineNode } from '@/components/outline/outline-node';
import { KanbanView } from '@/components/outline/kanban-view';
import { CorkboardView } from '@/components/outline/corkboard-view';
import { StoryArcVisualizer } from '@/components/outline/story-arc-visualizer';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Plus, 
  LayoutList, 
  Kanban, 
  Pin, 
  Clock, 
  Sparkles, 
  Download, 
  Trash2, 
  FileText,
  Activity,
  BookOpen,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'tree' | 'kanban' | 'corkboard' | 'arc';

const templates = [
  { id: 'three-act', name: '3-Act Structure', nameVi: 'Cấu trúc 3 Hồi', desc: 'Mở đầu - Đối đầu - Kết thúc (25%-50%-25%)', icon: '🎬' },
  { id: 'save-the-cat', name: 'Save the Cat', nameVi: '15 Nhịp (Blake Snyder)', desc: 'Tiêu chuẩn cho cốt truyện điện ảnh & tiểu thuyết thương mại', icon: '🐱' },
  { id: 'hero-journey', name: "Hero's Journey", nameVi: 'Hành trình người hùng', desc: '12 bước phiêu lưu chuyển hóa theo Joseph Campbell', icon: '🦸' },
  { id: 'snowflake', name: 'Snowflake', nameVi: 'Phương pháp Bông tuyết', desc: 'Randy Ingermanson - Từ 1 câu phát triển lên trọn vẹn tiểu thuyết', icon: '❄️' },
  { id: 'story-circle', name: 'Story Circle', nameVi: 'Vòng tròn cốt truyện (Dan Harmon)', desc: '8 bước chuyển hóa nhân vật hiện đại', icon: '⭕' }
];

export default function OutlinePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [outline, setOutline] = useState<any[]>([]);
  const [flat, setFlat] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');

  // Dialog states
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);

  const [newNode, setNewNode] = useState({
    title: '',
    description: '',
    type: 'scene',
    parentId: null as string | null,
    status: 'idea',
    color: '#3b82f6'
  });

  const [aiForm, setAiForm] = useState({
    premise: '',
    genre: 'fantasy',
    numChapters: 12,
    templateId: 'three-act'
  });
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (projectId) fetchOutline();
  }, [projectId]);

  const fetchOutline = async () => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/outline`);
      setOutline(Array.isArray(res?.outline) ? res.outline : []);
      setFlat(Array.isArray(res?.flat) ? res.flat : []);
      setProgress(typeof res?.progress === 'number' ? res.progress : 0);
    } catch (e: any) {
      setOutline([]);
      setFlat([]);
      setProgress(0);
      toast.error(e.message || 'Lỗi tải dàn ý');
    } finally {
      setLoading(false);
    }
  };

  const createNode = async (override?: any) => {
    const data = { ...newNode, ...override };
    if (!data.title.trim()) {
      toast.error('Tiêu đề không được để trống');
      return;
    }
    try {
      await apiFetch(`/api/projects/${projectId}/outline`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      toast.success('Đã thêm mục dàn ý mới!');
      setShowNewDialog(false);
      setNewNode({ title: '', description: '', type: 'scene', parentId: null, status: 'idea', color: '#3b82f6' });
      fetchOutline();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const updateNode = async (id: string, data: any) => {
    try {
      await apiFetch(`/api/outline/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      fetchOutline();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteNode = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa mục này cùng tất cả mục con của nó?')) return;
    try {
      await apiFetch(`/api/outline/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchOutline();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const applyTemplate = async (templateId: string) => {
    if (!confirm(`Áp dụng mẫu "${templateId}"? Dàn ý hiện tại sẽ được giữ lại và thêm các hồi/phân cảnh mới.`)) return;
    try {
      await apiFetch(`/api/projects/${projectId}/outline/template`, {
        method: 'POST',
        body: JSON.stringify({ templateId })
      });
      toast.success('Đã áp dụng mẫu dàn ý thành công!');
      setShowTemplateDialog(false);
      fetchOutline();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const generateWithAI = async () => {
    if (!aiForm.premise.trim()) {
      toast.error('Vui lòng nhập tiền đề cốt truyện (Premise)');
      return;
    }
    setAiLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/outline/generate`, {
        method: 'POST',
        body: JSON.stringify(aiForm)
      });
      toast.success(`AI đã tạo thành công ${res.generatedCount || 10} phân cảnh hồi!`);
      setShowAIDialog(false);
      fetchOutline();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const convertToChapter = async (node: any) => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          title: node.title,
          notes: node.description || '',
          status: 'outline'
        })
      });
      const newChapterId = res.chapter?.id;
      if (newChapterId) {
        await updateNode(node.id, { linkedChapterId: newChapterId, status: 'planned' });
        toast.success(`Đã tạo chương "${node.title}" trong bản thảo!`);
      }
    } catch (e: any) {
      toast.error('Lỗi tạo chương: ' + (e.message || ''));
    }
  };

  const exportOutline = async (format: string) => {
    try {
      if (format === 'json') {
        const res = await apiFetch(`/api/projects/${projectId}/outline/export?format=json`);
        const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `outline-${projectId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Đã xuất file JSON thành công');
      } else if (format === 'opml') {
        const safeFlat = Array.isArray(flat) ? flat : [];
        const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Dàn ý tác phẩm - ${projectId}</title></head>
  <body>
    ${safeFlat.map(n => `<outline text="${(n.title || '').replace(/"/g, '&quot;')}" _note="${(n.description || '').replace(/"/g, '&quot;')}" type="${n.type || 'scene'}" status="${n.status || 'idea'}" />`).join('\n    ')}
  </body>
</opml>`;
        const blob = new Blob([opmlContent], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `outline-${projectId}.opml`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Đã xuất file OPML thành công');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const clearAll = async () => {
    if (!confirm('CẢNH BÁO: Xóa toàn bộ dàn ý của tác phẩm? Thao tác này không thể hoàn tác!')) return;
    try {
      const safeFlat = Array.isArray(flat) ? flat : [];
      for (const node of safeFlat) {
        if (!node.parentId) {
          await apiFetch(`/api/outline/${node.id}`, { method: 'DELETE' });
        }
      }
      toast.success('Đã dọn sạch dàn ý');
      fetchOutline();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const safeFlat = Array.isArray(flat) ? flat : [];
  const safeOutline = Array.isArray(outline) ? outline : [];
  const completedCount = safeFlat.filter(n => n.status === 'written' || n.status === 'revised').length;

  return (
    <div className="min-h-screen bg-background flex flex-col w-full max-w-full overflow-x-clip pb-12">
      {/* Top Sticky Header */}
      <header className="border-b bg-card/95 backdrop-blur-md sticky top-0 z-20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href={`/editor/${projectId}`} className="shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg flex items-center gap-2 truncate">
                <span className="truncate">Dàn Ý & Cấu Trúc Hồi</span>
                <span className="hidden sm:inline text-xs text-muted-foreground font-normal">(Story Architecture)</span>
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal shrink-0">
                  {safeFlat.length} mục
                </Badge>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Cấu trúc nhịp hồi, phân cảnh, bảng Kanban, Corkboard và đồ thị cao trào
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/60">
              <Button
                variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('tree')}
                title="Cây phân cấp nhịp hồi"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Cây nhịp</span>
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('kanban')}
                title="Bảng Kanban"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Kanban</span>
              </Button>
              <Button
                variant={viewMode === 'corkboard' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('corkboard')}
                title="Bảng ghim thẻ Corkboard"
              >
                <Pin className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Corkboard</span>
              </Button>
              <Button
                variant={viewMode === 'arc' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('arc')}
                title="Đồ thị cao trào cốt truyện"
              >
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Đồ thị nhịp</span>
              </Button>
            </div>

            {/* Template Dialog Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-muted/40"
              onClick={() => setShowTemplateDialog(true)}
            >
              <BookOpen className="w-3.5 h-3.5 mr-1 text-primary" />
              <span className="hidden sm:inline">Mẫu chuẩn</span>
            </Button>

            {/* AI Generator Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
              onClick={() => setShowAIDialog(true)}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">AI Dàn ý</span>
            </Button>

            {/* Create Scene Button */}
            <Button
              size="sm"
              onClick={() => {
                setNewNode({ title: '', description: '', type: 'scene', parentId: null, status: 'idea', color: '#3b82f6' });
                setShowNewDialog(true);
              }}
              className="h-8 text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Thêm mục</span>
            </Button>

            {/* Export Menu */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => exportOutline('json')}
              title="Xuất dàn ý JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Progress & Stats Bar */}
      <div className="border-b bg-card/60 backdrop-blur-xs px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              Tiến độ hoàn thiện:
            </span>
            <div className="w-36 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-bold text-primary">{progress}%</span>
            <span className="text-muted-foreground hidden sm:inline">
              ({completedCount}/{safeFlat.length} phân cảnh đã viết)
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Hồi ({safeFlat.filter(n => n.type === 'act').length})
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Chương ({safeFlat.filter(n => n.type === 'chapter').length})
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" /> Phân cảnh ({safeFlat.filter(n => n.type === 'scene' || n.type === 'beat').length})
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto p-3 sm:p-6 w-full flex-1">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse text-xs">
            Đang tải dữ liệu dàn ý tác phẩm...
          </div>
        ) : (
          <div>
            {/* VIEW 1: HIERARCHICAL TREE & BEATS */}
            {viewMode === 'tree' && (
              <div className="space-y-4">
                {safeOutline.length === 0 ? (
                  <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/10 space-y-3">
                    <LayoutList className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                    <h3 className="font-semibold text-sm">Chưa có dàn ý nào</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Bắt đầu xây dựng cấu trúc 3 Hồi, áp dụng mẫu Save the Cat hoặc nhờ AI kiến tạo dàn ý nhanh chóng!
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <Button size="sm" onClick={() => setShowTemplateDialog(true)} className="text-xs">
                        <BookOpen className="w-3.5 h-3.5 mr-1" /> Chọn Mẫu Chuẩn
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAIDialog(true)} className="text-xs">
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-500" /> AI Tạo Dàn Ý
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {safeOutline.map((node) => (
                      <OutlineNode
                        key={node.id}
                        node={node}
                        onUpdate={updateNode}
                        onDelete={deleteNode}
                        onAddChild={(parentId: string, type?: string) => {
                          setNewNode({
                            title: '',
                            description: '',
                            type: type || 'scene',
                            parentId,
                            status: 'idea',
                            color: '#3b82f6'
                          });
                          setShowNewDialog(true);
                        }}
                        onConvertToChapter={convertToChapter}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: KANBAN VIEW */}
            {viewMode === 'kanban' && (
              <KanbanView
                nodes={safeFlat}
                onUpdate={updateNode}
                onAdd={(status) => {
                  setNewNode({
                    title: '',
                    description: '',
                    type: 'scene',
                    parentId: null,
                    status,
                    color: '#3b82f6'
                  });
                  setShowNewDialog(true);
                }}
                onConvertToChapter={convertToChapter}
                onDelete={deleteNode}
              />
            )}

            {/* VIEW 3: CORKBOARD VIEW */}
            {viewMode === 'corkboard' && (
              <CorkboardView
                nodes={safeFlat}
                onUpdate={updateNode}
                onConvertToChapter={convertToChapter}
                onDelete={deleteNode}
              />
            )}

            {/* VIEW 4: STORY ARC TENSION VISUALIZER */}
            {viewMode === 'arc' && (
              <StoryArcVisualizer
                nodes={safeFlat}
                projectId={projectId}
                onSelectNode={(node) => {
                  if (node.linkedChapterId) {
                    window.location.href = `/editor/${projectId}/${node.linkedChapterId}`;
                  } else {
                    convertToChapter(node);
                  }
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* New Node Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Thêm Mục Dàn Ý Mới</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tạo Hồi, Chương hoặc Phân cảnh để cấu trúc câu chuyện
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs pt-2">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Tiêu đề mục *</label>
              <Input
                value={newNode.title}
                onChange={e => setNewNode({ ...newNode, title: e.target.value })}
                placeholder="Ví dụ: Hồi I: Khởi Hành, Cảnh 1: Gặp gỡ trong quán trọ..."
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Phân loại</label>
                <select
                  value={newNode.type}
                  onChange={e => setNewNode({ ...newNode, type: e.target.value })}
                  className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
                >
                  <option value="act">Hồi (Act)</option>
                  <option value="chapter">Chương (Chapter)</option>
                  <option value="scene">Phân cảnh (Scene)</option>
                  <option value="beat">Nhịp cốt truyện (Beat)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Trạng thái</label>
                <select
                  value={newNode.status}
                  onChange={e => setNewNode({ ...newNode, status: e.target.value })}
                  className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
                >
                  <option value="idea">💡 Ý tưởng</option>
                  <option value="planned">📋 Đã lên kế hoạch</option>
                  <option value="drafting">✍️ Đang viết</option>
                  <option value="written">✅ Hoàn thành</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Tóm tắt / Diễn biến chính</label>
              <Textarea
                value={newNode.description}
                onChange={e => setNewNode({ ...newNode, description: e.target.value })}
                placeholder="Mục tiêu của cảnh, mâu thuẫn chính và kết quả của phân cảnh này..."
                className="min-h-[85px] text-xs leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setShowNewDialog(false)} className="text-xs h-8">
              Hủy
            </Button>
            <Button size="sm" onClick={() => createNode()} className="text-xs h-8 font-semibold">
              Tạo Mục Dàn Ý
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl p-5 rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> Thư Viện Mẫu Dàn Ý Chuẩn Quốc Tế
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Áp dụng các cấu trúc biên kịch & tiểu thuyết kinh điển để giữ vững nhịp độ câu chuyện
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            {templates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => applyTemplate(tpl.id)}
                className="rounded-xl border border-border/70 p-4 bg-muted/15 hover:bg-muted/30 hover:border-primary/40 transition-all cursor-pointer space-y-2 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{tpl.icon}</span>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                      {tpl.nameVi}
                    </h4>
                    <span className="text-[10px] text-muted-foreground font-mono">{tpl.name}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tpl.desc}
                </p>
                <div className="pt-1 flex justify-end">
                  <span className="text-[11px] text-primary font-medium group-hover:underline">
                    Áp dụng mẫu này →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Outline Generator Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" /> AI Kiến Tạo Cấu Trúc Dàn Ý
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tự động phân bổ Hồi và đề xuất các phân cảnh cao trào theo tiền đề truyện của bạn
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs pt-2">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Tiền đề cốt truyện (Premise) *</label>
              <Textarea
                placeholder="Ví dụ: Một thợ rèn trẻ vô tình rèn ra thanh kiếm thức tỉnh linh hồn rồng cổ đại, bị triều đình săn đuổi và phải dấn thân tìm lại nguồn gốc thân phận..."
                value={aiForm.premise}
                onChange={e => setAiForm({ ...aiForm, premise: e.target.value })}
                className="min-h-[85px] text-xs leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Thể loại</label>
                <select
                  value={aiForm.genre}
                  onChange={e => setAiForm({ ...aiForm, genre: e.target.value })}
                  className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
                >
                  <option value="fantasy">Huyền huyễn / Tiên hiệp</option>
                  <option value="scifi">Khoa huyễn / Viễn tưởng</option>
                  <option value="mystery">Trinh thám / Ly kỳ</option>
                  <option value="romance">Lãng mạn / Ngôn tình</option>
                  <option value="thriller">Giật gân / Hành động</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Số chương dự kiến</label>
                <input
                  type="number"
                  value={aiForm.numChapters}
                  onChange={e => setAiForm({ ...aiForm, numChapters: Math.max(3, parseInt(e.target.value) || 10) })}
                  className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setShowAIDialog(false)} className="text-xs h-8">
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={generateWithAI}
              disabled={aiLoading}
              className="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {aiLoading ? 'Đang tạo dàn ý...' : 'Kiến Tạo Ngay'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

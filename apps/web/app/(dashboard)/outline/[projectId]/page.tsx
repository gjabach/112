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
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Plus, LayoutList, Kanban, Pin, Clock, Sparkles, Download, Trash2, FileText } from 'lucide-react';

type ViewMode = 'tree' | 'kanban' | 'corkboard' | 'timeline';

const templates = [
  { id: 'three-act', name: '3-Act Structure', nameVi: '3 Hồi', desc: 'Mở đầu - Đối đầu - Kết thúc (25%-50%-25%)', icon: '🎬' },
  { id: 'hero-journey', name: "Hero's Journey", nameVi: 'Hành trình người hùng', desc: '12 bước theo Joseph Campbell', icon: '🦸' },
  { id: 'save-the-cat', name: 'Save the Cat', nameVi: '15 Nhịp', desc: 'Blake Snyder - cho truyện thương mại', icon: '🐱' },
  { id: 'snowflake', name: 'Snowflake', nameVi: 'Bông tuyết', desc: 'Từ 1 câu lên tiểu thuyết (10 bước)', icon: '❄️' }
];

export default function OutlinePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [outline, setOutline] = useState<any[]>([]);
  const [flat, setFlat] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [newNode, setNewNode] = useState({ title: '', description: '', type: 'scene', parentId: null as string | null, status: 'idea', color: '#3b82f6' });
  const [aiForm, setAiForm] = useState({ premise: '', genre: '', numChapters: 10, templateId: 'three-act' });
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
      toast.error(e.message || 'Lỗi tải outline');
    } finally {
      setLoading(false);
    }
  };

  const createNode = async (override?: any) => {
    const data = { ...newNode, ...override };
    if (!data.title.trim()) { toast.error('Nhập tiêu đề'); return; }
    try {
      await apiFetch(`/api/projects/${projectId}/outline`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      toast.success('Tạo node mới');
      setShowNewDialog(false);
      setNewNode({ title: '', description: '', type: 'scene', parentId: null, status: 'idea', color: '#3b82f6' });
      fetchOutline();
    } catch (e: any) { toast.error(e.message); }
  };

  const updateNode = async (id: string, data: any) => {
    try {
      await apiFetch(`/api/outline/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      fetchOutline();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteNode = async (id: string) => {
    if (!confirm('Xóa node này và tất cả con của nó?')) return;
    try {
      await apiFetch(`/api/outline/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchOutline();
    } catch (e: any) { toast.error(e.message); }
  };

  const applyTemplate = async (templateId: string) => {
    if (!confirm(`Áp dụng template "${templateId}"? Outline hiện tại sẽ được giữ lại và thêm mới.`)) return;
    try {
      await apiFetch(`/api/projects/${projectId}/outline/template`, {
        method: 'POST',
        body: JSON.stringify({ templateId })
      });
      toast.success('Đã áp dụng template');
      setShowTemplateDialog(false);
      fetchOutline();
    } catch (e: any) { toast.error(e.message); }
  };

  const generateWithAI = async () => {
    if (!aiForm.premise.trim()) { toast.error('Nhập premise (ý tưởng cốt truyện)'); return; }
    setAiLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/outline/generate`, {
        method: 'POST',
        body: JSON.stringify(aiForm)
      });
      toast.success(`AI đã tạo ${res.generatedCount || 10} nodes`);
      setShowAIDialog(false);
      fetchOutline();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(false);
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
        toast.success('Đã tải xuống file JSON');
      } else if (format === 'opml') {
        const safeFlat = Array.isArray(flat) ? flat : [];
        const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Dàn ý - ${projectId}</title></head>
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
        toast.success('Đã tải xuống file OPML');
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const clearAll = async () => {
    if (!confirm('Xóa toàn bộ outline? Không thể hoàn tác!')) return;
    try {
      const safeFlat = Array.isArray(flat) ? flat : [];
      for (const node of safeFlat) {
        if (!node.parentId) {
          await apiFetch(`/api/outline/${node.id}`, { method: 'DELETE' });
        }
      }
      toast.success('Đã xóa toàn bộ');
      fetchOutline();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-8">Đang tải outline...</div>;

  const safeFlat = Array.isArray(flat) ? flat : [];
  const safeOutline = Array.isArray(outline) ? outline : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-4 p-3 max-w-[1600px] mx-auto w-full">
          <Link href={`/editor/${projectId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="font-bold">Dàn ý - Outline</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{safeFlat.length} nodes</span>
              <span>•</span>
              <span>{progress}% hoàn thành</span>
              <div className="w-20 h-1 bg-muted rounded-full ml-2"><div className="h-1 bg-primary rounded-full" style={{ width: `${progress}%` }}></div></div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* View switcher */}
            <div className="flex bg-muted rounded-lg p-1">
              <Button variant={viewMode === 'tree' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setViewMode('tree')}><LayoutList className="w-3 h-3 mr-1" /> Tree</Button>
              <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setViewMode('kanban')}><Kanban className="w-3 h-3 mr-1" /> Kanban</Button>
              <Button variant={viewMode === 'corkboard' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setViewMode('corkboard')}><Pin className="w-3 h-3 mr-1" /> Corkboard</Button>
              <Button variant={viewMode === 'timeline' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setViewMode('timeline')}><Clock className="w-3 h-3 mr-1" /> Timeline</Button>
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>📚 Templates</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAIDialog(true)}><Sparkles className="w-3 h-3 mr-1" /> AI Generate</Button>
            <Button size="sm" onClick={() => setShowNewDialog(true)}><Plus className="w-3 h-3 mr-1" /> Thêm</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-[1600px] mx-auto w-full">
        {safeFlat.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="text-6xl mb-4">🗺️</div>
              <h3 className="font-semibold text-lg mb-2">Chưa có dàn ý</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">Bắt đầu với template có sẵn hoặc để AI tạo outline từ ý tưởng của bạn</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => setShowTemplateDialog(true)}>📚 Chọn Template</Button>
                <Button variant="outline" onClick={() => setShowAIDialog(true)}><Sparkles className="w-4 h-4 mr-2" /> AI Generate</Button>
                <Button variant="outline" onClick={() => setShowNewDialog(true)}><Plus className="w-4 h-4 mr-2" /> Tạo thủ công</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === 'tree' && (
              <div className="space-y-2 max-w-4xl">
                {safeOutline.map((node: any) => (
                  <OutlineNode
                    key={node.id}
                    node={node}
                    onUpdate={updateNode}
                    onDelete={deleteNode}
                    onAddChild={(parentId) => { setNewNode({ ...newNode, parentId }); setShowNewDialog(true); }}
                  />
                ))}
              </div>
            )}

            {viewMode === 'kanban' && (
              <KanbanView
                nodes={safeFlat}
                onUpdate={updateNode}
                onAdd={(status) => { setNewNode({ ...newNode, status }); setShowNewDialog(true); }}
              />
            )}

            {viewMode === 'corkboard' && (
              <CorkboardView nodes={safeFlat} onUpdate={updateNode} />
            )}

            {viewMode === 'timeline' && (
              <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-4">
                  {[...safeFlat]
                    .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
                    .map((node: any, idx: number) => (
                      <Card key={node.id} className="min-w-[200px] border-l-4 flex-shrink-0" style={{ borderLeftColor: node.color || '#3b82f6' }}>
                        <CardContent className="p-3">
                          <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                          <div className="font-medium text-sm truncate">{node.title}</div>
                          <Badge variant="secondary" className="text-[10px] mt-1">{node.type} • {node.status}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                </div>
                <div className="h-2 bg-muted rounded-full relative">
                  <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-xs text-muted-foreground text-center">Timeline ngang - kéo để xem toàn bộ outline theo thứ tự</p>
              </div>
            )}
          </>
        )}

        {/* Actions footer */}
        {flat.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2 justify-between items-center border-t pt-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportOutline('json')}><Download className="w-3 h-3 mr-1" /> Export JSON</Button>
              <Button variant="outline" size="sm" onClick={() => exportOutline('opml')}><FileText className="w-3 h-3 mr-1" /> Export OPML</Button>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={clearAll}><Trash2 className="w-3 h-3 mr-1" /> Xóa toàn bộ</Button>
          </div>
        )}
      </div>

      {/* New Node Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent onClose={() => setShowNewDialog(false)}>
          <DialogHeader>
            <DialogTitle>Thêm node mới</DialogTitle>
            <DialogDescription>Act &gt; Chapter &gt; Scene &gt; Beat</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Tiêu đề *" value={newNode.title} onChange={e => setNewNode({ ...newNode, title: e.target.value })} />
            <Textarea placeholder="Mô tả..." value={newNode.description} onChange={e => setNewNode({ ...newNode, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="flex h-9 rounded-lg border border-input px-3 text-sm" value={newNode.type} onChange={e => setNewNode({ ...newNode, type: e.target.value })}>
                <option value="act">Act (Hồi)</option>
                <option value="chapter">Chapter (Chương)</option>
                <option value="scene">Scene (Cảnh)</option>
                <option value="beat">Beat (Nhịp)</option>
              </select>
              <select className="flex h-9 rounded-lg border border-input px-3 text-sm" value={newNode.status} onChange={e => setNewNode({ ...newNode, status: e.target.value })}>
                <option value="idea">Ý tưởng</option>
                <option value="planned">Đã lên kế hoạch</option>
                <option value="written">Đã viết</option>
                <option value="revised">Đã sửa</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Màu:</label>
              <input type="color" value={newNode.color} onChange={e => setNewNode({ ...newNode, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              <span className="text-xs text-muted-foreground">{newNode.color}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Hủy</Button>
              <Button onClick={() => createNode()}>Tạo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent onClose={() => setShowTemplateDialog(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>📚 Chọn Template Outline</DialogTitle>
            <DialogDescription>Các cấu trúc truyện kinh điển được dùng bởi hàng nghìn tác giả</DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4 max-h-[60vh] overflow-auto">
            {templates.map(t => (
              <Card key={t.id} className="hover:border-primary/50 cursor-pointer transition-colors" onClick={() => applyTemplate(t.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><span className="text-xl">{t.icon}</span> {t.nameVi}</CardTitle>
                  <div className="text-xs text-muted-foreground">{t.name}</div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                  <Button size="sm" className="w-full mt-3" variant="outline">Áp dụng</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent onClose={() => setShowAIDialog(false)} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>✨ AI Generate Outline</DialogTitle>
            <DialogDescription>Nhập premise, AI sẽ tạo outline chi tiết theo cấu trúc bạn chọn</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Premise: Ví dụ: Một cô gái phát hiện mình là phù thủy cuối cùng trong thế giới không còn phép thuật, phải tìm cách khôi phục ma thuật trước khi..." value={aiForm.premise} onChange={e => setAiForm({ ...aiForm, premise: e.target.value })} rows={4} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Thể loại (fantasy, scifi...)" value={aiForm.genre} onChange={e => setAiForm({ ...aiForm, genre: e.target.value })} />
              <Input type="number" placeholder="Số chương" value={aiForm.numChapters} onChange={e => setAiForm({ ...aiForm, numChapters: parseInt(e.target.value) || 10 })} />
            </div>
            <select className="flex h-9 w-full rounded-lg border border-input px-3 text-sm" value={aiForm.templateId} onChange={e => setAiForm({ ...aiForm, templateId: e.target.value })}>
              <option value="three-act">3-Act Structure</option>
              <option value="hero-journey">Hero's Journey</option>
              <option value="save-the-cat">Save the Cat</option>
              <option value="snowflake">Snowflake Method</option>
            </select>
            <div className="bg-muted p-3 rounded-lg text-xs">
              <div className="font-medium mb-1">Yêu cầu:</div>
              <ul className="list-disc list-inside text-muted-foreground">
                <li>Đã cấu hình AI API key trong Settings</li>
                <li>Groq/Gemini free tier hoạt động tốt cho task này</li>
                <li>AI sẽ tạo JSON và tự lưu vào DB</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAIDialog(false)}>Hủy</Button>
              <Button onClick={generateWithAI} disabled={aiLoading}>{aiLoading ? 'Đang tạo...' : '✨ Tạo Outline'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

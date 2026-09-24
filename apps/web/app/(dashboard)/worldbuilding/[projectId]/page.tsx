'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Map, Trash2, Edit3, Search, Sparkles } from 'lucide-react';

interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  attributes?: any;
}

const types = [
  { id: 'all', label: 'Tất cả', icon: '🌐' },
  { id: 'location', label: 'Địa điểm', icon: '🏰' },
  { id: 'organization', label: 'Tổ chức', icon: '🏛️' },
  { id: 'species', label: 'Chủng tộc', icon: '🧝' },
  { id: 'magic_system', label: 'Ma thuật / Công nghệ', icon: '✨' },
  { id: 'item', label: 'Vật phẩm', icon: '🗡️' },
  { id: 'religion', label: 'Tôn giáo', icon: '🕊️' },
  { id: 'event', label: 'Lịch sử', icon: '📜' }
];

export default function WorldbuildingPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [form, setForm] = useState({ name: '', type: 'location', description: '' });
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiType, setAiType] = useState('location');
  const [aiConcept, setAiConcept] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const handleGenerateLore = async () => {
    setAiGenerating(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/entities/generate`, {
        method: 'POST',
        body: JSON.stringify({ type: aiType, concept: aiConcept })
      });
      if (res?.entity) {
        toast.success(`Đã tạo thực thể "${res.entity.name}" thành công!`);
        setShowAIDialog(false);
        setAiConcept('');
        fetchEntities();
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi tạo lore');
    } finally {
      setAiGenerating(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchEntities();
  }, [projectId, filter]);

  const fetchEntities = async () => {
    try {
      const query = filter === 'all' ? '' : `?type=${filter}`;
      const res = await apiFetch(`/api/projects/${projectId}/entities${query}`);
      const list = Array.isArray(res?.entities) ? res.entities : Array.isArray(res?.items) ? res.items : [];
      setEntities(list);
    } catch (e: any) {
      setEntities([]);
      toast.error(e.message || 'Lỗi tải dữ liệu thế giới');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntity = async () => {
    if (!form.name.trim()) { toast.error('Nhập tên thực thể'); return; }
    try {
      if (editingEntity) {
        await apiFetch(`/api/entities/${editingEntity.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form)
        });
        toast.success('Cập nhật thực thể thành công!');
      } else {
        await apiFetch(`/api/projects/${projectId}/entities`, {
          method: 'POST',
          body: JSON.stringify(form)
        });
        toast.success('Tạo thực thể mới thành công!');
      }
      setShowDialog(false);
      setEditingEntity(null);
      setForm({ name: '', type: 'location', description: '' });
      fetchEntities();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu');
    }
  };

  const deleteEntity = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa thực thể này?')) return;
    try {
      await apiFetch(`/api/entities/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchEntities();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openCreate = () => {
    setEditingEntity(null);
    setForm({ name: '', type: filter !== 'all' ? filter : 'location', description: '' });
    setShowDialog(true);
  };

  const openEdit = (e: Entity) => {
    setEditingEntity(e);
    setForm({ name: e.name || '', type: e.type || 'location', description: e.description || '' });
    setShowDialog(true);
  };

  const safeEntities = Array.isArray(entities) ? entities : [];
  const filteredEntities = safeEntities.filter(e =>
    (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const getCountByType = (typeId: string) => {
    if (typeId === 'all') return safeEntities.length;
    return safeEntities.filter(e => e.type === typeId).length;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href={`/editor/${projectId}`}>
              <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <span>Xây dựng thế giới (Worldbuilding)</span>
                <Badge variant="secondary" className="text-xs">{safeEntities.length} mục</Badge>
              </h1>
              <p className="text-xs text-muted-foreground">Địa điểm, tổ chức, ma thuật, chủng tộc và văn hóa</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Tìm thực thể..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-48"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => { setAiType(filter !== 'all' ? filter : 'location'); setShowAIDialog(true); }}>
              <Sparkles className="w-4 h-4 mr-1 text-primary" /> AI Gợi ý Lore
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Thêm thực thể
            </Button>
          </div>
        </div>

        {/* Filter categories */}
        <div className="px-4 pb-3 max-w-7xl mx-auto overflow-x-auto flex gap-1.5 scrollbar-none">
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1 text-xs rounded-full border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filter === t.id
                  ? 'bg-primary text-primary-foreground border-primary font-medium'
                  : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span className="opacity-75 text-[10px]">({getCountByType(t.id)})</span>
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-16 bg-muted/40" />
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : filteredEntities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Map className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="font-semibold text-lg mb-1">
                {search ? 'Không tìm thấy thực thể phù hợp' : 'Chưa có thực thể thế giới'}
              </h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                {search ? 'Hãy thử đổi từ khóa tìm kiếm' : 'Thiết lập các vương quốc, bang hội, hệ thống ma thuật hoặc di tích cổ xưa để làm sống động thế giới truyện.'}
              </p>
              {!search && (
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Tạo thực thể đầu tiên
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map(e => {
              const currentType = types.find(t => t.id === e.type) || { icon: '📌', label: e.type };
              return (
                <Card key={e.id} className="group hover:shadow-md transition-all flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate flex items-center gap-1.5">
                          <span>{currentType.icon}</span>
                          <span>{e.name}</span>
                        </CardTitle>
                        <Badge variant="secondary" className="mt-1 text-[11px]">
                          {currentType.label}
                        </Badge>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteEntity(e.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                      {e.description || 'Chưa có mô tả chi tiết cho thực thể này.'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntity ? 'Chỉnh sửa thực thể thế giới' : 'Thêm thực thể thế giới mới'}
            </DialogTitle>
            <DialogDescription>
              Ghi lại địa danh, tổ chức, pháp thuật hoặc quy luật xã hội trong thế giới truyện của bạn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Tên thực thể *</label>
              <Input
                placeholder="Ví dụ: Lâu đài Mùa Đông, Hội Giả Kim Thuật, Tộc Người Rồng..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Phân loại</label>
              <select
                className="flex h-9 w-full rounded-lg border border-input px-3 text-sm bg-background"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="location">🏰 Địa điểm (Thành phố, rừng rậm, pháo đài...)</option>
                <option value="organization">🏛️ Tổ chức (Giáo phái, bang hội, đế quốc...)</option>
                <option value="species">🧝 Chủng tộc / Sinh vật (Tiên tộc, quái thú...)</option>
                <option value="magic_system">✨ Hệ thống ma thuật / Công nghệ</option>
                <option value="item">🗡️ Vật phẩm / Bảo vật / Vũ khí</option>
                <option value="religion">🕊️ Tôn giáo / Tín ngưỡng / Triết lý</option>
                <option value="event">📜 Sự kiện lịch sử / Đại chiến</option>
                <option value="custom">📌 Tùy chỉnh khác</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Mô tả chi tiết</label>
              <Textarea
                placeholder="Lịch sử hình thành, đặc điểm nổi bật, quy tắc vận hành hoặc mối liên hệ với nhân vật chính..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Hủy</Button>
              <Button onClick={handleSaveEntity}>
                {editingEntity ? 'Lưu thay đổi' : 'Tạo thực thể'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Lore Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent onClose={() => setShowAIDialog(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>AI Gợi ý thực thể thế giới</span>
            </DialogTitle>
            <DialogDescription>
              Tự động sáng tạo địa danh, tổ chức, hệ thống ma thuật hoặc bảo vật phù hợp với tác phẩm
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium block mb-1">Loại thực thể</label>
              <select
                className="flex h-9 w-full rounded-lg border border-input px-3 text-sm bg-background"
                value={aiType}
                onChange={e => setAiType(e.target.value)}
              >
                <option value="location">🏰 Địa điểm</option>
                <option value="organization">🏛️ Tổ chức</option>
                <option value="species">🧝 Chủng tộc</option>
                <option value="magic_system">✨ Ma thuật / Công nghệ</option>
                <option value="item">🗡️ Vật phẩm / Bảo vật</option>
                <option value="religion">🕊️ Tôn giáo / Tín ngưỡng</option>
                <option value="event">📜 Sự kiện lịch sử</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Ý tưởng hoặc từ khóa gợi ý (tùy chọn)</label>
              <Textarea
                placeholder="VD: Thành phố ngầm được thắp sáng bằng tinh thể ma thuật, hoặc thanh kiếm nuốt chửng linh hồn..."
                value={aiConcept}
                onChange={e => setAiConcept(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowAIDialog(false)}>Hủy</Button>
              <Button onClick={handleGenerateLore} disabled={aiGenerating}>
                {aiGenerating ? 'Đang tạo...' : 'Tạo thực thể ngay'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

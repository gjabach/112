'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Map, Trash2, Edit } from 'lucide-react';

interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  attributes: any;
}

export default function WorldbuildingPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'location', description: '' });

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

  const createEntity = async () => {
    if (!form.name.trim()) { toast.error('Nhập tên'); return; }
    try {
      await apiFetch(`/api/projects/${projectId}/entities`, { method: 'POST', body: JSON.stringify(form) });
      toast.success('Tạo thành công');
      setShowDialog(false);
      setForm({ name: '', type: 'location', description: '' });
      fetchEntities();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteEntity = async (id: string) => {
    if (!confirm('Xóa thực thể này?')) return;
    try {
      await apiFetch(`/api/entities/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchEntities();
    } catch (e: any) { toast.error(e.message); }
  };

  const types = [
    { id: 'all', label: 'Tất cả' },
    { id: 'location', label: 'Địa điểm' },
    { id: 'organization', label: 'Tổ chức' },
    { id: 'species', label: 'Chủng tộc' },
    { id: 'magic_system', label: 'Ma thuật' },
    { id: 'item', label: 'Vật phẩm' },
    { id: 'religion', label: 'Tôn giáo' }
  ];

  const safeEntities = Array.isArray(entities) ? entities : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-4 p-4 max-w-7xl mx-auto">
          <Link href={`/editor/${projectId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="font-bold">Xây dựng thế giới</h1>
          <div className="ml-auto flex gap-2">
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {types.map(t => <button key={t.id} onClick={() => setFilter(t.id)} className={`px-3 py-1 text-xs rounded-md ${filter === t.id ? 'bg-background shadow' : ''}`}>{t.label}</button>)}
            </div>
            <Button onClick={() => setShowDialog(true)}><Plus className="w-4 h-4 mr-2" /> Thêm</Button>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {loading ? <div>Đang tải...</div> : safeEntities.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-16 text-center"><Map className="w-12 h-12 mx-auto mb-4 opacity-50" /><h3 className="font-semibold">Chưa có dữ liệu thế giới</h3><p className="text-muted-foreground text-sm mb-4">Tạo địa điểm, tổ chức, hệ thống ma thuật...</p><Button onClick={() => setShowDialog(true)}>Tạo đầu tiên</Button></CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safeEntities.map(e => (
              <Card key={e.id} className="group hover:shadow-md">
                <CardHeader className="pb-2"><div className="flex justify-between"><CardTitle className="text-base">{e.name}</CardTitle><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteEntity(e.id)}><Trash2 className="w-3 h-3" /></Button></div><Badge variant="secondary" className="w-fit text-xs">{e.type}</Badge></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground line-clamp-3">{e.description || 'Chưa có mô tả'}</p></CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)}>
          <DialogHeader><DialogTitle>Thêm thực thể thế giới</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Tên *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="flex h-9 w-full rounded-lg border border-input px-3 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="location">Địa điểm</option>
              <option value="organization">Tổ chức</option>
              <option value="species">Chủng tộc/Sinh vật</option>
              <option value="magic_system">Hệ thống ma thuật/công nghệ</option>
              <option value="item">Vật phẩm</option>
              <option value="religion">Tôn giáo/Tín ngưỡng</option>
              <option value="event">Sự kiện lịch sử</option>
              <option value="custom">Tùy chỉnh</option>
            </select>
            <Textarea placeholder="Mô tả chi tiết..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowDialog(false)}>Hủy</Button><Button onClick={createEntity}>Tạo</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

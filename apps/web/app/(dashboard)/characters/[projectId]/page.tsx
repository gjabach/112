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
import { ArrowLeft, Plus, User, Trash2, Edit, Sparkles } from 'lucide-react';

interface Character {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  motivation?: string;
  aliases: string[];
  tags: string[];
}

export default function CharactersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [form, setForm] = useState({ name: '', role: 'supporting', personality: '', background: '', appearance: '', motivation: '' });

  useEffect(() => {
    if (projectId) fetchCharacters();
  }, [projectId]);

  const fetchCharacters = async () => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/characters`);
      setCharacters(Array.isArray(res?.characters) ? res.characters : []);
    } catch (e: any) {
      setCharacters([]);
      toast.error(e.message || 'Lỗi tải danh sách nhân vật');
    } finally {
      setLoading(false);
    }
  };

  const saveCharacter = async () => {
    if (!form.name.trim()) { toast.error('Nhập tên nhân vật'); return; }
    try {
      if (editing) {
        await apiFetch(`/api/characters/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) });
        toast.success('Cập nhật nhân vật');
      } else {
        await apiFetch(`/api/projects/${projectId}/characters`, { method: 'POST', body: JSON.stringify(form) });
        toast.success('Tạo nhân vật mới');
      }
      setShowDialog(false);
      setEditing(null);
      setForm({ name: '', role: 'supporting', personality: '', background: '', appearance: '', motivation: '' });
      fetchCharacters();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteChar = async (id: string) => {
    if (!confirm('Xóa nhân vật này?')) return;
    try {
      await apiFetch(`/api/characters/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchCharacters();
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (char: Character) => {
    setEditing(char);
    setForm({ name: char.name || '', role: char.role || 'supporting', personality: char.personality || '', background: char.background || '', appearance: char.appearance || '', motivation: char.motivation || '' });
    setShowDialog(true);
  };

  const safeCharacters = Array.isArray(characters) ? characters : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-4 p-4 max-w-7xl mx-auto">
          <Link href={`/editor/${projectId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="font-bold text-lg">Nhân vật</h1>
          <div className="ml-auto"><Button onClick={() => { setEditing(null); setForm({ name: '', role: 'supporting', personality: '', background: '', appearance: '', motivation: '' }); setShowDialog(true); }}><Plus className="w-4 h-4 mr-2" /> Nhân vật mới</Button></div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {loading ? <div>Đang tải...</div> : safeCharacters.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-16 text-center"><User className="w-16 h-16 mx-auto mb-4 opacity-50" /><h3 className="font-semibold mb-2">Chưa có nhân vật</h3><p className="text-muted-foreground mb-4">Tạo nhân vật đầu tiên cho tiểu thuyết</p><Button onClick={() => setShowDialog(true)}><Plus className="w-4 h-4 mr-2" /> Tạo nhân vật</Button></CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {safeCharacters.map(char => (
              <Card key={char.id} className="hover:shadow-lg transition-shadow group">
                <CardHeader className="pb-3">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">{char.name[0]}</div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{char.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1 text-xs">{char.role}</Badge>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(char)}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteChar(char.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {char.appearance && <div><span className="font-medium">Ngoại hình:</span> <span className="text-muted-foreground line-clamp-2">{char.appearance}</span></div>}
                  {char.personality && <div><span className="font-medium">Tính cách:</span> <span className="text-muted-foreground line-clamp-2">{char.personality}</span></div>}
                  {char.motivation && <div><span className="font-medium">Động cơ:</span> <span className="text-muted-foreground line-clamp-2">{char.motivation}</span></div>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Relationship Graph Placeholder */}
        <Card className="mt-8">
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Sơ đồ quan hệ</CardTitle></CardHeader>
          <CardContent><div className="h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">Biểu đồ quan hệ nhân vật sẽ hiển thị ở đây (React Flow) - Phase 2</div></CardContent>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Sửa nhân vật' : 'Nhân vật mới'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Tên nhân vật *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <select className="flex h-9 rounded-lg border border-input px-3 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="protagonist">Chính diện</option>
                <option value="antagonist">Phản diện</option>
                <option value="supporting">Phụ</option>
                <option value="minor">Nhỏ</option>
              </select>
            </div>
            <Textarea placeholder="Ngoại hình..." value={form.appearance} onChange={e => setForm({ ...form, appearance: e.target.value })} />
            <Textarea placeholder="Tính cách..." value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} />
            <Textarea placeholder="Lai lịch..." value={form.background} onChange={e => setForm({ ...form, background: e.target.value })} />
            <Textarea placeholder="Động cơ, mục tiêu..." value={form.motivation} onChange={e => setForm({ ...form, motivation: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Hủy</Button>
              <Button onClick={saveCharacter}>{editing ? 'Cập nhật' : 'Tạo'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

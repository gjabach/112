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
import { ArrowLeft, Plus, User, Trash2, Edit3, Search, Sparkles } from 'lucide-react';

interface Character {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  motivation?: string;
  aliases?: string[];
  tags?: string[];
}

const roleConfigs: Record<string, { label: string; color: string; badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  protagonist: { label: '🌟 Nhân vật chính', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', badgeVariant: 'default' },
  antagonist: { label: '⚔️ Phản diện', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30', badgeVariant: 'destructive' },
  supporting: { label: '🤝 Nhân vật phụ', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30', badgeVariant: 'secondary' },
  minor: { label: '👤 Nhân vật quần chúng', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30', badgeVariant: 'outline' }
};

export default function CharactersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [form, setForm] = useState({
    name: '',
    role: 'supporting',
    personality: '',
    background: '',
    appearance: '',
    motivation: ''
  });
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiRole, setAiRole] = useState('protagonist');
  const [aiConcept, setAiConcept] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const handleGenerateCharacter = async () => {
    setAiGenerating(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/characters/generate`, {
        method: 'POST',
        body: JSON.stringify({ role: aiRole, concept: aiConcept })
      });
      if (res?.character) {
        toast.success(`Đã tạo nhân vật "${res.character.name}" thành công!`);
        setShowAIDialog(false);
        setAiConcept('');
        fetchCharacters();
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi tạo nhân vật');
    } finally {
      setAiGenerating(false);
    }
  };

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
        toast.success('Cập nhật nhân vật thành công!');
      } else {
        await apiFetch(`/api/projects/${projectId}/characters`, { method: 'POST', body: JSON.stringify(form) });
        toast.success('Tạo nhân vật mới thành công!');
      }
      setShowDialog(false);
      setEditing(null);
      setForm({ name: '', role: 'supporting', personality: '', background: '', appearance: '', motivation: '' });
      fetchCharacters();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu');
    }
  };

  const deleteChar = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa nhân vật này?')) return;
    try {
      await apiFetch(`/api/characters/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchCharacters();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', role: filterRole !== 'all' ? filterRole : 'supporting', personality: '', background: '', appearance: '', motivation: '' });
    setShowDialog(true);
  };

  const openEdit = (char: Character) => {
    setEditing(char);
    setForm({
      name: char.name || '',
      role: char.role || 'supporting',
      personality: char.personality || '',
      background: char.background || '',
      appearance: char.appearance || '',
      motivation: char.motivation || ''
    });
    setShowDialog(true);
  };

  const safeCharacters = Array.isArray(characters) ? characters : [];
  const filtered = safeCharacters.filter(c => {
    const matchSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.personality || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.background || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.motivation || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || c.role === filterRole;
    return matchSearch && matchRole;
  });

  const getRoleCount = (role: string) => {
    if (role === 'all') return safeCharacters.length;
    return safeCharacters.filter(c => c.role === role).length;
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
                <span>Hồ sơ nhân vật</span>
                <Badge variant="secondary" className="text-xs">{safeCharacters.length} nhân vật</Badge>
              </h1>
              <p className="text-xs text-muted-foreground">Quản lý tính cách, động cơ, ngoại hình và lai lịch</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Tìm nhân vật..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-48"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowAIDialog(true)}>
              <Sparkles className="w-4 h-4 mr-1 text-primary" /> AI Gợi ý
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Thêm nhân vật
            </Button>
          </div>
        </div>

        {/* Role Filters */}
        <div className="px-4 pb-3 max-w-7xl mx-auto flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterRole('all')}
            className={`px-3 py-1 text-xs rounded-full border transition-all ${
              filterRole === 'all' ? 'bg-primary text-primary-foreground font-medium' : 'bg-card hover:bg-muted text-muted-foreground'
            }`}
          >
            Tất cả ({getRoleCount('all')})
          </button>
          {Object.entries(roleConfigs).map(([roleKey, cfg]) => (
            <button
              key={roleKey}
              onClick={() => setFilterRole(roleKey)}
              className={`px-3 py-1 text-xs rounded-full border transition-all whitespace-nowrap ${
                filterRole === roleKey ? 'bg-primary text-primary-foreground font-medium' : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              {cfg.label} ({getRoleCount(roleKey)})
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-16 bg-muted/40" />
                <CardContent className="h-32" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="font-semibold text-lg mb-1">
                {search || filterRole !== 'all' ? 'Không tìm thấy nhân vật phù hợp' : 'Chưa có nhân vật nào'}
              </h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                {search || filterRole !== 'all' ? 'Thử tìm từ khóa khác hoặc bỏ bộ lọc.' : 'Tạo các nhân vật chính diện, phản diện để dẫn dắt câu chuyện của bạn.'}
              </p>
              {!search && filterRole === 'all' && (
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Tạo nhân vật đầu tiên
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(char => {
              const cfg = roleConfigs[char.role] || { label: char.role, color: 'bg-muted text-muted-foreground' };
              const initial = (char.name || '?')[0].toUpperCase();
              return (
                <Card key={char.id} className="hover:shadow-lg transition-all group flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex gap-3 items-start">
                      <div className="w-12 h-12 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{char.name}</CardTitle>
                        <Badge variant="outline" className={`mt-1 text-[11px] font-normal ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(char)}>
                          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteChar(char.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 text-xs text-foreground/80 flex-1">
                    {char.motivation && (
                      <div className="bg-muted/40 p-2 rounded-lg">
                        <span className="font-semibold text-foreground">🎯 Mục tiêu:</span>{' '}
                        <span className="line-clamp-2">{char.motivation}</span>
                      </div>
                    )}
                    {char.personality && (
                      <div>
                        <span className="font-medium text-foreground">✨ Tính cách:</span>{' '}
                        <span className="text-muted-foreground line-clamp-2">{char.personality}</span>
                      </div>
                    )}
                    {char.appearance && (
                      <div>
                        <span className="font-medium text-foreground">👤 Ngoại hình:</span>{' '}
                        <span className="text-muted-foreground line-clamp-2">{char.appearance}</span>
                      </div>
                    )}
                    {char.background && (
                      <div>
                        <span className="font-medium text-foreground">📜 Lai lịch:</span>{' '}
                        <span className="text-muted-foreground line-clamp-2">{char.background}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Chỉnh sửa nhân vật' : 'Thêm nhân vật mới'}</DialogTitle>
            <DialogDescription>Xây dựng chiều sâu tâm lý và hình tượng cho nhân vật</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Tên nhân vật *</label>
                <Input placeholder="Ví dụ: Hoàng Anh, Arthur, Lãnh chúa Vane..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Vai trò trong truyện</label>
                <select className="flex h-9 w-full rounded-lg border border-input px-3 text-sm bg-background" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="protagonist">🌟 Nhân vật chính (Protagonist)</option>
                  <option value="antagonist">⚔️ Phản diện (Antagonist)</option>
                  <option value="supporting">🤝 Nhân vật phụ (Supporting)</option>
                  <option value="minor">👤 Quần chúng (Minor)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Mục tiêu & Động cơ (Động lực hành động lớn nhất)</label>
              <Textarea placeholder="Điều gì thúc đẩy nhân vật này? Trả thù, bảo vệ gia đình, tìm kiếm sự thật, hay giành lấy quyền lực?" value={form.motivation} onChange={e => setForm({ ...form, motivation: e.target.value })} rows={2} />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Tính cách & Điểm yếu</label>
              <Textarea placeholder="Quyết đoán, trầm lặng, đa nghi, dễ xúc động, lòng kiêu hãnh cao..." value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} rows={2} />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Ngoại hình & Nhận diện</label>
              <Textarea placeholder="Chiều cao, vết sẹo, ánh mắt, cách ăn mặc, thói quen cử chỉ..." value={form.appearance} onChange={e => setForm({ ...form, appearance: e.target.value })} rows={2} />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Lai lịch & Quá khứ</label>
              <Textarea placeholder="Xuất thân, biến cố thời thơ ấu, bí mật chưa từng tiết lộ..." value={form.background} onChange={e => setForm({ ...form, background: e.target.value })} rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Hủy</Button>
              <Button onClick={saveCharacter}>{editing ? 'Lưu thay đổi' : 'Tạo nhân vật'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Character Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent onClose={() => setShowAIDialog(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>AI Gợi ý nhân vật mới</span>
            </DialogTitle>
            <DialogDescription>
              Tự động phác thảo hồ sơ nhân vật đầy đủ từ tên, tính cách, động cơ đến ngoại hình
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium block mb-1">Vai trò nhân vật</label>
              <select
                className="flex h-9 w-full rounded-lg border border-input px-3 text-sm bg-background"
                value={aiRole}
                onChange={e => setAiRole(e.target.value)}
              >
                <option value="protagonist">🌟 Nhân vật chính (Protagonist)</option>
                <option value="antagonist">⚔️ Phản diện (Antagonist)</option>
                <option value="supporting">🤝 Nhân vật phụ (Supporting)</option>
                <option value="minor">👤 Quần chúng (Minor)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Ý tưởng / Định hướng ban đầu (không bắt buộc)</label>
              <Textarea
                placeholder="VD: Một kiếm sĩ mù có khả năng nghe được suy nghĩ, hoặc một quý tộc sa cơ muốn báo thù..."
                value={aiConcept}
                onChange={e => setAiConcept(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowAIDialog(false)}>Hủy</Button>
              <Button onClick={handleGenerateCharacter} disabled={aiGenerating}>
                {aiGenerating ? 'Đang tạo...' : 'Tạo nhân vật ngay'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

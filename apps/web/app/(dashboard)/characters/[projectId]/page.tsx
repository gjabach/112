'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Plus, 
  User, 
  Trash2, 
  Edit3, 
  Search, 
  Sparkles, 
  Network, 
  LayoutGrid, 
  Table as TableIcon,
  Mic2,
  Heart,
  Eye,
  Shield,
  Sword,
  Lock,
  Brain
} from 'lucide-react';
import { RelationshipWeb } from '@/components/characters/relationship-web';
import { CharacterDossierDialog } from '@/components/characters/character-dossier-dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface Relationship {
  characterId: string;
  type: string;
  description: string;
}

interface Character {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  age?: string;
  gender?: string;
  occupation?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  speechPattern?: string;
  motivation?: string;
  desires?: string;
  characterArc?: string;
  secrets?: string;
  fears?: string;
  weaknesses?: string;
  strengths?: string;
  relationships?: Relationship[];
  aliases?: string[];
  tags?: string[];
  customFields?: Record<string, string>;
}

const roleConfigs: Record<string, { label: string; color: string; border: string; glow: string }> = {
  protagonist: {
    label: '🌟 Nhân vật chính',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    border: 'border-amber-500/40',
    glow: 'hover:shadow-amber-500/15'
  },
  antagonist: {
    label: '⚔️ Phản diện',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    border: 'border-red-500/40',
    glow: 'hover:shadow-red-500/15'
  },
  supporting: {
    label: '🤝 Nhân vật phụ',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/40',
    glow: 'hover:shadow-blue-500/15'
  },
  minor: {
    label: '👤 Quần chúng',
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    border: 'border-slate-500/40',
    glow: 'hover:shadow-slate-500/15'
  }
};

export default function CharactersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'web' | 'table'>('grid');

  // Dossier Dialog state
  const [showDossier, setShowDossier] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [savingDossier, setSavingDossier] = useState(false);

  // AI Dialog state
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiRole, setAiRole] = useState('protagonist');
  const [aiConcept, setAiConcept] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

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

  const handleSaveDossier = async (formData: Partial<Character>) => {
    setSavingDossier(true);
    try {
      if (selectedCharacter?.id) {
        await apiFetch(`/api/characters/${selectedCharacter.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData)
        });
        toast.success(`Đã cập nhật hồ sơ "${formData.name}" thành công!`);
      } else {
        await apiFetch(`/api/projects/${projectId}/characters`, {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        toast.success(`Đã tạo nhân vật "${formData.name}" thành công!`);
      }
      setShowDossier(false);
      setSelectedCharacter(null);
      fetchCharacters();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu hồ sơ');
    } finally {
      setSavingDossier(false);
    }
  };

  const handleDeleteChar = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân vật "${name}" khỏi tác phẩm?`)) return;
    try {
      await apiFetch(`/api/characters/${id}`, { method: 'DELETE' });
      toast.success(`Đã xóa nhân vật "${name}"`);
      fetchCharacters();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleGenerateCharacter = async () => {
    setAiGenerating(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/characters/generate`, {
        method: 'POST',
        body: JSON.stringify({ role: aiRole, concept: aiConcept })
      });
      if (res?.character) {
        toast.success(`AI đã kiến tạo thành công nhân vật "${res.character.name}"!`);
        setShowAIDialog(false);
        setAiConcept('');
        fetchCharacters();
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi sinh nhân vật');
    } finally {
      setAiGenerating(false);
    }
  };

  const openCreate = () => {
    setSelectedCharacter(null);
    setShowDossier(true);
  };

  const openEdit = (char: Character) => {
    setSelectedCharacter(char);
    setShowDossier(true);
  };

  const safeCharacters = Array.isArray(characters) ? characters : [];
  const filtered = safeCharacters.filter(c => {
    const matchSearch =
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.personality || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.background || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.motivation || '').toLowerCase().includes(search.toLowerCase()) ||
      (Array.isArray(c.aliases) && c.aliases.some((a: string) => a.toLowerCase().includes(search.toLowerCase())));
    const matchRole = filterRole === 'all' || c.role === filterRole;
    return matchSearch && matchRole;
  });

  const getRoleCount = (role: string) => {
    if (role === 'all') return safeCharacters.length;
    return safeCharacters.filter(c => c.role === role).length;
  };

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-clip pb-12">
      {/* Top Header */}
      <header className="border-b bg-card/95 backdrop-blur-md sticky top-0 z-20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href={`/editor/${projectId}`} className="shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg flex items-center gap-2 truncate">
                <span className="truncate">Hồ Sơ Nhân Vật</span>
                <span className="hidden sm:inline text-xs text-muted-foreground font-normal">(Character Bible)</span>
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 shrink-0 font-normal">
                  {safeCharacters.length} nhân vật
                </Badge>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Xây dựng chiều sâu tâm lý, mâu thuẫn nội tâm, động cơ và mạng lưới quan hệ
              </p>
            </div>
          </div>

          {/* Action Buttons & View Mode */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/60">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('grid')}
                title="Lưới thẻ nhân vật"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Thẻ</span>
              </Button>
              <Button
                variant={viewMode === 'web' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('web')}
                title="Sơ đồ mạng lưới quan hệ"
              >
                <Network className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Sơ đồ quan hệ</span>
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('table')}
                title="Chế độ bảng tóm lược"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Bảng</span>
              </Button>
            </div>

            {/* AI Generator Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
              onClick={() => setShowAIDialog(true)}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">AI Tạo nhân vật</span>
            </Button>

            {/* Create Character Button */}
            <Button size="sm" onClick={openCreate} className="h-8 text-xs font-semibold shadow-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Thêm nhân vật</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4">
        {/* Filters and Search Toolbar (for grid and table views) */}
        {viewMode !== 'web' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60 shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm nhân vật theo tên, biệt danh, tính cách..."
                className="h-9 text-xs pl-9 bg-muted/20"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'protagonist', label: '🌟 Chính' },
                { id: 'antagonist', label: '⚔️ Phản diện' },
                { id: 'supporting', label: '🤝 Phụ' },
                { id: 'minor', label: '👤 Quần chúng' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setFilterRole(r.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                    filterRole === r.id
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span>{r.label}</span>
                  <span className="text-[10px] opacity-80">({getRoleCount(r.id)})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 1: HERO CARDS GRID */}
        {viewMode === 'grid' && (
          <div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-56 rounded-2xl bg-muted/40 animate-pulse border" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/10 space-y-3">
                <User className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                <h3 className="font-semibold text-sm">Chưa có nhân vật nào</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Hãy thêm nhân vật đầu tiên để thổi hồn vào thế giới tiểu thuyết của bạn!
                </p>
                <Button size="sm" onClick={openCreate} className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tạo nhân vật ngay
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filtered.map(char => {
                    const cfg = roleConfigs[char.role] || roleConfigs.supporting;
                    const relationships = Array.isArray(char.relationships) ? char.relationships : [];
                    return (
                      <motion.div
                        key={char.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`rounded-2xl border ${cfg.border} bg-card p-4 transition-all duration-200 shadow-sm hover:shadow-lg ${cfg.glow} flex flex-col justify-between group`}
                      >
                        <div className="space-y-3">
                          {/* Card Top: Avatar, Name, Role badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-bold text-lg text-primary border shadow-xs shrink-0 group-hover:scale-105 transition-transform font-serif">
                                {char.name?.[0]?.toUpperCase() || 'N'}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                                  {char.name}
                                </h3>
                                {char.aliases && char.aliases.length > 0 && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    Biệt danh: {char.aliases.join(', ')}
                                  </p>
                                )}
                                {(char.age || char.occupation) && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                    {[char.age, char.occupation].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </div>
                            </div>

                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 shrink-0 ${cfg.color}`}>
                              {cfg.label}
                            </Badge>
                          </div>

                          {/* Appearance / Trait Quote */}
                          {(char.appearance || char.personality) && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/20 p-2 rounded-xl">
                              {char.personality || char.appearance}
                            </p>
                          )}

                          {/* Want vs Need Preview */}
                          {(char.desires || char.characterArc) && (
                            <div className="space-y-1 text-[11px] pt-1">
                              {char.desires && (
                                <div className="truncate">
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">Khát vọng: </span>
                                  <span className="text-muted-foreground">{char.desires}</span>
                                </div>
                              )}
                              {char.characterArc && (
                                <div className="truncate">
                                  <span className="font-semibold text-blue-600 dark:text-blue-400">Bài học: </span>
                                  <span className="text-muted-foreground">{char.characterArc}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Speech Pattern preview */}
                          {char.speechPattern && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 italic">
                              <Mic2 className="w-3 h-3 text-primary shrink-0" />
                              <span className="truncate">&quot;{char.speechPattern}&quot;</span>
                            </div>
                          )}

                          {/* Relationships badge summary */}
                          {relationships.length > 0 && (
                            <div className="flex items-center gap-1 pt-1 overflow-x-auto no-scrollbar">
                              <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                                <Heart className="w-3 h-3 text-pink-500" /> {relationships.length} quan hệ:
                              </span>
                              {relationships.slice(0, 3).map((r, idx) => {
                                const target = safeCharacters.find(c => c.id === r.characterId);
                                return (
                                  <Badge key={idx} variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 font-normal">
                                    {target?.name || 'Nhân vật'}
                                  </Badge>
                                );
                              })}
                              {relationships.length > 3 && (
                                <span className="text-[9px] text-muted-foreground">+{relationships.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card Footer Actions */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-primary font-medium px-2"
                            onClick={() => openEdit(char)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Chi tiết hồ sơ
                          </Button>

                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEdit(char)}
                              title="Chỉnh sửa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteChar(char.id, char.name)}
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: INTERACTIVE RELATIONSHIP WEB */}
        {viewMode === 'web' && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <RelationshipWeb characters={safeCharacters} onSelectCharacter={openEdit} />
          </div>
        )}

        {/* VIEW 3: TABLE VIEW */}
        {viewMode === 'table' && (
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs animate-in fade-in duration-150">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">Nhân vật</th>
                    <th className="p-3">Vai trò</th>
                    <th className="p-3">Tuổi & Nghề</th>
                    <th className="p-3">Khát vọng (The Want)</th>
                    <th className="p-3">Mối quan hệ</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map(char => (
                    <tr key={char.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-bold text-xs border shrink-0">
                            {char.name?.[0]?.toUpperCase() || 'N'}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">{char.name}</span>
                            {char.aliases && char.aliases.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">({char.aliases.join(', ')})</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleConfigs[char.role]?.color || ''}`}>
                          {roleConfigs[char.role]?.label || char.role}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {[char.age, char.occupation].filter(Boolean).join(' • ') || '—'}
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-muted-foreground">
                        {char.desires || char.motivation || '—'}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {(char.relationships || []).length} liên kết
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(char)}>
                            Sửa
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteChar(char.id, char.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Character Dossier Dialog */}
      <CharacterDossierDialog
        isOpen={showDossier}
        onClose={() => {
          setShowDossier(false);
          setSelectedCharacter(null);
        }}
        character={selectedCharacter}
        allCharacters={safeCharacters}
        onSave={handleSaveDossier}
        loading={savingDossier}
      />

      {/* AI Persona Generator Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" /> AI Kiến Tạo Nhân Vật Đa Chiều
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sinh nhân vật có mâu thuẫn nội tâm, động cơ rõ ràng và giọng điệu thoại đặc trưng
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs pt-2">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Vai trò trong tác phẩm</label>
              <select
                className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
                value={aiRole}
                onChange={e => setAiRole(e.target.value)}
              >
                <option value="protagonist">🌟 Nhân vật chính (Protagonist)</option>
                <option value="antagonist">⚔️ Phản diện đầy chiều sâu (Antagonist)</option>
                <option value="supporting">🤝 Đồng minh / Nhân vật phụ quan trọng (Supporting)</option>
                <option value="minor">👤 Nhân vật quần chúng đặc sắc (Minor)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Ý tưởng hoặc hình mẫu nhân vật (Tùy chọn)</label>
              <Input
                placeholder="Ví dụ: Kiếm sĩ mù mang nợ ân tình, pháp sư lưu vong phản nghịch..."
                value={aiConcept}
                onChange={e => setAiConcept(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setShowAIDialog(false)} className="text-xs h-8">
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateCharacter}
              disabled={aiGenerating}
              className="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {aiGenerating ? 'Đang sáng tạo...' : 'Kiến Tạo Ngay'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

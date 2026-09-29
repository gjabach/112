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
  Globe, 
  Search, 
  Sparkles, 
  LayoutGrid, 
  FolderTree, 
  Trash2, 
  Edit3, 
  Eye,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { LoreCodexCard } from '@/components/worldbuilding/lore-codex-card';
import { LoreDetailDialog } from '@/components/worldbuilding/lore-detail-dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface Entity {
  id: string;
  projectId?: string;
  name: string;
  type: string;
  description?: string;
  attributes?: Record<string, string>;
  imageUrl?: string;
  relatedEntityIds?: string[];
  tags?: string[];
}

const types = [
  { id: 'all', label: 'Tất cả', icon: '🌐' },
  { id: 'location', label: 'Địa danh', icon: '🏰' },
  { id: 'organization', label: 'Phe phái', icon: '🏛️' },
  { id: 'magic_system', label: 'Ma pháp / Kỹ thuật', icon: '✨' },
  { id: 'species', label: 'Chủng tộc', icon: '🧝' },
  { id: 'item', label: 'Báu vật', icon: '🗡️' },
  { id: 'religion', label: 'Tín ngưỡng', icon: '🕊️' },
  { id: 'event', label: 'Lịch sử', icon: '📜' }
];

export default function WorldbuildingPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');

  // Dialog states
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [savingEntity, setSavingEntity] = useState(false);

  // AI Generator state
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiType, setAiType] = useState('location');
  const [aiConcept, setAiConcept] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (projectId) fetchEntities();
  }, [projectId, filter]);

  const fetchEntities = async () => {
    try {
      const query = filter === 'all' ? '' : `?type=${filter}`;
      const res = await apiFetch(`/api/projects/${projectId}/entities${query}`);
      const list = Array.isArray(res?.entities) ? res.entities : (Array.isArray(res?.items) ? res.items : []);
      setEntities(list);
    } catch (e: any) {
      setEntities([]);
      toast.error(e.message || 'Lỗi tải dữ liệu thế giới');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntity = async (formData: Partial<Entity>) => {
    setSavingEntity(true);
    try {
      if (selectedEntity?.id) {
        await apiFetch(`/api/entities/${selectedEntity.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData)
        });
        toast.success(`Đã cập nhật thực thể "${formData.name}" thành công!`);
      } else {
        await apiFetch(`/api/projects/${projectId}/entities`, {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        toast.success(`Đã tạo thực thể "${formData.name}" thành công!`);
      }
      setShowDetailDialog(false);
      setSelectedEntity(null);
      fetchEntities();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu');
    } finally {
      setSavingEntity(false);
    }
  };

  const handleDeleteEntity = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa thực thể "${name}" khỏi bách khoa toàn thư?`)) return;
    try {
      await apiFetch(`/api/entities/${id}`, { method: 'DELETE' });
      toast.success(`Đã xóa "${name}"`);
      fetchEntities();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleGenerateLore = async () => {
    setAiGenerating(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/entities/generate`, {
        method: 'POST',
        body: JSON.stringify({ type: aiType, concept: aiConcept })
      });
      if (res?.entity) {
        toast.success(`AI đã kiến tạo thực thể "${res.entity.name}" thành công!`);
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

  const openCreate = () => {
    setSelectedEntity(null);
    setShowDetailDialog(true);
  };

  const openEdit = (e: Entity) => {
    setSelectedEntity(e);
    setShowDetailDialog(true);
  };

  const safeEntities = Array.isArray(entities) ? entities : [];
  const filteredEntities = safeEntities.filter(e => {
    const matchSearch =
      (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.attributes && Object.values(e.attributes).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
    const matchType = filter === 'all' || e.type === filter;
    return matchSearch && matchType;
  });

  const getCountByType = (typeId: string) => {
    if (typeId === 'all') return safeEntities.length;
    return safeEntities.filter(e => e.type === typeId).length;
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
                <span className="truncate">Bách Khoa Toàn Thư Thế Giới</span>
                <span className="hidden sm:inline text-xs text-muted-foreground font-normal">(Worldbuilding Codex)</span>
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal shrink-0">
                  {safeEntities.length} mục
                </Badge>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Thiết lập quy luật địa lý, phe phái, ma pháp, chủng tộc, báu vật và lịch sử
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/60">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('grid')}
                title="Lưới thẻ bách khoa"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Thẻ</span>
              </Button>
              <Button
                variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('tree')}
                title="Thư mục phân cấp"
              >
                <FolderTree className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden md:inline">Thư mục</span>
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
              <span className="hidden sm:inline">AI Tạo Lore</span>
            </Button>

            {/* Create Entity Button */}
            <Button size="sm" onClick={openCreate} className="h-8 text-xs font-semibold shadow-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Thêm thực thể</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4">
        {/* Search & Category Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60 shadow-xs">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm địa danh, ma pháp, thế lực, thuộc tính..."
              className="h-9 text-xs pl-9 bg-muted/20"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {types.map(t => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`text-xs px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                  filter === t.id
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                <span className="text-[10px] opacity-80">({getCountByType(t.id)})</span>
              </button>
            ))}
          </div>
        </div>

        {/* VIEW 1: CODEX CARDS GRID */}
        {viewMode === 'grid' && (
          <div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-56 rounded-2xl bg-muted/40 animate-pulse border" />
                ))}
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/10 space-y-3">
                <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                <h3 className="font-semibold text-sm">Chưa có thực thể nào</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Hãy xây dựng các địa danh kỳ bí, thế lực ngầm hay hệ thống ma thuật độc đáo cho tiểu thuyết!
                </p>
                <Button size="sm" onClick={openCreate} className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Thêm thực thể ngay
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredEntities.map(ent => (
                    <LoreCodexCard
                      key={ent.id}
                      entity={ent}
                      onOpenDetail={openEdit}
                      onEdit={openEdit}
                      onDelete={handleDeleteEntity}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: CATEGORIZED DIRECTORY TREE */}
        {viewMode === 'tree' && (
          <div className="space-y-4">
            {types.filter(t => t.id !== 'all').map(cat => {
              const catEntities = filteredEntities.filter(e => e.type === cat.id);
              if (catEntities.length === 0 && filter !== 'all') return null;

              return (
                <div key={cat.id} className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
                  <div className="p-3 bg-muted/30 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat.icon}</span>
                      <h3 className="font-bold text-sm text-foreground">{cat.label}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {catEntities.length} mục
                    </Badge>
                  </div>

                  <div className="divide-y divide-border/40">
                    {catEntities.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Chưa có mục nào trong danh mục này.
                      </div>
                    ) : (
                      catEntities.map(ent => (
                        <div
                          key={ent.id}
                          onClick={() => openEdit(ent)}
                          className="p-3 hover:bg-muted/20 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                                {ent.name}
                              </span>
                              {ent.attributes && Object.keys(ent.attributes).length > 0 && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                  {Object.keys(ent.attributes).length} thuộc tính
                                </Badge>
                              )}
                            </div>
                            {ent.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {ent.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEntity(ent.id, ent.name);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lore Detail & Edit Dialog */}
      <LoreDetailDialog
        isOpen={showDetailDialog}
        onClose={() => {
          setShowDetailDialog(false);
          setSelectedEntity(null);
        }}
        entity={selectedEntity}
        onSave={handleSaveEntity}
        loading={savingEntity}
      />

      {/* AI Lore Generator Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" /> AI Kiến Tạo Thiết Lập Thế Giới
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sinh bối cảnh, quy luật ma pháp hay điển tích lịch sử có tính nhất quán cao
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs pt-2">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Phân loại thực thể</label>
              <select
                className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
                value={aiType}
                onChange={e => setAiType(e.target.value)}
              >
                <option value="location">🏰 Địa danh & Lãnh thổ</option>
                <option value="organization">🏛️ Phe phái & Bang hội</option>
                <option value="magic_system">✨ Hệ thống ma pháp / Khoa học</option>
                <option value="species">🧝 Chủng tộc & Sinh vật huyền bí</option>
                <option value="item">🗡️ Báu vật & Pháp bảo cấp sử thi</option>
                <option value="religion">🕊️ Tín ngưỡng & Giáo phái cổ</option>
                <option value="event">📜 Biến cố & Điển tích lịch sử</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Ý tưởng hoặc tiền đề (Tùy chọn)</label>
              <Input
                placeholder="Ví dụ: Pháo đài bay lơ lửng bằng đá phản trọng lực, giáo hội tôn thờ sao băng..."
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
              onClick={handleGenerateLore}
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

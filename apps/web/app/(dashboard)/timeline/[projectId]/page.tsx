'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Plus, 
  Clock, 
  Search, 
  Sparkles, 
  GitFork, 
  Milestone, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  Users,
  Filter
} from 'lucide-react';
import { InteractiveTimelineTrack } from '@/components/timeline/interactive-timeline-track';
import { ParallelTracksView } from '@/components/timeline/parallel-tracks-view';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineEvent {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  dateInStory?: string;
  dateRealWorld?: string;
  era?: string;
  importance: 'major' | 'minor' | 'turning_point' | 'flashback' | string;
  involvedCharacterIds?: string[];
  locationId?: string;
  chapterId?: string;
  orderIndex?: number;
}

export default function TimelinePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [eras, setEras] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<'track' | 'parallel'>('track');

  // Filters
  const [filterEra, setFilterEra] = useState('all');
  const [filterImportance, setFilterImportance] = useState('all');
  const [filterCharacter, setFilterCharacter] = useState('all');
  const [search, setSearch] = useState('');

  // Event Edit / Create Dialog
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    dateInStory: '',
    dateRealWorld: '',
    era: '',
    importance: 'minor',
    involvedCharacterIds: [] as string[],
    chapterId: ''
  });

  // AI Chrono Audit Dialog
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiCheck, setAiCheck] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchTimeline();
      fetchCharactersAndChapters();
    }
  }, [projectId, filterEra, filterImportance]);

  const fetchTimeline = async () => {
    try {
      const query = new URLSearchParams();
      if (filterEra !== 'all') query.set('era', filterEra);
      if (filterImportance !== 'all') query.set('importance', filterImportance);

      const res = await apiFetch(`/api/projects/${projectId}/timeline?${query.toString()}`);
      setEvents(Array.isArray(res?.events) ? res.events : []);
      setEras(Array.isArray(res?.eras) ? res.eras : []);
      setStats(res?.stats || { total: 0, major: 0, minor: 0, eras: 0 });
    } catch (e: any) {
      setEvents([]);
      setEras([]);
      setStats({ total: 0, major: 0, minor: 0, eras: 0 });
      toast.error(e.message || 'Lỗi tải timeline');
    } finally {
      setLoading(false);
    }
  };

  const fetchCharactersAndChapters = async () => {
    try {
      const [charRes, chapRes] = await Promise.all([
        apiFetch(`/api/projects/${projectId}/characters`).catch(() => ({ characters: [] })),
        apiFetch(`/api/projects/${projectId}/chapters`).catch(() => ({ chapters: [] }))
      ]);
      setCharacters(Array.isArray(charRes?.characters) ? charRes.characters : []);
      setChapters(Array.isArray(chapRes?.chapters) ? chapRes.chapters : []);
    } catch {}
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) {
      toast.error('Nhập tiêu đề sự kiện');
      return;
    }
    try {
      if (editingEvent?.id) {
        await apiFetch(`/api/timeline/${editingEvent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(eventForm)
        });
        toast.success('Đã cập nhật sự kiện thành công!');
      } else {
        await apiFetch(`/api/projects/${projectId}/timeline`, {
          method: 'POST',
          body: JSON.stringify(eventForm)
        });
        toast.success('Đã thêm sự kiện mới vào dòng thời gian!');
      }
      setShowEventDialog(false);
      setEditingEvent(null);
      fetchTimeline();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu');
    }
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc muốn xóa sự kiện "${title}"?`)) return;
    try {
      await apiFetch(`/api/timeline/${id}`, { method: 'DELETE' });
      toast.success(`Đã xóa "${title}"`);
      fetchTimeline();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openCreateEvent = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      description: '',
      dateInStory: '',
      dateRealWorld: '',
      era: eras[0] || '',
      importance: 'minor',
      involvedCharacterIds: [],
      chapterId: ''
    });
    setShowEventDialog(true);
  };

  const openEditEvent = (ev: TimelineEvent) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title || '',
      description: ev.description || '',
      dateInStory: ev.dateInStory || '',
      dateRealWorld: ev.dateRealWorld || '',
      era: ev.era || '',
      importance: ev.importance || 'minor',
      involvedCharacterIds: Array.isArray(ev.involvedCharacterIds) ? ev.involvedCharacterIds : [],
      chapterId: ev.chapterId || ''
    });
    setShowEventDialog(true);
  };

  const runChronoAudit = async () => {
    setAiLoading(true);
    setShowAIDialog(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/timeline/check`, { method: 'POST' });
      setAiCheck(res?.check || { summary: 'Dòng thời gian liền mạch, logic.', issues: [] });
    } catch (e: any) {
      toast.error(e.message || 'Lỗi kiểm tra');
    } finally {
      setAiLoading(false);
    }
  };

  const safeEvents = Array.isArray(events) ? events : [];
  const filteredEvents = safeEvents.filter(e => {
    const matchSearch =
      (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.dateInStory || '').toLowerCase().includes(search.toLowerCase());
    const matchChar = filterCharacter === 'all' ||
      (Array.isArray(e.involvedCharacterIds) && e.involvedCharacterIds.includes(filterCharacter));
    return matchSearch && matchChar;
  });

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
                <span className="truncate">Dòng Thời Gian Tác Phẩm</span>
                <span className="hidden sm:inline text-xs text-muted-foreground font-normal">(Story Chrono-Timeline)</span>
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal shrink-0">
                  {safeEvents.length} sự kiện
                </Badge>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Theo dõi diễn biến lịch sử, ngày tháng câu chuyện, kiểm tra nghịch lý và phân nhánh đa tuyến
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/60">
              <Button
                variant={viewMode === 'track' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('track')}
                title="Trục phát sáng Chrono-Track"
              >
                <Milestone className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Trục phát sáng</span>
              </Button>
              <Button
                variant={viewMode === 'parallel' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                onClick={() => setViewMode('parallel')}
                title="Theo dõi đa tuyến song song"
              >
                <GitFork className="w-3.5 h-3.5 text-purple-500" />
                <span className="hidden md:inline">Đa tuyến</span>
              </Button>
            </div>

            {/* AI Chrono Audit Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
              onClick={runChronoAudit}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Kiểm tra logic</span>
            </Button>

            {/* Create Event Button */}
            <Button size="sm" onClick={openCreateEvent} className="h-8 text-xs font-semibold shadow-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Thêm sự kiện</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm sự kiện theo tên, ngày tháng, nội dung..."
              className="h-9 text-xs pl-9 bg-muted/20"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Importance Filter */}
            <select
              value={filterImportance}
              onChange={e => setFilterImportance(e.target.value)}
              className="h-8 border rounded-xl bg-background px-2.5 text-xs"
            >
              <option value="all">Tất cả tầm quan trọng</option>
              <option value="major">👑 Đại sự kiện / Cao trào</option>
              <option value="turning_point">⚡ Bước ngoặt cốt truyện</option>
              <option value="minor">📖 Diễn biến thường</option>
              <option value="flashback">⏳ Hồi tưởng / Tiền truyện</option>
            </select>

            {/* Character Filter */}
            <select
              value={filterCharacter}
              onChange={e => setFilterCharacter(e.target.value)}
              className="h-8 border rounded-xl bg-background px-2.5 text-xs"
            >
              <option value="all">Tất cả nhân vật ({characters.length})</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>
                  👤 {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* VIEW 1: INTERACTIVE GLOWING CHRONO-TRACK */}
        {viewMode === 'track' && (
          <div>
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">
                Đang tải dòng thời gian...
              </div>
            ) : (
              <InteractiveTimelineTrack
                events={filteredEvents}
                characters={characters}
                projectId={projectId}
                onEdit={openEditEvent}
                onDelete={handleDeleteEvent}
              />
            )}
          </div>
        )}

        {/* VIEW 2: MULTI-TRACK PARALLEL SUBPLOTS */}
        {viewMode === 'parallel' && (
          <div>
            <ParallelTracksView
              events={filteredEvents}
              characters={characters}
              projectId={projectId}
              onEdit={openEditEvent}
              onDelete={handleDeleteEvent}
            />
          </div>
        )}
      </main>

      {/* Event Edit / Create Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-md p-5 rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>{editingEvent ? 'Chỉnh Sửa Sự Kiện' : 'Thêm Sự Kiện Vào Dòng Thời Gian'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ghi lại mốc thời gian, các nhân vật tham gia và liên kết với chương truyện
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs pt-2">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Tiêu đề sự kiện *</label>
              <Input
                value={eventForm.title}
                onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Ví dụ: Đại chiến Hắc Sơn, Đêm trăng máu, Lễ thức tỉnh linh hồn..."
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Thời điểm trong truyện</label>
                <Input
                  value={eventForm.dateInStory}
                  onChange={e => setEventForm({ ...eventForm, dateInStory: e.target.value })}
                  placeholder="Ví dụ: Năm 104, Ngày 15 tháng 3..."
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Kỷ nguyên (Era)</label>
                <Input
                  value={eventForm.era}
                  onChange={e => setEventForm({ ...eventForm, era: e.target.value })}
                  placeholder="Ví dụ: Thời Kỳ Hỗn Mang, Triều Đại Thứ Ba..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Tầm quan trọng</label>
              <select
                value={eventForm.importance}
                onChange={e => setEventForm({ ...eventForm, importance: e.target.value })}
                className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
              >
                <option value="major">👑 Đại sự kiện / Cao trào (Major Climax)</option>
                <option value="turning_point">⚡ Bước ngoặt cốt truyện (Turning Point)</option>
                <option value="minor">📖 Diễn biến thường (Minor Scene)</option>
                <option value="flashback">⏳ Tiền truyện / Hồi tưởng (Flashback)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Chương liên kết (Tùy chọn)</label>
              <select
                value={eventForm.chapterId}
                onChange={e => setEventForm({ ...eventForm, chapterId: e.target.value })}
                className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
              >
                <option value="">-- Chưa gắn với chương nào --</option>
                {chapters.map((ch, idx) => (
                  <option key={ch.id} value={ch.id}>
                    Chương {idx + 1}: {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Nhân vật tham gia</label>
              <div className="border rounded-lg p-2 max-h-28 overflow-y-auto space-y-1 bg-muted/15">
                {characters.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground">Chưa có nhân vật nào trong dự án.</span>
                ) : (
                  characters.map(c => {
                    const isChecked = eventForm.involvedCharacterIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setEventForm(prev => ({
                                ...prev,
                                involvedCharacterIds: [...prev.involvedCharacterIds, c.id]
                              }));
                            } else {
                              setEventForm(prev => ({
                                ...prev,
                                involvedCharacterIds: prev.involvedCharacterIds.filter(id => id !== c.id)
                              }));
                            }
                          }}
                          className="rounded"
                        />
                        <span>{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">({c.role})</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Mô tả diễn biến</label>
              <Textarea
                value={eventForm.description}
                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Nguyên nhân, diễn biến và hậu quả của sự kiện đối với các nhân vật..."
                className="min-h-[85px] text-xs leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setShowEventDialog(false)} className="text-xs h-8">
              Hủy
            </Button>
            <Button size="sm" onClick={handleSaveEvent} className="text-xs h-8 font-semibold">
              Lưu Sự Kiện
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Chrono Audit Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" /> Kiểm Tra Logic Dòng Thời Gian
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              AI phân tích tính nhất quán, phát hiện xung đột thời gian và liên kết nhân vật
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs pt-2">
            {aiLoading ? (
              <div className="py-8 text-center text-muted-foreground animate-pulse">
                Đang đối chiếu các mốc thời gian và sự kiện...
              </div>
            ) : aiCheck ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-foreground leading-relaxed">
                  {aiCheck.summary}
                </div>

                {Array.isArray(aiCheck.issues) && aiCheck.issues.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Điểm cần lưu ý:
                    </span>
                    {aiCheck.issues.map((issue: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                        <p className="font-medium text-foreground">{issue.description}</p>
                        {issue.suggestion && (
                          <p className="text-[11px] text-muted-foreground italic">
                            💡 Gợi ý: {issue.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end pt-3 border-t">
            <Button size="sm" onClick={() => setShowAIDialog(false)} className="text-xs h-8">
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

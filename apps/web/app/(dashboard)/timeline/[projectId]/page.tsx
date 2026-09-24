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
import { TimelineEvent } from '@/components/timeline/timeline-event';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Clock, Filter, Search, Sparkles, Calendar, Trash2, Flag, User } from 'lucide-react';

export default function TimelinePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [events, setEvents] = useState<any[]>([]);
  const [eras, setEras] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterEra, setFilterEra] = useState('all');
  const [filterImportance, setFilterImportance] = useState('all');
  const [filterCharacter, setFilterCharacter] = useState('all');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState<'all' | 'era' | 'year' | 'month'>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dateInStory: '',
    dateRealWorld: '',
    era: '',
    importance: 'minor',
    involvedCharacterIds: [] as string[],
    locationId: '',
    chapterId: ''
  });
  const [aiCheck, setAiCheck] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);

  useEffect(() => {
    if (projectId) {
      fetchTimeline();
      fetchCharacters();
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

  const fetchCharacters = async () => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/characters`);
      setCharacters(Array.isArray(res?.characters) ? res.characters : []);
    } catch {
      setCharacters([]);
    }
  };

  const saveEvent = async () => {
    if (!form.title.trim()) { toast.error('Nhập tiêu đề sự kiện'); return; }
    try {
      if (editingEvent) {
        await apiFetch(`/api/timeline/${editingEvent.id}`, { method: 'PATCH', body: JSON.stringify(form) });
        toast.success('Cập nhật sự kiện');
      } else {
        await apiFetch(`/api/projects/${projectId}/timeline`, { method: 'POST', body: JSON.stringify(form) });
        toast.success('Tạo sự kiện mới');
      }
      setShowNewDialog(false);
      setEditingEvent(null);
      setForm({ title: '', description: '', dateInStory: '', dateRealWorld: '', era: '', importance: 'minor', involvedCharacterIds: [], locationId: '', chapterId: '' });
      fetchTimeline();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Xóa sự kiện này?')) return;
    try {
      await apiFetch(`/api/timeline/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchTimeline();
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (event: any) => {
    setEditingEvent(event);
    setForm({
      title: event.title || '',
      description: event.description || '',
      dateInStory: event.dateInStory || '',
      dateRealWorld: event.dateRealWorld || '',
      era: event.era || '',
      importance: event.importance || 'minor',
      involvedCharacterIds: Array.isArray(event.involvedCharacterIds) ? event.involvedCharacterIds : [],
      locationId: event.locationId || '',
      chapterId: event.chapterId || ''
    });
    setShowNewDialog(true);
  };

  const checkTimeline = async () => {
    setAiLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/timeline/check`, { method: 'POST' });
      setAiCheck(res.check || { summary: 'Dòng thời gian hợp lý, không có xung đột.', issues: [] });
      toast.success('AI đã kiểm tra xong');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const safeEvents = Array.isArray(events) ? events : [];
  const safeEras = Array.isArray(eras) ? eras : [];
  const safeCharacters = Array.isArray(characters) ? characters : [];

  const charactersMap = safeCharacters.reduce((acc: Record<string, string>, c: any) => {
    if (c?.id && c?.name) acc[c.id] = c.name;
    return acc;
  }, {});

  const filteredEvents = safeEvents.filter(e => {
    const matchesSearch = (e?.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (e?.description && e.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCharacter = filterCharacter === 'all' ||
      (Array.isArray(e?.involvedCharacterIds) && e.involvedCharacterIds.includes(filterCharacter));
    return matchesSearch && matchesCharacter;
  });

  // Group by era for zoom=era
  const groupedByEra = safeEras.length > 0 ? safeEras.map(era => ({
    era,
    events: filteredEvents.filter((e: any) => e.era === era)
  })) : [{ era: 'Chưa phân loại', events: filteredEvents }];

  if (loading) return <div className="p-8">Đang tải timeline...</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-4 p-3 max-w-6xl mx-auto w-full">
          <Link href={`/editor/${projectId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> Dòng thời gian</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{stats?.total || 0} sự kiện</span>
              <span>•</span>
              <span>{stats?.major || 0} quan trọng</span>
              <span>•</span>
              <span>{stats?.eras || 0} kỷ nguyên</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1">
              <Button variant={zoom === 'all' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setZoom('all')}>Tất cả</Button>
              <Button variant={zoom === 'era' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setZoom('era')}>Theo kỷ nguyên</Button>
            </div>
            <Button variant="outline" size="sm" onClick={checkTimeline} disabled={aiLoading}><Sparkles className="w-3 h-3 mr-1" /> {aiLoading ? 'Đang check...' : 'AI Check'}</Button>
            <Button size="sm" onClick={() => { setEditingEvent(null); setForm({ title: '', description: '', dateInStory: '', dateRealWorld: '', era: '', importance: 'minor', involvedCharacterIds: [], locationId: '', chapterId: '' }); setShowNewDialog(true); }}><Plus className="w-3 h-3 mr-1" /> Sự kiện</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Sidebar filters */}
        <aside className="w-64 border-r bg-card p-4 hidden md:block">
          <div className="space-y-6">
            <div>
              <label className="text-xs font-medium mb-2 block">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input placeholder="Tìm sự kiện..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-2 block flex items-center gap-1"><Filter className="w-3 h-3" /> Kỷ nguyên</label>
              <div className="space-y-1">
                <button onClick={() => setFilterEra('all')} className={`w-full text-left px-2 py-1 rounded text-xs ${filterEra === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Tất cả ({safeEvents.length})</button>
                {safeEras.map(era => (
                  <button key={era} onClick={() => setFilterEra(era)} className={`w-full text-left px-2 py-1 rounded text-xs ${filterEra === era ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{era}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-2 block">Mức độ</label>
              <div className="space-y-1">
                <button onClick={() => setFilterImportance('all')} className={`w-full text-left px-2 py-1 rounded text-xs ${filterImportance === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Tất cả</button>
                <button onClick={() => setFilterImportance('major')} className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1 ${filterImportance === 'major' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}><Flag className="w-3 h-3" /> Quan trọng</button>
                <button onClick={() => setFilterImportance('minor')} className={`w-full text-left px-2 py-1 rounded text-xs ${filterImportance === 'minor' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Phụ</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-2 block flex items-center gap-1"><User className="w-3 h-3" /> Nhân vật</label>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                <button
                  onClick={() => setFilterCharacter('all')}
                  className={`w-full text-left px-2 py-1 rounded text-xs flex justify-between items-center ${filterCharacter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                >
                  <span>Tất cả</span>
                  <span className="text-[10px] opacity-75">{safeEvents.length}</span>
                </button>
                {safeCharacters.map(char => {
                  const count = safeEvents.filter(e => Array.isArray(e.involvedCharacterIds) && e.involvedCharacterIds.includes(char.id)).length;
                  return (
                    <button
                      key={char.id}
                      onClick={() => setFilterCharacter(filterCharacter === char.id ? 'all' : char.id)}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex justify-between items-center ${filterCharacter === char.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                      <span className="truncate">{char.name}</span>
                      <span className="text-[10px] opacity-75 ml-1">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {aiCheck && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardHeader className="pb-2"><CardTitle className="text-xs">🔍 AI Check Result</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-2">
                  {aiCheck.summary && <p className="text-muted-foreground">{aiCheck.summary}</p>}
                  {aiCheck.issues?.map((issue: any, idx: number) => (
                    <div key={idx} className={`p-2 rounded border-l-2 ${issue.severity === 'high' ? 'border-red-500 bg-red-50' : issue.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 bg-gray-50'} dark:bg-opacity-10`}>
                      <div className="font-medium">{issue.type} - {issue.severity}</div>
                      <div className="text-[11px] mt-1">{issue.description}</div>
                      {issue.suggestion && <div className="text-[11px] mt-1 italic">Gợi ý: {issue.suggestion}</div>}
                    </div>
                  ))}
                  {(!aiCheck.issues || aiCheck.issues.length === 0) && <p className="text-green-600">✅ Không phát hiện mâu thuẫn!</p>}
                </CardContent>
              </Card>
            )}

            <div className="text-[11px] text-muted-foreground">
              <p className="font-medium mb-1">Mẹo:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Drag để sắp xếp lại thứ tự</li>
                <li>Filter theo kỷ nguyên, mức độ</li>
                <li>AI Check phát hiện plot hole thời gian</li>
                <li>Link sự kiện với chương và nhân vật</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Main timeline */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {filteredEvents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="text-6xl mb-4">⏳</div>
                <h3 className="font-semibold mb-2">Chưa có sự kiện nào</h3>
                <p className="text-sm text-muted-foreground mb-4">Tạo dòng thời gian cho tiểu thuyết của bạn</p>
                <Button onClick={() => setShowNewDialog(true)}><Plus className="w-4 h-4 mr-2" /> Tạo sự kiện đầu tiên</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {zoom === 'all' ? (
                <div className="relative">
                  {filteredEvents
                    .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
                    .map((event: any, idx: number) => (
                      <TimelineEvent
                        key={event.id}
                        event={event}
                        onEdit={openEdit}
                        onDelete={deleteEvent}
                        isFirst={idx === 0}
                        isLast={idx === filteredEvents.length - 1}
                        charactersMap={charactersMap}
                        onFilterByCharacter={(charId) => setFilterCharacter(filterCharacter === charId ? 'all' : charId)}
                      />
                    ))}
                </div>
              ) : (
                <div className="space-y-8">
                  {groupedByEra.map(group => (
                    <div key={group.era}>
                      <div className="flex items-center gap-2 mb-4 sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                        <h3 className="font-bold">{group.era}</h3>
                        <Badge variant="secondary" className="text-xs">{group.events.length} sự kiện</Badge>
                        <div className="flex-1 h-px bg-border ml-2"></div>
                      </div>
                      <div className="ml-1">
                        {group.events
                          .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
                          .map((event: any, idx: number) => (
                            <TimelineEvent
                              key={event.id}
                              event={event}
                              onEdit={openEdit}
                              onDelete={deleteEvent}
                              isFirst={idx === 0}
                              isLast={idx === group.events.length - 1}
                              charactersMap={charactersMap}
                              onFilterByCharacter={(charId) => setFilterCharacter(filterCharacter === charId ? 'all' : charId)}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* New/Edit Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent onClose={() => setShowNewDialog(false)} className="max-w-xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Sửa sự kiện' : 'Sự kiện mới'}</DialogTitle>
            <DialogDescription>Thêm sự kiện vào dòng thời gian</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Tiêu đề sự kiện *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Mô tả chi tiết..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Ngày trong truyện</label>
                <Input placeholder="VD: Ngày 15/03/2024, Năm 3024..." value={form.dateInStory} onChange={e => setForm({ ...form, dateInStory: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Ngày thực tế (nếu có)</label>
                <Input placeholder="VD: 2024-03-15" value={form.dateRealWorld} onChange={e => setForm({ ...form, dateRealWorld: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Kỷ nguyên</label>
                <Input placeholder="VD: Kỷ nguyên Ánh Sáng, Thời kỳ Đen Tối..." value={form.era} onChange={e => setForm({ ...form, era: e.target.value })} className="mt-1" list="eras" />
                <datalist id="eras">
                  {safeEras.map(era => <option key={era} value={era} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium">Mức độ quan trọng</label>
                <select className="flex h-9 w-full rounded-lg border border-input px-3 text-sm mt-1" value={form.importance} onChange={e => setForm({ ...form, importance: e.target.value })}>
                  <option value="minor">Phụ - Minor</option>
                  <option value="major">Quan trọng - Major</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Nhân vật liên quan</label>
              <div className="mt-1 border rounded-lg p-2 max-h-24 overflow-auto space-y-1">
                {safeCharacters.map(char => (
                  <label key={char.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent p-1 rounded">
                    <input
                      type="checkbox"
                      checked={form.involvedCharacterIds.includes(char.id)}
                      onChange={e => {
                        if (e.target.checked) setForm({ ...form, involvedCharacterIds: [...form.involvedCharacterIds, char.id] });
                        else setForm({ ...form, involvedCharacterIds: form.involvedCharacterIds.filter(id => id !== char.id) });
                      }}
                    />
                    {char.name} ({char.role})
                  </label>
                ))}
                {safeCharacters.length === 0 && <p className="text-xs text-muted-foreground">Chưa có nhân vật</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Hủy</Button>
              <Button onClick={saveEvent}>{editingEvent ? 'Cập nhật' : 'Tạo sự kiện'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

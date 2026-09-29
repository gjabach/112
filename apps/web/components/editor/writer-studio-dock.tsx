'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Sparkles, 
  Users, 
  Globe, 
  LayoutList, 
  Clock, 
  Search, 
  Plus, 
  Check, 
  X, 
  ExternalLink, 
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Shield,
  MapPin,
  Wand2,
  Sword,
  BookOpen,
  Eye,
  CheckCircle2,
  ListTodo
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface WriterStudioDockProps {
  projectId: string;
  chapterId: string;
  chapter: any;
  setChapter: (c: any) => void;
  currentWords: number;
  contentLength: number;
  targetWordCount: number;
  setTargetWordCount: (n: number) => void;
  aiLoading: boolean;
  aiSuggestion: string;
  setAiSuggestion: (s: string) => void;
  handleAIContinue: () => void;
  insertAISuggestion: () => void;
  onExecuteAIChat?: (prompt: string, skill: string) => Promise<void>;
  onOpenSpotlight?: () => void;
  onInsertText?: (text: string) => void;
}

export function WriterStudioDock({
  projectId,
  chapterId,
  chapter,
  setChapter,
  currentWords,
  contentLength,
  targetWordCount,
  setTargetWordCount,
  aiLoading,
  aiSuggestion,
  setAiSuggestion,
  handleAIContinue,
  insertAISuggestion,
  onExecuteAIChat,
  onOpenSpotlight,
  onInsertText
}: WriterStudioDockProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'outline' | 'characters' | 'world' | 'timeline'>('stats');

  // Data states
  const [outlineNodes, setOutlineNodes] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Search and filter states
  const [charSearch, setCharSearch] = useState('');
  const [charRoleFilter, setCharRoleFilter] = useState('all');
  const [worldSearch, setWorldSearch] = useState('');
  const [worldTypeFilter, setWorldTypeFilter] = useState('all');
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null);

  // Quick beat creation in outline tab
  const [newBeatTitle, setNewBeatTitle] = useState('');
  const [showAddBeat, setShowAddBeat] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const fetchDockData = async () => {
      setLoadingData(true);
      try {
        const [outRes, charRes, entRes, timeRes] = await Promise.all([
          apiFetch(`/api/projects/${projectId}/outline`).catch(() => ({ flat: [] })),
          apiFetch(`/api/projects/${projectId}/characters`).catch(() => ({ characters: [] })),
          apiFetch(`/api/projects/${projectId}/entities`).catch(() => ({ entities: [] })),
          apiFetch(`/api/projects/${projectId}/timeline`).catch(() => ({ events: [] }))
        ]);
        setOutlineNodes(Array.isArray(outRes?.flat) ? outRes.flat : (Array.isArray(outRes?.outline) ? outRes.outline : []));
        setCharacters(Array.isArray(charRes?.characters) ? charRes.characters : []);
        setEntities(Array.isArray(entRes?.entities) ? entRes.entities : (Array.isArray(entRes?.items) ? entRes.items : []));
        setTimelineEvents(Array.isArray(timeRes?.events) ? timeRes.events : []);
      } finally {
        setLoadingData(false);
      }
    };
    fetchDockData();
  }, [projectId, activeTab]);

  const insertText = (text: string) => {
    if (onInsertText) {
      onInsertText(text);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-insert-text', { detail: { text } }));
    }
    toast.success(`Đã chèn "${text}"`);
  };

  const handleCreateQuickBeat = async () => {
    if (!newBeatTitle.trim()) return;
    try {
      const res = await apiFetch(`/api/projects/${projectId}/outline`, {
        method: 'POST',
        body: JSON.stringify({
          title: newBeatTitle.trim(),
          type: 'beat',
          status: 'idea',
          linkedChapterId: chapterId
        })
      });
      if (res?.node) {
        setOutlineNodes(prev => [...prev, res.node]);
        setNewBeatTitle('');
        setShowAddBeat(false);
        toast.success('Đã thêm mục dàn ý mới!');
      }
    } catch (e: any) {
      toast.error('Lỗi khi thêm: ' + e.message);
    }
  };

  const toggleNodeStatus = async (node: any) => {
    const nextStatus = node.status === 'idea' ? 'drafting' : node.status === 'drafting' ? 'written' : 'idea';
    try {
      await apiFetch(`/api/outline/${node.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      setOutlineNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: nextStatus } : n));
      toast.success('Đã cập nhật trạng thái dàn ý');
    } catch {}
  };

  // Filtered lists
  const filteredChars = characters.filter(c => {
    const matchSearch = (c.name || '').toLowerCase().includes(charSearch.toLowerCase()) ||
      (c.personality || '').toLowerCase().includes(charSearch.toLowerCase());
    const matchRole = charRoleFilter === 'all' || c.role === charRoleFilter;
    return matchSearch && matchRole;
  });

  const filteredEntities = entities.filter(e => {
    const matchSearch = (e.name || '').toLowerCase().includes(worldSearch.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(worldSearch.toLowerCase());
    const matchType = worldTypeFilter === 'all' || e.type === worldTypeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden text-xs">
      {/* Dock Top Tabs */}
      <div className="border-b bg-muted/40 p-1.5 flex items-center justify-between gap-1 shrink-0">
        <div className="grid grid-cols-5 gap-1 w-full">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all ${
              activeTab === 'stats'
                ? 'bg-background shadow-xs text-primary font-semibold border border-primary/20'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
            title="Thông số & Trợ lý AI"
          >
            <Sparkles className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] leading-tight">AI & Số từ</span>
          </button>

          <button
            onClick={() => setActiveTab('outline')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all ${
              activeTab === 'outline'
                ? 'bg-background shadow-xs text-primary font-semibold border border-primary/20'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
            title="Dàn ý & Phân cảnh"
          >
            <LayoutList className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] leading-tight">Dàn ý</span>
          </button>

          <button
            onClick={() => setActiveTab('characters')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all ${
              activeTab === 'characters'
                ? 'bg-background shadow-xs text-primary font-semibold border border-primary/20'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
            title="Hồ sơ nhân vật"
          >
            <Users className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] leading-tight">Nhân vật</span>
          </button>

          <button
            onClick={() => setActiveTab('world')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all ${
              activeTab === 'world'
                ? 'bg-background shadow-xs text-primary font-semibold border border-primary/20'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
            title="Bách khoa toàn thư thế giới"
          >
            <Globe className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] leading-tight">Thế giới</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all ${
              activeTab === 'timeline'
                ? 'bg-background shadow-xs text-primary font-semibold border border-primary/20'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
            title="Dòng thời gian sự kiện"
          >
            <Clock className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] leading-tight">Timeline</span>
          </button>
        </div>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <AnimatePresence mode="wait">
          {/* TAB 1: STATS & AI */}
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-4"
            >
              {/* Word Stats */}
              <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <FileText className="w-3.5 h-3.5 text-primary" /> Tiến độ chương
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.min(100, Math.round((currentWords / targetWordCount) * 100))}%
                  </Badge>
                </div>

                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số từ hiện tại:</span>
                    <span className="font-semibold">{currentWords.toLocaleString()} từ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng ký tự:</span>
                    <span>{contentLength.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thời gian đọc:</span>
                    <span>~{Math.max(1, Math.ceil(currentWords / 200))} phút</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t">
                    <span className="text-muted-foreground">Mục tiêu từ:</span>
                    <input
                      type="number"
                      value={targetWordCount}
                      onChange={e => setTargetWordCount(Math.max(100, parseInt(e.target.value) || 2000))}
                      className="w-20 h-6 text-xs text-right border rounded bg-transparent px-1.5"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground">Trạng thái:</span>
                    <select
                      className="h-6 text-[11px] border rounded bg-transparent px-1.5"
                      value={chapter?.status || 'draft'}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        setChapter({ ...chapter, status: newStatus });
                        await apiFetch(`/api/chapters/${chapterId}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: newStatus })
                        });
                        toast.success('Đã cập nhật trạng thái');
                      }}
                    >
                      <option value="outline">Dàn ý</option>
                      <option value="draft">Bản nháp</option>
                      <option value="revised">Đã sửa</option>
                      <option value="completed">Hoàn thành</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* AI Assistant */}
              <div className="border rounded-xl p-3 bg-purple-500/5 border-purple-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" /> Trợ lý sáng tác AI
                  </span>
                  <Link href={`/ai-assistant?projectId=${projectId}&chapterId=${chapterId}`}>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-purple-500 hover:text-purple-600">
                      Mở AI Chat <ExternalLink className="w-2.5 h-2.5 ml-1" />
                    </Button>
                  </Link>
                </div>

                <Button 
                  size="sm" 
                  className="w-full text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs" 
                  onClick={handleAIContinue} 
                  disabled={aiLoading}
                >
                  {aiLoading ? 'Đang viết tiếp...' : '✨ Viết tiếp diễn biến'}
                </Button>

                <div className="grid grid-cols-2 gap-1.5">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs h-7 border-purple-500/30 hover:bg-purple-500/10" 
                    disabled={aiLoading}
                    onClick={() => onExecuteAIChat?.('Viết lại đoạn văn vừa rồi cho sinh động hơn', 'rewrite')}
                  >
                    🔄 Viết lại mượt
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs h-7 border-purple-500/30 hover:bg-purple-500/10" 
                    disabled={aiLoading}
                    onClick={() => onExecuteAIChat?.('Nhận xét nhịp điệu và cảm xúc phân cảnh này', 'critique')}
                  >
                    🔍 Phê bình nhịp
                  </Button>
                </div>

                {aiSuggestion && (
                  <div className="mt-2 border border-purple-500/30 rounded-lg p-2.5 bg-background shadow-xs">
                    <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mb-1 flex items-center justify-between">
                      <span>Bản thảo gợi ý từ AI:</span>
                      <button onClick={() => setAiSuggestion('')} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed text-foreground">
                      {aiSuggestion}
                    </div>
                    <div className="flex gap-1.5 mt-2 pt-2 border-t">
                      <Button size="sm" className="h-6 text-xs flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={insertAISuggestion}>
                        Chèn vào văn bản
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Author Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>Ghi chú tác giả cho chương này:</span>
                  <span className="text-[10px] text-muted-foreground">Tự động lưu khi rời ô</span>
                </label>
                <textarea
                  className="w-full min-h-[90px] rounded-lg border border-input bg-transparent p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ghi chú dự định, manh mối hoặc chi tiết cần nhớ khi viết chương này..."
                  defaultValue={chapter?.notes || ''}
                  onBlur={e => {
                    apiFetch(`/api/chapters/${chapterId}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ notes: e.target.value })
                    });
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* TAB 2: OUTLINE & BEATS */}
          {activeTab === 'outline' && (
            <motion.div
              key="outline"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <LayoutList className="w-3.5 h-3.5 text-blue-500" /> Dàn ý & Phân cảnh
                </span>
                <div className="flex items-center gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 text-[10px] px-1.5 text-blue-500"
                    onClick={() => setShowAddBeat(prev => !prev)}
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Thêm cảnh
                  </Button>
                  <Link href={`/outline/${projectId}`}>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Mở trang Dàn ý đầy đủ">
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </Link>
                </div>
              </div>

              {showAddBeat && (
                <div className="border rounded-lg p-2 bg-muted/30 space-y-1.5 animate-in fade-in">
                  <Input
                    value={newBeatTitle}
                    onChange={e => setNewBeatTitle(e.target.value)}
                    placeholder="Mục tiêu hoặc diễn biến cảnh..."
                    className="h-7 text-xs bg-background"
                    onKeyDown={e => e.key === 'Enter' && handleCreateQuickBeat()}
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowAddBeat(false)}>
                      Hủy
                    </Button>
                    <Button size="sm" className="h-6 text-[10px]" onClick={handleCreateQuickBeat}>
                      Lưu mục
                    </Button>
                  </div>
                </div>
              )}

              {/* Outline Nodes List */}
              <div className="space-y-1.5">
                {outlineNodes.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-[11px]">
                    Chưa có mục dàn ý nào. Hãy bấm &quot;Thêm cảnh&quot; hoặc vào trang Dàn ý để tạo cấu trúc hồi!
                  </div>
                ) : (
                  outlineNodes.map((node) => {
                    const isLinkedToCurrent = node.linkedChapterId === chapterId;
                    const isDone = node.status === 'written';
                    return (
                      <div
                        key={node.id}
                        className={`p-2 rounded-lg border transition-all ${
                          isLinkedToCurrent
                            ? 'bg-blue-500/10 border-blue-500/30 shadow-xs'
                            : 'bg-muted/20 border-border/60 hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <button
                            onClick={() => toggleNodeStatus(node)}
                            className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                            title="Đổi trạng thái"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/60" />
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-medium truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {node.title}
                              </span>
                              {isLinkedToCurrent && (
                                <Badge className="text-[9px] px-1 py-0 h-3.5 bg-blue-500 text-white font-normal">
                                  Chương này
                                </Badge>
                              )}
                            </div>
                            {node.description && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                {node.description}
                              </p>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1 text-[10px] text-primary shrink-0 opacity-80 hover:opacity-100"
                            onClick={() => insertText(node.title)}
                            title="Chèn tên vào bài viết"
                          >
                            Chèn
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: CHARACTERS */}
          {activeTab === 'characters' && (
            <motion.div
              key="characters"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-500" /> Nhân vật ({characters.length})
                </span>
                <Link href={`/characters/${projectId}`}>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-amber-500" title="Mở trang Nhân vật đầy đủ">
                    Toàn bộ <ExternalLink className="w-2.5 h-2.5 ml-1" />
                  </Button>
                </Link>
              </div>

              {/* Search & Role Filter */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2" />
                  <Input
                    value={charSearch}
                    onChange={e => setCharSearch(e.target.value)}
                    placeholder="Tìm nhân vật..."
                    className="h-7 text-xs pl-7 bg-muted/20"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'protagonist', label: 'Chính' },
                    { id: 'antagonist', label: 'Phản diện' },
                    { id: 'supporting', label: 'Phụ' }
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => setCharRoleFilter(r.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-full transition-colors shrink-0 ${
                        charRoleFilter === r.id
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Character Cards */}
              <div className="space-y-2">
                {filteredChars.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-[11px]">
                    Không tìm thấy nhân vật nào.
                  </div>
                ) : (
                  filteredChars.map((char) => {
                    const isExpanded = expandedCharId === char.id;
                    const roleColor = char.role === 'protagonist'
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : char.role === 'antagonist'
                      ? 'border-red-500/40 bg-red-500/5'
                      : 'border-border/60 bg-card';

                    return (
                      <div
                        key={char.id}
                        className={`rounded-xl border p-2.5 transition-all ${roleColor} hover:shadow-xs`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-xs shrink-0 border">
                              {char.name?.[0]?.toUpperCase() || 'N'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate text-foreground flex items-center gap-1.5">
                                <span>{char.name}</span>
                                {char.role === 'protagonist' && (
                                  <Badge className="text-[9px] px-1 py-0 h-3.5 bg-amber-500 text-white">Chính</Badge>
                                )}
                                {char.role === 'antagonist' && (
                                  <Badge className="text-[9px] px-1 py-0 h-3.5 bg-red-500 text-white">Phản diện</Badge>
                                )}
                              </div>
                              {char.aliases && char.aliases.length > 0 && (
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  ({char.aliases.join(', ')})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-1.5 text-[10px] text-primary"
                              onClick={() => insertText(char.name)}
                              title="Chèn tên nhân vật vào văn bản"
                            >
                              @ Chèn
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setExpandedCharId(isExpanded ? null : char.id)}
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {/* Collapsed short info */}
                        {!isExpanded && (char.personality || char.appearance) && (
                          <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1">
                            {char.personality || char.appearance}
                          </p>
                        )}

                        {/* Expanded Dossier */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t space-y-1.5 text-[11px] animate-in fade-in">
                            {char.appearance && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Ngoại hình: </span>
                                <span>{char.appearance}</span>
                              </div>
                            )}
                            {char.personality && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Tính cách: </span>
                                <span>{char.personality}</span>
                              </div>
                            )}
                            {char.motivation && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Động cơ: </span>
                                <span>{char.motivation}</span>
                              </div>
                            )}
                            {char.secrets && (
                              <div className="text-amber-600 dark:text-amber-400">
                                <span className="font-semibold">Bí mật: </span>
                                <span>{char.secrets}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 4: WORLDBUILDING LORE */}
          {activeTab === 'world' && (
            <motion.div
              key="world"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-500" /> Thế giới ({entities.length})
                </span>
                <Link href={`/worldbuilding/${projectId}`}>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-emerald-500" title="Mở trang Thế giới đầy đủ">
                    Toàn bộ <ExternalLink className="w-2.5 h-2.5 ml-1" />
                  </Button>
                </Link>
              </div>

              {/* Search & Category Filter */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2" />
                  <Input
                    value={worldSearch}
                    onChange={e => setWorldSearch(e.target.value)}
                    placeholder="Tìm địa danh, ma pháp, thế lực..."
                    className="h-7 text-xs pl-7 bg-muted/20"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'location', label: '🏰 Địa danh' },
                    { id: 'organization', label: '🏛️ Phe phái' },
                    { id: 'magic_system', label: '✨ Ma pháp' },
                    { id: 'species', label: '🧝 Chủng tộc' },
                    { id: 'item', label: '🗡️ Báu vật' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setWorldTypeFilter(t.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-full transition-colors shrink-0 ${
                        worldTypeFilter === t.id
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entity Cards */}
              <div className="space-y-2">
                {filteredEntities.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-[11px]">
                    Không tìm thấy thực thể nào.
                  </div>
                ) : (
                  filteredEntities.map((ent) => (
                    <div
                      key={ent.id}
                      className="rounded-xl border border-border/60 bg-card p-2.5 hover:shadow-xs transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold truncate text-foreground">{ent.name}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
                            {ent.type}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0"
                          onClick={() => insertText(ent.name)}
                          title="Chèn tên thực thể vào văn bản"
                        >
                          # Chèn
                        </Button>
                      </div>

                      {ent.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {ent.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 5: TIMELINE */}
          {activeTab === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-500" /> Dòng thời gian ({timelineEvents.length})
                </span>
                <Link href={`/timeline/${projectId}`}>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-purple-500" title="Mở trang Timeline đầy đủ">
                    Toàn bộ <ExternalLink className="w-2.5 h-2.5 ml-1" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                {timelineEvents.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-[11px]">
                    Chưa có sự kiện timeline nào cho tác phẩm này.
                  </div>
                ) : (
                  timelineEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-border/60 bg-card p-2.5 space-y-1 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate text-foreground">{ev.title}</span>
                        {ev.importance === 'major' && (
                          <Badge className="text-[9px] px-1 py-0 h-3.5 bg-red-500 text-white shrink-0">
                            Đại sự kiện
                          </Badge>
                        )}
                      </div>

                      {ev.dateInStory && (
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium block">
                          📅 {ev.dateInStory} {ev.era ? `(${ev.era})` : ''}
                        </span>
                      )}

                      {ev.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {ev.description}
                        </p>
                      )}

                      <div className="pt-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-primary"
                          onClick={() => insertText(ev.title)}
                        >
                          Chèn tên sự kiện
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dock Bottom Quick Spotlight Trigger */}
      <div className="p-2 border-t bg-muted/20 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-7 justify-between text-muted-foreground hover:text-foreground"
          onClick={onOpenSpotlight}
        >
          <span className="flex items-center gap-1.5">
            <Search className="w-3 h-3 text-primary" /> Tra cứu nhanh (Spotlight)
          </span>
          <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted border">Ctrl+Shift+K</kbd>
        </Button>
      </div>
    </div>
  );
}

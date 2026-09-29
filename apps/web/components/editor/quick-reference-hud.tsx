'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Users, 
  Globe, 
  LayoutList, 
  Clock, 
  Sparkles, 
  CornerDownLeft, 
  X, 
  Check, 
  ExternalLink,
  MapPin,
  Shield,
  Wand2,
  Calendar,
  Layers
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';

interface QuickReferenceHudProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onInsertText?: (text: string) => void;
}

export function QuickReferenceHud({ isOpen, onClose, projectId, onInsertText }: QuickReferenceHudProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'characters' | 'world' | 'outline' | 'timeline'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [characters, setCharacters] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [outline, setOutline] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    setQuery('');
    setSelectedIndex(0);

    const loadData = async () => {
      setLoading(true);
      try {
        const [charRes, entRes, outRes, timeRes] = await Promise.all([
          apiFetch(`/api/projects/${projectId}/characters`).catch(() => ({ characters: [] })),
          apiFetch(`/api/projects/${projectId}/entities`).catch(() => ({ entities: [] })),
          apiFetch(`/api/projects/${projectId}/outline`).catch(() => ({ flat: [] })),
          apiFetch(`/api/projects/${projectId}/timeline`).catch(() => ({ events: [] }))
        ]);
        setCharacters(Array.isArray(charRes?.characters) ? charRes.characters : []);
        setEntities(Array.isArray(entRes?.entities) ? entRes.entities : (Array.isArray(entRes?.items) ? entRes.items : []));
        setOutline(Array.isArray(outRes?.flat) ? outRes.flat : (Array.isArray(outRes?.outline) ? outRes.outline : []));
        setTimeline(Array.isArray(timeRes?.events) ? timeRes.events : []);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen, projectId]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: Array<{
      id: string;
      category: 'characters' | 'world' | 'outline' | 'timeline';
      title: string;
      subtitle: string;
      badgeText: string;
      badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
      insertText: string;
      meta?: any;
    }> = [];

    // Characters
    if (selectedCategory === 'all' || selectedCategory === 'characters') {
      characters.forEach((c) => {
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const aliasMatch = Array.isArray(c.aliases) && c.aliases.some((a: string) => a.toLowerCase().includes(q));
        const traitsMatch = (c.personality || '').toLowerCase().includes(q) || (c.appearance || '').toLowerCase().includes(q);
        if (!q || nameMatch || aliasMatch || traitsMatch) {
          const roleLabel = c.role === 'protagonist' ? 'Nhân vật chính' : c.role === 'antagonist' ? 'Phản diện' : c.role === 'supporting' ? 'Nhân vật phụ' : 'Quần chúng';
          items.push({
            id: `char_${c.id}`,
            category: 'characters',
            title: c.name || 'Nhân vật',
            subtitle: c.appearance || c.personality || c.motivation || 'Hồ sơ nhân vật',
            badgeText: roleLabel,
            badgeVariant: c.role === 'protagonist' ? 'default' : c.role === 'antagonist' ? 'destructive' : 'secondary',
            insertText: c.name || '',
            meta: c
          });
        }
      });
    }

    // Worldbuilding
    if (selectedCategory === 'all' || selectedCategory === 'world') {
      entities.forEach((e) => {
        const nameMatch = (e.name || '').toLowerCase().includes(q);
        const descMatch = (e.description || '').toLowerCase().includes(q);
        if (!q || nameMatch || descMatch) {
          const typeMap: Record<string, string> = {
            location: 'Địa danh',
            organization: 'Phe phái',
            magic_system: 'Ma pháp',
            species: 'Chủng tộc',
            item: 'Báu vật',
            religion: 'Tín ngưỡng',
            event: 'Lịch sử'
          };
          items.push({
            id: `world_${e.id}`,
            category: 'world',
            title: e.name || 'Thực thể',
            subtitle: e.description || 'Thiết lập thế giới',
            badgeText: typeMap[e.type] || e.type || 'Lore',
            badgeVariant: 'outline',
            insertText: e.name || '',
            meta: e
          });
        }
      });
    }

    // Outline
    if (selectedCategory === 'all' || selectedCategory === 'outline') {
      outline.forEach((n) => {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const descMatch = (n.description || '').toLowerCase().includes(q);
        if (!q || titleMatch || descMatch) {
          const typeMap: Record<string, string> = {
            act: 'Hồi',
            chapter: 'Chương',
            scene: 'Phân cảnh',
            beat: 'Nhịp nhịp'
          };
          items.push({
            id: `out_${n.id}`,
            category: 'outline',
            title: n.title || 'Mục dàn ý',
            subtitle: n.description || 'Dàn ý tác phẩm',
            badgeText: typeMap[n.type] || n.type || 'Dàn ý',
            badgeVariant: 'secondary',
            insertText: n.title || '',
            meta: n
          });
        }
      });
    }

    // Timeline
    if (selectedCategory === 'all' || selectedCategory === 'timeline') {
      timeline.forEach((ev) => {
        const titleMatch = (ev.title || '').toLowerCase().includes(q);
        const descMatch = (ev.description || '').toLowerCase().includes(q);
        if (!q || titleMatch || descMatch) {
          items.push({
            id: `time_${ev.id}`,
            category: 'timeline',
            title: ev.title || 'Sự kiện',
            subtitle: [ev.dateInStory ? `Thời điểm: ${ev.dateInStory}` : '', ev.description].filter(Boolean).join(' • '),
            badgeText: ev.era ? `${ev.era}` : (ev.importance === 'major' ? 'Đại sự kiện' : 'Sự kiện'),
            badgeVariant: ev.importance === 'major' ? 'destructive' : 'outline',
            insertText: ev.title || '',
            meta: ev
          });
        }
      });
    }

    return items;
  }, [query, selectedCategory, characters, entities, outline, timeline]);

  const handleSelect = (item: any) => {
    if (!item) return;
    const textToInsert = item.insertText;
    if (textToInsert) {
      if (onInsertText) {
        onInsertText(textToInsert);
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('novelist-insert-text', { detail: { text: textToInsert } }));
      }
      toast.success(`Đã chèn "${textToInsert}" vào văn bản!`);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelect(searchResults[selectedIndex]);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden border border-border/70 shadow-2xl bg-card/95 backdrop-blur-xl rounded-2xl">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b bg-muted/20">
          <Search className="w-5 h-5 text-primary shrink-0 mr-3 animate-pulse" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm nhanh nhân vật, địa danh, quy tắc thế giới, sự kiện (Ctrl+Shift+K)..."
            className="border-0 bg-transparent text-sm md:text-base focus-visible:ring-0 shadow-none px-0 h-9 flex-1"
          />
          <div className="flex items-center gap-1.5 ml-2">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground rounded border">
              ESC
            </kbd>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b bg-muted/10 overflow-x-auto no-scrollbar text-xs">
          <Button
            size="sm"
            variant={selectedCategory === 'all' ? 'default' : 'ghost'}
            className="h-6 text-xs px-2.5 rounded-full"
            onClick={() => setSelectedCategory('all')}
          >
            Tất cả ({characters.length + entities.length + outline.length + timeline.length})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'characters' ? 'default' : 'ghost'}
            className="h-6 text-xs px-2.5 rounded-full gap-1"
            onClick={() => setSelectedCategory('characters')}
          >
            <Users className="w-3 h-3 text-amber-500" /> Nhân vật ({characters.length})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'world' ? 'default' : 'ghost'}
            className="h-6 text-xs px-2.5 rounded-full gap-1"
            onClick={() => setSelectedCategory('world')}
          >
            <Globe className="w-3 h-3 text-emerald-500" /> Thế giới ({entities.length})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'outline' ? 'default' : 'ghost'}
            className="h-6 text-xs px-2.5 rounded-full gap-1"
            onClick={() => setSelectedCategory('outline')}
          >
            <LayoutList className="w-3 h-3 text-blue-500" /> Dàn ý ({outline.length})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'timeline' ? 'default' : 'ghost'}
            className="h-6 text-xs px-2.5 rounded-full gap-1"
            onClick={() => setSelectedCategory('timeline')}
          >
            <Clock className="w-3 h-3 text-purple-500" /> Timeline ({timeline.length})
          </Button>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Đang tải dữ liệu tác phẩm...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Không tìm thấy mục nào khớp với &quot;{query}&quot;.
            </div>
          ) : (
            searchResults.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-start justify-between gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/25 shadow-xs'
                      : 'hover:bg-muted/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 w-6 h-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {item.category === 'characters' ? (
                        <Users className="w-3.5 h-3.5 text-amber-500" />
                      ) : item.category === 'world' ? (
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      ) : item.category === 'outline' ? (
                        <LayoutList className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-purple-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm truncate text-foreground">
                          {item.title}
                        </span>
                        <Badge variant={item.badgeVariant} className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                          {item.badgeText}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate line-clamp-1 mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <span className="text-[11px] text-primary hidden sm:inline-flex items-center gap-1 font-medium">
                      Chèn <CornerDownLeft className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              Dùng <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted rounded border">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted rounded border">↓</kbd> để di chuyển
            </span>
            <span>
              <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted rounded border">Enter</kbd> để chèn vào văn bản
            </span>
          </div>
          <span>{searchResults.length} kết quả</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

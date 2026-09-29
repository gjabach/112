'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sword, Heart, Skull, Scroll, Calendar, Users, Edit3, Trash2, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface TimelineEvent {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  dateInStory?: string;
  era?: string;
  importance: string;
  involvedCharacterIds?: string[];
  chapterId?: string;
}

interface ParallelTracksViewProps {
  events: TimelineEvent[];
  characters: any[];
  projectId: string;
  onEdit: (ev: TimelineEvent) => void;
  onDelete: (id: string, title: string) => void;
}

const subplots = [
  { id: 'main', label: 'Tuyến Chính (Main Quest)', icon: Sword, color: 'border-blue-500/40 bg-blue-500/5', badge: 'bg-blue-500 text-white' },
  { id: 'character', label: 'Tuyến Nhân Vật & Tình Cảm', icon: Heart, color: 'border-pink-500/40 bg-pink-500/5', badge: 'bg-pink-500 text-white' },
  { id: 'antagonist', label: 'Hành Tung Phản Diện & Bí Mật', icon: Skull, color: 'border-red-500/40 bg-red-500/5', badge: 'bg-red-500 text-white' },
  { id: 'world', label: 'Biến Cố Thế Giới & Lịch Sử', icon: Scroll, color: 'border-emerald-500/40 bg-emerald-500/5', badge: 'bg-emerald-500 text-white' }
];

export function ParallelTracksView({
  events,
  characters,
  projectId,
  onEdit,
  onDelete
}: ParallelTracksViewProps) {
  const charactersMap = characters.reduce((acc: Record<string, any>, c: any) => {
    if (c?.id) acc[c.id] = c;
    return acc;
  }, {});

  // Categorize events into subplots heuristically or by importance
  const trackMap = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {
      main: [],
      character: [],
      antagonist: [],
      world: []
    };

    events.forEach(ev => {
      const imp = ev.importance;
      const lower = `${ev.title} ${ev.description || ''}`.toLowerCase();

      if (imp === 'major' || lower.includes('chính') || lower.includes('chiến') || lower.includes('đại')) {
        map.main.push(ev);
      } else if (lower.includes('yêu') || lower.includes('tình') || lower.includes('gặp') || lower.includes('bạn')) {
        map.character.push(ev);
      } else if (lower.includes('kẻ thù') || lower.includes('âm mưu') || lower.includes('phản') || imp === 'turning_point') {
        map.antagonist.push(ev);
      } else {
        map.world.push(ev);
      }
    });

    return map;
  }, [events]);

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {subplots.map(subplot => {
          const Icon = subplot.icon;
          const trackEvents = trackMap[subplot.id] || [];

          return (
            <div
              key={subplot.id}
              className={`rounded-2xl border ${subplot.color} p-4 flex flex-col min-h-[500px] shadow-sm`}
            >
              {/* Track Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-xs sm:text-sm text-foreground">{subplot.label}</h3>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {trackEvents.length}
                </Badge>
              </div>

              {/* Event Cards in this Track */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {trackEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs border border-dashed rounded-xl p-4">
                    Chưa có sự kiện nào thuộc mạch này.
                  </div>
                ) : (
                  trackEvents.map(ev => {
                    const involvedList = (ev.involvedCharacterIds || []).map(id => charactersMap[id]).filter(Boolean);

                    return (
                      <div
                        key={ev.id}
                        className="rounded-xl border border-border/70 bg-card p-3 shadow-xs hover:shadow-md transition-all space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                            {ev.title}
                          </h4>
                          {ev.dateInStory && (
                            <span className="text-[10px] text-primary shrink-0 font-medium">
                              📅 {ev.dateInStory}
                            </span>
                          )}
                        </div>

                        {ev.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {ev.description}
                          </p>
                        )}

                        {involvedList.length > 0 && (
                          <div className="flex items-center gap-1 pt-1 flex-wrap">
                            {involvedList.map(c => (
                              <Badge key={c.id} variant="outline" className="text-[9px] px-1 py-0 font-normal">
                                {c.name}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px]">
                          {ev.chapterId ? (
                            <Link href={`/editor/${projectId}/${ev.chapterId}`} className="text-primary hover:underline">
                              Chương liên kết →
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Chưa liên kết</span>
                          )}

                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => onEdit(ev)}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => onDelete(ev.id, ev.title)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

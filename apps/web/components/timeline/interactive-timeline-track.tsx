'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Sparkles, 
  MapPin, 
  Users, 
  BookOpen, 
  Edit3, 
  Trash2, 
  Calendar, 
  Zap, 
  Crown, 
  History,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

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

interface InteractiveTimelineTrackProps {
  events: TimelineEvent[];
  characters: any[];
  projectId: string;
  onEdit: (ev: TimelineEvent) => void;
  onDelete: (id: string, title: string) => void;
}

const importanceConfigs: Record<string, { label: string; icon: any; color: string; border: string; glow: string }> = {
  major: {
    label: 'Đại sự kiện / Cao trào',
    icon: Crown,
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    border: 'border-red-500/40',
    glow: 'shadow-red-500/10'
  },
  turning_point: {
    label: 'Bước ngoặt cốt truyện',
    icon: Zap,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    border: 'border-amber-500/40',
    glow: 'shadow-amber-500/10'
  },
  flashback: {
    label: 'Tiền truyện / Hồi tưởng',
    icon: History,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    border: 'border-purple-500/40',
    glow: 'shadow-purple-500/10'
  },
  minor: {
    label: 'Diễn biến thường',
    icon: Clock,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/40',
    glow: 'shadow-blue-500/10'
  }
};

export function InteractiveTimelineTrack({
  events,
  characters,
  projectId,
  onEdit,
  onDelete
}: InteractiveTimelineTrackProps) {
  const charactersMap = characters.reduce((acc: Record<string, any>, c: any) => {
    if (c?.id) acc[c.id] = c;
    return acc;
  }, {});

  if (events.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed rounded-2xl bg-muted/10 space-y-3">
        <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        <h3 className="font-semibold text-sm">Chưa có sự kiện nào trong dòng thời gian</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Tạo các mốc biến cố, trận chiến hoặc hồi tưởng để nắm bắt toàn diện mạch thời gian của tác phẩm!
        </p>
      </div>
    );
  }

  return (
    <div className="relative py-8 px-2 sm:px-6 max-w-4xl mx-auto">
      {/* Central Glowing Chrono Axis */}
      <div className="absolute left-6 sm:left-1/2 top-4 bottom-4 w-1 -translate-x-1/2 bg-gradient-to-b from-blue-500 via-purple-500 to-emerald-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.5)] pointer-events-none" />

      <div className="space-y-8 relative">
        {events.map((ev, index) => {
          const isEven = index % 2 === 0;
          const cfg = importanceConfigs[ev.importance] || importanceConfigs.minor;
          const Icon = cfg.icon;
          const involvedList = (ev.involvedCharacterIds || []).map(id => charactersMap[id]).filter(Boolean);

          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className={`flex flex-col sm:flex-row items-start gap-4 ${
                isEven ? 'sm:flex-row-reverse' : ''
              }`}
            >
              {/* Card Content */}
              <div className="w-full sm:w-[calc(50%-28px)] pl-12 sm:pl-0">
                <div
                  className={`rounded-2xl border ${cfg.border} bg-card p-4 transition-all duration-200 shadow-sm hover:shadow-lg ${cfg.glow} space-y-3 group`}
                >
                  {/* Top Bar: Era, Date, Importance badge */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5">
                      {ev.dateInStory && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{ev.dateInStory}</span>
                          {ev.era && <span className="text-muted-foreground font-normal">({ev.era})</span>}
                        </div>
                      )}
                      {ev.dateRealWorld && (
                        <span className="text-[10px] text-muted-foreground block">
                          Thời gian thực: {ev.dateRealWorld}
                        </span>
                      )}
                    </div>

                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                      {ev.title}
                    </h3>
                    {ev.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed bg-muted/20 p-2.5 rounded-xl">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  {/* Involved Characters */}
                  {involvedList.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3 text-amber-500" /> Nhân vật:
                      </span>
                      {involvedList.map(c => (
                        <Badge key={c.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Card Actions & Linked Chapter */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
                    {ev.chapterId ? (
                      <Link
                        href={`/editor/${projectId}/${ev.chapterId}`}
                        className="text-primary hover:underline flex items-center gap-1 text-[11px] font-medium"
                      >
                        <BookOpen className="w-3 h-3" /> Viết chương này →
                      </Link>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Chưa gắn chương</span>
                    )}

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => onEdit(ev)}
                        title="Chỉnh sửa sự kiện"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(ev.id, ev.title)}
                        title="Xóa sự kiện"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Central Glowing Pulse Node */}
              <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 mt-4 z-10">
                <div className="w-9 h-9 rounded-full bg-card border-2 border-primary shadow-md flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

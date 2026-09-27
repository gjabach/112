'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, User, BookOpen, Edit3, Trash2, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEventProps {
  event: any;
  onEdit: (event: any) => void;
  onDelete: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  charactersMap?: Record<string, string>;
  onFilterByCharacter?: (charId: string) => void;
}

const importanceColors: Record<string, string> = {
  major: 'bg-red-500 border-red-600 text-white',
  minor: 'bg-gray-400 border-gray-500 text-white'
};

export function TimelineEvent({
  event,
  onEdit,
  onDelete,
  isFirst,
  isLast,
  charactersMap = {},
  onFilterByCharacter
}: TimelineEventProps) {
  return (
    <div className="relative flex gap-2.5 sm:gap-4 group min-w-0 max-w-full">
      {/* Timeline line */}
      <div className="flex flex-col items-center shrink-0">
        {/* Dot */}
        <div className={cn(
          'w-4 h-4 rounded-full border-2 bg-background z-10 flex items-center justify-center shrink-0 mt-1',
          event.importance === 'major' ? 'border-red-500 bg-red-500' : 'border-muted-foreground'
        )}>
          {event.importance === 'major' && <Flag className="w-2 h-2 text-white" />}
        </div>
        
        {/* Vertical line */}
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1 min-h-[50px] sm:min-h-[60px]"></div>}
      </div>

      {/* Content */}
      <Card className={cn(
        'flex-1 min-w-0 mb-4 sm:mb-6 hover:shadow-md transition-all border-l-4 group-hover:border-primary/50',
        event.importance === 'major' ? 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10' : 'border-l-muted'
      )}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                <h4 className="font-semibold text-sm break-words">{event.title}</h4>
                <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', importanceColors[event.importance])}>
                  {event.importance === 'major' ? 'Quan trọng' : 'Phụ'}
                </Badge>
                {event.era && <Badge variant="outline" className="text-[10px] shrink-0 truncate max-w-[150px]">{event.era}</Badge>}
              </div>

              {event.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3 sm:line-clamp-2 break-words">{event.description}</p>
              )}

              <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 text-[11px] text-muted-foreground">
                {event.dateInStory && (
                  <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" /> {event.dateInStory}</span>
                )}
                {event.locationId && (
                  <span className="flex items-center gap-1 shrink-0"><MapPin className="w-3 h-3" /> {event.locationId.slice(0,8)}</span>
                )}
                {event.involvedCharacterIds?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 max-w-full">
                    <span className="flex items-center gap-0.5"><User className="w-3 h-3 mr-0.5" /></span>
                    {event.involvedCharacterIds.map((charId: string) => (
                      <Badge
                        key={charId}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-primary/20 transition-colors shrink-0 max-w-[120px] truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onFilterByCharacter) onFilterByCharacter(charId);
                        }}
                        title="Lọc theo nhân vật này"
                      >
                        {charactersMap[charId] || 'Nhân vật'}
                      </Badge>
                    ))}
                  </div>
                )}
                {event.chapterId && (
                  <span className="flex items-center gap-1 shrink-0"><BookOpen className="w-3 h-3" /> Chương</span>
                )}
              </div>
            </div>

            <div className="flex gap-0.5 sm:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-6 sm:w-6" onClick={() => onEdit(event)} title="Sửa sự kiện">
                <Edit3 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-6 sm:w-6 text-destructive" onClick={() => onDelete(event.id)} title="Xóa sự kiện">
                <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

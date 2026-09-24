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
}

const importanceColors: Record<string, string> = {
  major: 'bg-red-500 border-red-600 text-white',
  minor: 'bg-gray-400 border-gray-500 text-white'
};

export function TimelineEvent({ event, onEdit, onDelete, isFirst, isLast }: TimelineEventProps) {
  return (
    <div className="relative flex gap-4 group">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div className={cn(
          'w-4 h-4 rounded-full border-2 bg-background z-10 flex items-center justify-center',
          event.importance === 'major' ? 'border-red-500 bg-red-500' : 'border-muted-foreground'
        )}>
          {event.importance === 'major' && <Flag className="w-2 h-2 text-white" />}
        </div>
        
        {/* Vertical line */}
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-2 min-h-[60px]"></div>}
      </div>

      {/* Content */}
      <Card className={cn(
        'flex-1 mb-6 hover:shadow-md transition-all border-l-4 group-hover:border-primary/50',
        event.importance === 'major' ? 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10' : 'border-l-muted'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="font-semibold text-sm">{event.title}</h4>
                <Badge className={cn('text-[10px] px-1.5 py-0', importanceColors[event.importance])}>
                  {event.importance === 'major' ? 'Quan trọng' : 'Phụ'}
                </Badge>
                {event.era && <Badge variant="outline" className="text-[10px]">{event.era}</Badge>}
              </div>

              {event.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
              )}

              <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
                {event.dateInStory && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {event.dateInStory}</span>
                )}
                {event.locationId && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.locationId.slice(0,8)}</span>
                )}
                {event.involvedCharacterIds?.length > 0 && (
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {event.involvedCharacterIds.length} nhân vật</span>
                )}
                {event.chapterId && (
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Chương</span>
                )}
              </div>
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(event)}>
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(event.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

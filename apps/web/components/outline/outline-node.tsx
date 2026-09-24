'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, ChevronDown, ChevronRight, Edit3, Trash2, Link as LinkIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OutlineNodeProps {
  node: any;
  depth?: number;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  isDragging?: boolean;
}

const typeIcons: Record<string, string> = {
  act: '🎬',
  chapter: '📖',
  scene: '🎞️',
  beat: '💡'
};

const statusColors: Record<string, string> = {
  idea: 'bg-gray-500',
  planned: 'bg-blue-500',
  written: 'bg-yellow-500',
  revised: 'bg-green-500'
};

export function OutlineNode({ node, depth = 0, onUpdate, onDelete, onAddChild, isDragging }: OutlineNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [editDesc, setEditDesc] = useState(node.description || '');

  const hasChildren = node.children && node.children.length > 0;

  const handleSave = () => {
    onUpdate(node.id, { title: editTitle, description: editDesc });
    setIsEditing(false);
  };

  return (
    <div className={cn('group', isDragging && 'opacity-50')}>
      <Card className={cn('mb-2 border-l-4 hover:shadow-md transition-all', depth > 0 && 'ml-6')} style={{ borderLeftColor: node.color || '#e5e7eb' }}>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6 cursor-grab">
              <GripVertical className="w-3 h-3" />
            </Button>
            
            {hasChildren && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </Button>
            )}

            <div className="text-lg leading-none mt-0.5">{typeIcons[node.type] || '📄'}</div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-2">
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-7 text-sm font-medium" />
                  <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="text-xs min-h-[60px]" placeholder="Mô tả..." />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-xs" onClick={handleSave}>Lưu</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setIsEditing(false)}>Hủy</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{node.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">{node.type}</Badge>
                    <div className={cn('w-2 h-2 rounded-full', statusColors[node.status] || 'bg-gray-400')} title={node.status}></div>
                  </div>
                  {node.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{node.description}</p>}
                  {node.linkedChapterId && <div className="flex items-center gap-1 mt-1 text-[10px] text-primary"><LinkIcon className="w-3 h-3" /> Linked to chapter</div>}
                </>
              )}
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}><Edit3 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddChild(node.id)}><Plus className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>

          {/* Status selector */}
          <div className="flex gap-1 mt-2 ml-8">
            {['idea', 'planned', 'written', 'revised'].map(status => (
              <button
                key={status}
                onClick={() => onUpdate(node.id, { status })}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  node.status === status ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:border-primary/50'
                )}
              >
                {status === 'idea' ? 'Ý tưởng' : status === 'planned' ? 'Đã lên kế hoạch' : status === 'written' ? 'Đã viết' : 'Đã sửa'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {hasChildren && isExpanded && (
        <div className="space-y-0">
          {node.children.map((child: any) => (
            <OutlineNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

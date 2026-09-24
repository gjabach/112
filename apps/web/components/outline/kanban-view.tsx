'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface KanbanViewProps {
  nodes: any[];
  onUpdate: (id: string, data: any) => void;
  onAdd: (status: string) => void;
}

const columns = [
  { id: 'idea', title: '💡 Ý tưởng', color: 'border-gray-300' },
  { id: 'planned', title: '📋 Đã lên kế hoạch', color: 'border-blue-400' },
  { id: 'written', title: '✍️ Đã viết', color: 'border-yellow-400' },
  { id: 'revised', title: '✅ Đã sửa', color: 'border-green-500' }
];

export function KanbanView({ nodes, onUpdate, onAdd }: KanbanViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const getNodesByStatus = (status: string) => nodes.filter((n: any) => n.status === status);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedId) {
      onUpdate(draggedId, { status: newStatus });
      setDraggedId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      {columns.map(col => {
        const colNodes = getNodesByStatus(col.id);
        return (
          <div
            key={col.id}
            className={`bg-muted/30 rounded-xl border-2 ${col.color} flex flex-col min-h-[500px]`}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.id)}
          >
            <div className="p-3 border-b bg-card rounded-t-xl flex justify-between items-center">
              <h3 className="font-semibold text-sm">{col.title}</h3>
              <Badge variant="secondary" className="text-xs">{colNodes.length}</Badge>
            </div>

            <div className="flex-1 p-2 space-y-2 overflow-auto">
              {colNodes.map((node: any) => (
                <Card
                  key={node.id}
                  draggable
                  onDragStart={e => handleDragStart(e, node.id)}
                  className="cursor-move hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: node.color || '#e5e7eb' }}
                >
                  <CardContent className="p-3">
                    <div className="font-medium text-sm mb-1">{node.title}</div>
                    {node.description && <div className="text-xs text-muted-foreground line-clamp-2">{node.description}</div>}
                    <div className="flex gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px]">{node.type}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {colNodes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">Kéo thả card vào đây</div>
              )}
            </div>

            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onAdd(col.id)}>
                <Plus className="w-3 h-3 mr-1" /> Thêm thẻ
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

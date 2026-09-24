'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, BookOpen, CheckCircle, Trash2, Edit } from 'lucide-react';

interface KanbanViewProps {
  nodes: any[];
  onUpdate: (id: string, data: any) => void;
  onAdd: (status: string) => void;
  onConvertToChapter?: (node: any) => void;
  onDelete?: (id: string) => void;
}

const columns = [
  { id: 'idea', title: '💡 Ý tưởng', color: 'border-gray-300' },
  { id: 'planned', title: '📋 Đã lên kế hoạch', color: 'border-blue-400' },
  { id: 'written', title: '✍️ Đã viết', color: 'border-yellow-400' },
  { id: 'revised', title: '✅ Đã sửa', color: 'border-green-500' }
];

export function KanbanView({ nodes, onUpdate, onAdd, onConvertToChapter, onDelete }: KanbanViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeNode, setActiveNode] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('idea');

  const getNodesByStatus = (status: string) => nodes.filter((n: any) => n.status === status);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setIsDragging(true);
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setTimeout(() => setIsDragging(false), 50);
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

  const handleOpenNode = (node: any) => {
    if (isDragging) return;
    setActiveNode(node);
    setEditTitle(node.title || '');
    setEditDesc(node.description || '');
    setEditStatus(node.status || 'idea');
  };

  const handleSave = () => {
    if (!activeNode) return;
    onUpdate(activeNode.id, {
      title: editTitle,
      description: editDesc,
      status: editStatus
    });
    setActiveNode(null);
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
                  onDragEnd={handleDragEnd}
                  onClick={() => handleOpenNode(node)}
                  className="cursor-pointer hover:shadow-md transition-all border-l-4 group"
                  style={{ borderLeftColor: node.color || '#e5e7eb' }}
                >
                  <CardContent className="p-3">
                    <div className="font-medium text-sm mb-1 line-clamp-2">{node.title}</div>
                    {node.description && <div className="text-xs text-muted-foreground line-clamp-2">{node.description}</div>}
                    
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{node.type}</Badge>
                      {node.linkedChapterId ? (
                        <Badge variant="secondary" className="text-[10px] text-green-600 border-green-200">
                          Chương ✓
                        </Badge>
                      ) : (
                        onConvertToChapter && (
                          <button
                            type="button"
                            className="text-[10px] text-primary hover:underline flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConvertToChapter(node);
                            }}
                          >
                            + Tạo chương
                          </button>
                        )
                      )}
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

      {/* Edit & Detail Dialog */}
      <Dialog open={!!activeNode} onOpenChange={(open) => !open && setActiveNode(null)}>
        <DialogContent onClose={() => setActiveNode(null)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết thẻ Kanban</DialogTitle>
            <DialogDescription>Chỉnh sửa thông tin thẻ hoặc chuyển sang chương</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium block mb-1">Tiêu đề</label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Tiêu đề..."
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Mô tả tóm tắt</label>
              <Textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={4}
                placeholder="Mô tả nội dung thẻ..."
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Trạng thái cột</label>
              <select
                className="flex h-9 w-full rounded-lg border border-input px-3 text-sm bg-background"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
              >
                <option value="idea">💡 Ý tưởng</option>
                <option value="planned">📋 Đã lên kế hoạch</option>
                <option value="written">✍️ Đã viết</option>
                <option value="revised">✅ Đã sửa</option>
              </select>
            </div>

            {onConvertToChapter && (
              <div className="pt-2 border-t">
                {activeNode?.linkedChapterId ? (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-950/20 p-2.5 rounded-lg border border-green-200">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Đã tạo chương trong bản thảo cho thẻ này.</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      onConvertToChapter(activeNode);
                      setActiveNode(null);
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Tạo chương trong bản thảo từ thẻ này
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onDelete(activeNode.id);
                    setActiveNode(null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Xóa thẻ
                </Button>
              ) : <div />}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveNode(null)}>
                  Đóng
                </Button>
                <Button size="sm" onClick={handleSave}>
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

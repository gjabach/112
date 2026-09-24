'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BookOpen, CheckCircle, Edit, Trash2 } from 'lucide-react';

interface CorkboardViewProps {
  nodes: any[];
  onUpdate: (id: string, data: any) => void;
  onConvertToChapter?: (node: any) => void;
  onDelete?: (id: string) => void;
}

export function CorkboardView({ nodes, onUpdate, onConvertToChapter, onDelete }: CorkboardViewProps) {
  const [activeNode, setActiveNode] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('idea');

  // Simulate corkboard with consistent pseudo-random rotations
  const getRotation = (id: string) => {
    const hash = id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    return (hash % 6) - 3; // -3 to 3 degrees
  };

  const handleOpenNode = (node: any) => {
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
    <div className="relative min-h-[600px] bg-[#f5e6d3] dark:bg-[#2a2520] rounded-xl p-8 overflow-auto"
         style={{
           backgroundImage: `radial-gradient(#d4c4a8 1px, transparent 1px)`,
           backgroundSize: '20px 20px'
         }}>
      
      {/* Corkboard texture overlay */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
           }}></div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-min">
        {nodes.map((node: any) => {
          const rotation = getRotation(node.id);
          
          return (
            <Card
              key={node.id}
              className="cursor-pointer transition-all hover:shadow-xl hover:z-10 hover:scale-105 bg-yellow-50 dark:bg-yellow-900/20 border-2 shadow-md group"
              style={{
                transform: `rotate(${rotation}deg)`,
                borderTopColor: node.color || '#facc15'
              }}
              onClick={() => handleOpenNode(node)}
            >
              {/* Pin */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full shadow-md border-2 border-red-600 z-10"></div>
              
              <CardContent className="p-4 pt-6">
                <div className="font-handwriting font-bold text-sm mb-2 text-gray-800 dark:text-gray-200 line-clamp-2" style={{ fontFamily: 'Crimson Pro, serif' }}>
                  {node.title}
                </div>
                
                {node.description && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed">
                    {node.description}
                  </div>
                )}

                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <Badge variant="outline" className="text-[10px] bg-white/50">{node.type}</Badge>
                  <Badge className={`text-[10px] text-white ${
                    node.status === 'idea' ? 'bg-gray-500' :
                    node.status === 'planned' ? 'bg-blue-500' :
                    node.status === 'written' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}>
                    {node.status}
                  </Badge>
                  {node.linkedChapterId && (
                    <Badge variant="secondary" className="text-[10px] text-green-600 border-green-200">
                      Chương ✓
                    </Badge>
                  )}
                </div>

                <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[11px] text-primary flex items-center gap-1">
                    <Edit className="w-3 h-3" /> Chi tiết / Sửa
                  </span>
                </div>

                {/* Tape effect */}
                <div className="absolute -top-1 -right-1 w-12 h-6 bg-white/40 rotate-12 shadow-sm pointer-events-none"></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {nodes.length === 0 && (
        <div className="relative text-center py-20 text-muted-foreground">
          <div className="text-6xl mb-4">📌</div>
          <p>Bảng ghim trống - Thêm outline nodes để ghim lên đây</p>
        </div>
      )}

      {/* Edit & Detail Dialog */}
      <Dialog open={!!activeNode} onOpenChange={(open) => !open && setActiveNode(null)}>
        <DialogContent onClose={() => setActiveNode(null)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết thẻ dàn ý</DialogTitle>
            <DialogDescription>Chỉnh sửa nội dung hoặc chuyển đổi thẻ sang chương truyện</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium block mb-1">Tiêu đề</label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Tiêu đề node..."
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Mô tả / Tóm tắt sự kiện</label>
              <Textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={4}
                placeholder="Ghi chú chi tiết cho phân cảnh này..."
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Trạng thái tiến độ</label>
              <select
                className="flex h-9 w-full rounded-lg border border-input px-3 text-sm bg-background"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
              >
                <option value="idea">💡 Ý tưởng (Idea)</option>
                <option value="planned">📋 Đã lên kế hoạch (Planned)</option>
                <option value="written">✍️ Đã viết (Written)</option>
                <option value="revised">✅ Đã chỉnh sửa (Revised)</option>
              </select>
            </div>

            {onConvertToChapter && (
              <div className="pt-2 border-t">
                {activeNode?.linkedChapterId ? (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-950/20 p-2.5 rounded-lg border border-green-200">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Thẻ này đã được liên kết với một chương trong bản thảo.</span>
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

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Globe, Plus, Trash2, Sparkles, Sliders, Layers, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Entity {
  id?: string;
  projectId?: string;
  name: string;
  type: string;
  description?: string;
  attributes?: Record<string, string>;
  imageUrl?: string;
  relatedEntityIds?: string[];
  tags?: string[];
}

interface LoreDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Entity | null;
  onSave: (data: Partial<Entity>) => Promise<void>;
  loading?: boolean;
}

const categoryPresets: Record<string, { label: string; icon: string; defaultAttrs: string[] }> = {
  location: {
    label: 'Địa danh & Địa lý',
    icon: '🏰',
    defaultAttrs: ['Khí hậu', 'Địa hình', 'Mức độ nguy hiểm', 'Cư dân chủ yếu', 'Thủ phủ / Địa điểm then chốt']
  },
  organization: {
    label: 'Phe phái & Bang hội',
    icon: '🏛️',
    defaultAttrs: ['Thủ lĩnh / Người đứng đầu', 'Tôn chỉ & Mục tiêu', 'Trụ sở chính', 'Thế lực thù địch', 'Quy mô ảnh hưởng']
  },
  magic_system: {
    label: 'Ma pháp & Công nghệ',
    icon: '✨',
    defaultAttrs: ['Quy luật vận hành', 'Nguồn năng lượng', 'Cái giá phải trả / Tác dụng phụ', 'Cấp bậc', 'Quy tắc cấm kỵ']
  },
  species: {
    label: 'Chủng tộc & Sinh vật',
    icon: '🧝',
    defaultAttrs: ['Tuổi thọ trung bình', 'Đặc điểm thể chất', 'Khả năng bẩm sinh', 'Văn hóa & Tập tục', 'Môi trường sống']
  },
  item: {
    label: 'Báu vật & Vật phẩm',
    icon: '🗡️',
    defaultAttrs: ['Cấp độ hiếm', 'Nguồn gốc rèn tạo', 'Quyền năng đặc biệt', 'Cơ chế kích hoạt', 'Lời nguyền / Hạn chế']
  },
  religion: {
    label: 'Tín ngưỡng & Tôn giáo',
    icon: '🕊️',
    defaultAttrs: ['Vị thần tôn thờ', 'Giáo điều cốt lõi', 'Nghi thức tế lễ', 'Thánh địa', 'Huy hiệu tôn giáo']
  },
  event: {
    label: 'Lịch sử & Niên đại',
    icon: '📜',
    defaultAttrs: ['Thời điểm diễn ra', 'Địa điểm xảy ra', 'Nhân vật chủ chốt', 'Hậu quả địa chính trị', 'Ý nghĩa lịch sử']
  }
};

export function LoreDetailDialog({
  isOpen,
  onClose,
  entity,
  onSave,
  loading = false
}: LoreDetailDialogProps) {
  const [form, setForm] = useState<Entity>({
    name: '',
    type: 'location',
    description: '',
    attributes: {}
  });

  const [attrKey, setAttrKey] = useState('');
  const [attrVal, setAttrVal] = useState('');

  useEffect(() => {
    if (entity) {
      setForm({
        ...entity,
        attributes: entity.attributes && typeof entity.attributes === 'object' ? entity.attributes : {}
      });
    } else {
      setForm({
        name: '',
        type: 'location',
        description: '',
        attributes: {}
      });
    }
  }, [entity, isOpen]);

  const currentPreset = categoryPresets[form.type] || categoryPresets.location;

  const handleAddAttribute = () => {
    if (!attrKey.trim()) return;
    setForm(prev => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [attrKey.trim()]: attrVal.trim()
      }
    }));
    setAttrKey('');
    setAttrVal('');
  };

  const handleAddPresetAttr = (presetName: string) => {
    if (!form.attributes?.[presetName]) {
      setForm(prev => ({
        ...prev,
        attributes: {
          ...(prev.attributes || {}),
          [presetName]: ''
        }
      }));
    }
  };

  const handleRemoveAttribute = (key: string) => {
    setForm(prev => {
      const next = { ...(prev.attributes || {}) };
      delete next[key];
      return { ...prev, attributes: next };
    });
  };

  const handleUpdateAttrValue = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [key]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Tên thực thể không được để trống');
      return;
    }
    await onSave(form);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden border border-border/70 shadow-2xl bg-card rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-xl shrink-0">
              {currentPreset.icon}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                {entity ? `Bách Khoa Lore: ${entity.name}` : 'Thêm Mục Bách Khoa Thế Giới Mới'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Thiết lập quy luật, bối cảnh, lịch sử và các thuộc tính chi tiết cho thế giới
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-semibold text-foreground">Tên thực thể *</label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Thành Cổ Aethelgard, Hội Hiệp Sĩ Ánh Trăng..."
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Phân loại</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
              >
                {Object.entries(categoryPresets).map(([k, cfg]) => (
                  <option key={k} value={k}>
                    {cfg.icon} {cfg.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description / Lore content */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Mô tả bách khoa & Lịch sử hình thành</label>
            <Textarea
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Chi tiết về nguồn gốc, quy luật, bối cảnh địa chính trị, truyền thuyết dân gian..."
              className="min-h-[110px] text-xs leading-relaxed"
            />
          </div>

          {/* Custom Attributes Section */}
          <div className="border rounded-xl p-3 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" /> Thuộc tính chuyên sâu (Key-Value)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Gợi ý cho {currentPreset.label}
              </span>
            </div>

            {/* Quick preset attribute suggestions */}
            <div className="flex flex-wrap gap-1">
              {currentPreset.defaultAttrs.map((preset) => {
                const isAdded = !!form.attributes?.[preset];
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddPresetAttr(preset)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                      isAdded
                        ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    + {preset}
                  </button>
                );
              })}
            </div>

            {/* Custom Attribute List */}
            <div className="space-y-2 pt-1">
              {Object.entries(form.attributes || {}).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-36 font-semibold text-muted-foreground truncate shrink-0 text-right">
                    {key}:
                  </span>
                  <Input
                    value={val}
                    onChange={e => handleUpdateAttrValue(key, e.target.value)}
                    placeholder={`Nhập ${key.toLowerCase()}...`}
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemoveAttribute(key)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add Custom Attribute Row */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/60">
              <Input
                value={attrKey}
                onChange={e => setAttrKey(e.target.value)}
                placeholder="Tên thuộc tính mới..."
                className="h-7 text-xs w-44 shrink-0"
              />
              <Input
                value={attrVal}
                onChange={e => setAttrVal(e.target.value)}
                placeholder="Giá trị..."
                className="h-7 text-xs flex-1"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAttribute())}
              />
              <Button size="sm" type="button" onClick={handleAddAttribute} className="h-7 text-xs shrink-0">
                <Plus className="w-3 h-3 mr-1" /> Thêm
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/20 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading} className="text-xs h-8">
            Hủy
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading} className="text-xs h-8 font-semibold">
            {loading ? 'Đang lưu...' : 'Lưu Mục Bách Khoa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Shield, 
  Wand2, 
  Users, 
  Sword, 
  Sparkles, 
  Scroll, 
  Eye, 
  Edit3, 
  Trash2, 
  Copy,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Entity {
  id: string;
  projectId?: string;
  name: string;
  type: string;
  description?: string;
  attributes?: Record<string, string>;
  imageUrl?: string;
  relatedEntityIds?: string[];
  tags?: string[];
}

interface LoreCodexCardProps {
  entity: Entity;
  onOpenDetail: (entity: Entity) => void;
  onEdit: (entity: Entity) => void;
  onDelete: (id: string, name: string) => void;
}

const typeConfigs: Record<string, { label: string; icon: string; border: string; bg: string; text: string }> = {
  location: { label: 'Địa danh', icon: '🏰', border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  organization: { label: 'Phe phái', icon: '🏛️', border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  magic_system: { label: 'Ma pháp / Kỹ thuật', icon: '✨', border: 'border-purple-500/40', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  species: { label: 'Chủng tộc', icon: '🧝', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  item: { label: 'Báu vật / Vật phẩm', icon: '🗡️', border: 'border-rose-500/40', bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
  religion: { label: 'Tín ngưỡng', icon: '🕊️', border: 'border-sky-500/40', bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400' },
  event: { label: 'Lịch sử & Niên đại', icon: '📜', border: 'border-indigo-500/40', bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' }
};

export function LoreCodexCard({ entity, onOpenDetail, onEdit, onDelete }: LoreCodexCardProps) {
  const cfg = typeConfigs[entity.type] || typeConfigs.location;
  const attributes = entity.attributes && typeof entity.attributes === 'object' ? entity.attributes : {};
  const attrEntries = Object.entries(attributes);

  const copyLore = () => {
    const text = `${entity.name} (${cfg.label}):\n${entity.description || ''}`;
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép tóm tắt lore của "${entity.name}"!`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl border ${cfg.border} bg-card p-4 transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col justify-between group`}
    >
      <div className="space-y-3">
        {/* Top Header: Icon, Name, Category badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl ${cfg.bg} border flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform`}>
              {cfg.icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                {entity.name}
              </h3>
              <Badge variant="outline" className={`text-[10px] px-2 py-0 mt-0.5 ${cfg.bg} ${cfg.text} border-current/30`}>
                {cfg.label}
              </Badge>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
            onClick={copyLore}
            title="Sao chép tóm tắt lore"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Description */}
        {entity.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed bg-muted/20 p-2.5 rounded-xl">
            {entity.description}
          </p>
        )}

        {/* Custom Attributes Badges */}
        {attrEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {attrEntries.slice(0, 3).map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-muted/60 border text-muted-foreground font-medium"
              >
                <strong className="text-foreground">{k}:</strong> {v}
              </span>
            ))}
            {attrEntries.length > 3 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{attrEntries.length - 3} thuộc tính
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-primary font-medium px-2"
          onClick={() => onOpenDetail(entity)}
        >
          <Eye className="w-3.5 h-3.5 mr-1" /> Chi tiết bách khoa
        </Button>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(entity)}
            title="Chỉnh sửa"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(entity.id, entity.name)}
            title="Xóa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

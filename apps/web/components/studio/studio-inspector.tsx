'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Film,
  Sparkles,
  Search,
  Plus,
  X,
  ChevronRight,
  User,
  MapPin,
  Shield,
  Send,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
  PanelRightClose,
  MessageSquare,
  Wand2,
  Flame,
  Volume2,
  Target,
  FileEdit,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { executeAIChat } from '@/lib/ai';
import { apiFetch } from '@/lib/utils';
import { readWorkspaceCache } from '@/lib/workspace-cache';

export type LoreCategory = 'all' | 'character' | 'location' | 'item';
export type LoreRole = 'protagonist' | 'antagonist' | 'ally' | 'minor' | 'location' | 'item';

export interface LoreCardItem {
  id: string;
  projectId: string;
  name: string;
  category: 'character' | 'location' | 'item';
  role: LoreRole;
  avatarUrl: string;
  summary: string;
  appearance?: string;
  personality?: string;
  motivation?: string;
  secrets?: string;
  tags?: string[];
  notes?: string;
}

// Curated high-aesthetic portrait presets from Unsplash CDN
export const PORTRAIT_PRESETS = [
  {
    label: 'Nhân vật chính (Aesthetic)',
    category: 'character' as const,
    role: 'protagonist' as const,
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Hiệp sĩ quả cảm',
    category: 'character' as const,
    role: 'protagonist' as const,
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Phản diện sắc sảo',
    category: 'character' as const,
    role: 'antagonist' as const,
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Nữ vương bí ẩn',
    category: 'character' as const,
    role: 'antagonist' as const,
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Học giả uyên bác',
    category: 'character' as const,
    role: 'ally' as const,
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Đồng minh trẻ tuổi',
    category: 'character' as const,
    role: 'ally' as const,
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Thành trì cổ đại',
    category: 'location' as const,
    role: 'location' as const,
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Khu rừng mê giới',
    category: 'location' as const,
    role: 'location' as const,
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Cổ thư ngàn năm',
    category: 'item' as const,
    role: 'item' as const,
    url: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'La bàn tinh tú',
    category: 'item' as const,
    role: 'item' as const,
    url: 'https://images.unsplash.com/photo-1512418490979-92798cec1380?auto=format&fit=crop&w=400&q=80',
  },
];

// Rich default starter lore cards if none exist
const DEFAULT_STARTER_LORE: LoreCardItem[] = [
  {
    id: 'starter-1',
    projectId: 'default',
    name: 'Kaelen Thần Phong',
    category: 'character',
    role: 'protagonist',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    summary: 'Kiếm sĩ lưu vong mang dòng máu phong linh, tìm kiếm chân lý về lời nguyền gia tộc.',
    appearance: 'Mắt xám ánh bạc, vết sẹo dài qua vai trái, khoác trường bào rách gió xám.',
    personality: 'Trầm tĩnh, quyết đoán, bảo vệ công lý nhưng luôn giữ khoảng cách với người lạ.',
    motivation: 'Hóa giải lời nguyền ngàn năm đè nặng lên huyết mạch tổ tiên.',
    secrets: 'Là người duy nhất nghe được tiếng thở của Long Thần cổ đại.',
    tags: ['Chính diện', 'Kiếm thuật', 'Phong linh'],
  },
  {
    id: 'starter-2',
    projectId: 'default',
    name: 'Vespera - Nữ Chúa Đêm',
    category: 'character',
    role: 'antagonist',
    avatarUrl:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    summary: 'Thủ lĩnh giáo phái Hắc Nguyệt, mưu đồ hồi sinh Ma Thần bị phong ấn dưới vực sâu.',
    appearance: 'Dung mạo diễm lệ sắc sảo, tóc đen tuyền kết chuỗi đá mắt mèo tím.',
    personality: 'Khôn ngoan khôn lường, thao túng tâm lý bậc thầy, không từ thủ đoạn.',
    motivation: 'Tái lập trật tự thế giới dưới bóng tối vĩnh hằng để xóa bỏ mọi khổ đau.',
    secrets: 'Từng là thanh mai trúc mã của vị hiền triết sáng lập vương quốc.',
    tags: ['Phản diện', 'Hắc thuật', 'Mưu mô'],
  },
  {
    id: 'starter-3',
    projectId: 'default',
    name: 'Pháo Đài Aethelgard',
    category: 'location',
    role: 'location',
    avatarUrl:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    summary: 'Cố đô ngàn năm tọa lạc giữa hẻm núi tuyết, nơi lưu giữ thư viện cấm.',
    appearance: 'Tường đá xám cao 50 trượng, quanh năm phủ tuyết trắng và sương mù dày đặc.',
    personality: 'Bầu không khí trang nghiêm, u tịch và phảng phất mùi trầm hương hoàng gia.',
    motivation: 'Thành lũy cuối cùng ngăn cách thế giới loài người với vùng hoang mạc Ma Giới.',
    secrets: 'Tầng hầm thứ 9 của thư viện cất giấu bản đồ dẫn đến Hạch Tâm Thế Giới.',
    tags: ['Địa danh', 'Kinh đô', 'Pháo đài'],
  },
  {
    id: 'starter-4',
    projectId: 'default',
    name: 'Ngọc Huyết Tinh Long',
    category: 'item',
    role: 'item',
    avatarUrl:
      'https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=400&q=80',
    summary: 'Viên bảo ngọc kết tinh từ giọt máu cuối cùng của Thần Long thượng cổ.',
    appearance: 'Khối ngọc đỏ thẫm hình lục giác, phát ra nhịp đập ấm áp như trái tim còn sống.',
    personality: 'Cộng hưởng với ý chí của người sở hữu, thiêu đốt kẻ tà niệm.',
    motivation: 'Chìa khóa kích hoạt Trận Pháp Thái Cổ bảo vệ vương triều.',
    secrets: 'Nếu vỡ, năng lượng giải phóng đủ sức thiêu rụi một phương sơn hà.',
    tags: ['Bảo vật', 'Thần khí', 'Huyết ngọc'],
  },
];

export function getRoleBadgeStyle(role: LoreRole) {
  switch (role) {
    case 'protagonist':
      return {
        label: 'Protagonist',
        className: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10',
      };
    case 'antagonist':
      return {
        label: 'Antagonist',
        className: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10',
      };
    case 'ally':
      return {
        label: 'Ally',
        className: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      };
    case 'location':
      return {
        label: 'Location',
        className: 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10',
      };
    case 'item':
      return {
        label: 'Item',
        className: 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10',
      };
    default:
      return {
        label: 'Minor',
        className: 'border-border text-muted-foreground bg-muted/40',
      };
  }
}

interface StudioInspectorProps {
  projectId: string;
  chapterId: string;
  chapterTitle?: string;
  chapterContent?: string;
  isOpen: boolean;
  onToggle: () => void;
  onInsertText?: (text: string) => void;
  className?: string;
}

export function StudioInspector({
  projectId,
  chapterId,
  chapterTitle = '',
  chapterContent = '',
  isOpen,
  onToggle,
  onInsertText,
  className = '',
}: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<'codex' | 'beats' | 'copilot'>('codex');

  // Codex Lore Cards State
  const [loreCards, setLoreCards] = useState<LoreCardItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<LoreCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardForView, setSelectedCardForView] = useState<LoreCardItem | null>(null);
  const [hoveredCard, setHoveredCard] = useState<LoreCardItem | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; right: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [cardFormData, setCardFormData] = useState<Partial<LoreCardItem>>({
    name: '',
    category: 'character',
    role: 'protagonist',
    avatarUrl: PORTRAIT_PRESETS[0].url,
    summary: '',
    appearance: '',
    personality: '',
    motivation: '',
    secrets: '',
  });

  // Scene Beats State
  const [sceneObjective, setSceneObjective] = useState('');
  const [scenePov, setScenePov] = useState('');
  const [sceneConflict, setSceneConflict] = useState('');
  const [sceneNotes, setSceneNotes] = useState('');
  const [sceneStatus, setSceneStatus] = useState<'outline' | 'draft' | 'revised' | 'final'>('draft');

  // AI Co-pilot State
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratingSkill, setAiGeneratingSkill] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState('');
  const [copied, setCopied] = useState(false);

  // Load Codex cards from local storage / API
  useEffect(() => {
    if (!projectId) return;
    try {
      const stored = localStorage.getItem(`novelist_codex_${projectId}`);
      if (stored) {
        setLoreCards(JSON.parse(stored));
      } else {
        // Fallback to shared workspace characters or starter lore
        const workspaceChars = readWorkspaceCache('novelist_characters', []);
        const projectChars = workspaceChars.filter((c: any) => c.projectId === projectId);
        if (projectChars.length > 0) {
          const mapped: LoreCardItem[] = projectChars.map((c: any, idx: number) => ({
            id: c.id || `c-${idx}`,
            projectId,
            name: c.name || 'Nhân vật',
            category: 'character',
            role: (c.role as LoreRole) || 'protagonist',
            avatarUrl: c.avatarUrl || PORTRAIT_PRESETS[idx % PORTRAIT_PRESETS.length].url,
            summary: c.background || c.appearance || 'Hồ sơ nhân vật',
            appearance: c.appearance || '',
            personality: c.personality || '',
            motivation: c.motivation || '',
            secrets: c.secrets || '',
            tags: c.tags || [],
          }));
          setLoreCards(mapped);
          localStorage.setItem(`novelist_codex_${projectId}`, JSON.stringify(mapped));
        } else {
          // Provide vibrant starter lore for a luxurious zero-state experience
          const starters = DEFAULT_STARTER_LORE.map((c) => ({ ...c, projectId }));
          setLoreCards(starters);
          localStorage.setItem(`novelist_codex_${projectId}`, JSON.stringify(starters));
        }
      }
    } catch {
      setLoreCards(DEFAULT_STARTER_LORE.map((c) => ({ ...c, projectId })));
    }
  }, [projectId]);

  // Load Scene Beats for current chapter
  const loreCardsRef = useRef(loreCards);
  loreCardsRef.current = loreCards;

  useEffect(() => {
    if (!chapterId) return;
    try {
      const savedBeats = localStorage.getItem(`novelist_beats_${chapterId}`);
      if (savedBeats) {
        const parsed = JSON.parse(savedBeats);
        setSceneObjective(parsed.objective || '');
        setScenePov(parsed.pov || '');
        setSceneConflict(parsed.conflict || '');
        setSceneNotes(parsed.notes || '');
        setSceneStatus(parsed.status || 'draft');
      } else {
        // Pre-fill smart defaults based on chapter title
        setSceneObjective('Phát triển mâu thuẫn cốt lõi và làm nổi bật động cơ của nhân vật chính.');
        setScenePov(loreCardsRef.current[0]?.name || 'Ngôi thứ ba giới hạn');
        setSceneConflict('Áp lực thời gian đe dọa sự an nguy của liên minh.');
        setSceneNotes('Chú ý gài bẫy chi tiết ở đoạn kết để mở ra bước ngoặt mới.');
        setSceneStatus('draft');
      }
    } catch {
      // Ignore parse errors
    }
  }, [chapterId]);

  // Auto-save Scene Beats to localStorage and sync status
  const saveBeats = (updates: Partial<{
    objective: string;
    pov: string;
    conflict: string;
    notes: string;
    status: 'outline' | 'draft' | 'revised' | 'final';
  }>) => {
    if (!chapterId) return;
    const current = {
      objective: sceneObjective,
      pov: scenePov,
      conflict: sceneConflict,
      notes: sceneNotes,
      status: sceneStatus,
      ...updates,
    };
    try {
      localStorage.setItem(`novelist_beats_${chapterId}`, JSON.stringify(current));
    } catch {}

    // Synchronize chapter status if updated
    if (updates.status && updates.status !== sceneStatus) {
      apiFetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: updates.status }),
      }).catch(() => {});
    }
  };

  // Save or update lore card
  const handleSaveCard = () => {
    if (!cardFormData.name?.trim()) {
      toast.error('Vui lòng nhập tên thẻ hồ sơ');
      return;
    }

    let updatedList: LoreCardItem[];
    let savedCard: LoreCardItem;
    if (isEditingCard && cardFormData.id) {
      savedCard = { ...cardFormData } as LoreCardItem;
      updatedList = loreCards.map((c) =>
        c.id === cardFormData.id ? ({ ...c, ...cardFormData } as LoreCardItem) : c
      );
      toast.success('Đã cập nhật hồ sơ Codex');
    } else {
      savedCard = {
        id: `card-${Date.now()}`,
        projectId,
        name: cardFormData.name.trim(),
        category: (cardFormData.category as any) || 'character',
        role: (cardFormData.role as any) || 'protagonist',
        avatarUrl: cardFormData.avatarUrl || PORTRAIT_PRESETS[0].url,
        summary: cardFormData.summary || 'Hồ sơ mới tạo',
        appearance: cardFormData.appearance || '',
        personality: cardFormData.personality || '',
        motivation: cardFormData.motivation || '',
        secrets: cardFormData.secrets || '',
        tags: cardFormData.tags || [],
      };
      updatedList = [savedCard, ...loreCards];
      toast.success('Đã thêm thẻ mới vào Codex Wiki');
    }

    setLoreCards(updatedList);
    try {
      localStorage.setItem(`novelist_codex_${projectId}`, JSON.stringify(updatedList));

      // Synchronize characters with global novelist_characters store
      if (savedCard.category === 'character') {
        const workspaceChars = JSON.parse(localStorage.getItem('novelist_characters') || '[]');
        const existingIdx = workspaceChars.findIndex((c: any) => c.id === savedCard.id);
        const charRecord = {
          id: savedCard.id,
          projectId,
          name: savedCard.name,
          role: savedCard.role,
          appearance: savedCard.appearance || '',
          personality: savedCard.personality || '',
          background: savedCard.summary || '',
          motivation: savedCard.motivation || '',
          secrets: savedCard.secrets || '',
          avatarUrl: savedCard.avatarUrl,
          tags: savedCard.tags || [],
          updatedAt: Date.now(),
          createdAt: Date.now(),
        };
        if (existingIdx >= 0) {
          workspaceChars[existingIdx] = { ...workspaceChars[existingIdx], ...charRecord };
        } else {
          workspaceChars.push(charRecord);
        }
        localStorage.setItem('novelist_characters', JSON.stringify(workspaceChars));
        window.dispatchEvent(new CustomEvent('novelist-characters-updated'));
      }
    } catch {}

    setIsEditingCard(false);
    setSelectedCardForView(null);
  };

  // Delete lore card
  const handleDeleteCard = (cardId: string) => {
    const updated = loreCards.filter((c) => c.id !== cardId);
    setLoreCards(updated);
    try {
      localStorage.setItem(`novelist_codex_${projectId}`, JSON.stringify(updated));
      const workspaceChars = JSON.parse(localStorage.getItem('novelist_characters') || '[]');
      const filtered = workspaceChars.filter((c: any) => c.id !== cardId);
      localStorage.setItem('novelist_characters', JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('novelist-characters-updated'));
    } catch {}
    if (selectedCardForView?.id === cardId) setSelectedCardForView(null);
    toast.success('Đã xóa thẻ khỏi Codex');
  };

  // Insert card name or text into editor
  const handleInsertMention = (text: string) => {
    if (onInsertText) {
      onInsertText(text);
    } else {
      window.dispatchEvent(new CustomEvent('novelist-insert-text', { detail: { text } }));
    }
    const clean = text.trim();
    if (clean.length > 35 || clean.includes('\n')) {
      toast.success('Đã chèn nội dung vào bản thảo');
    } else {
      toast.success(`Đã chèn "${clean}" vào bài viết`);
    }
  };

  // Filtered lore cards
  const filteredCards = useMemo(() => {
    return loreCards.filter((card) => {
      const matchCategory = categoryFilter === 'all' || card.category === categoryFilter;
      const matchSearch =
        !searchQuery ||
        card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.role?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [loreCards, categoryFilter, searchQuery]);

  // Execute AI Co-pilot Quick Action
  const handleAIQuickAction = async (
    actionType: 'continue' | 'sensory' | 'dialogue' | 'climax',
    customInstruction?: string
  ) => {
    setAiLoading(true);
    setAiGeneratingSkill(actionType);
    setAiOutput('');

    try {
      let promptMessage = '';
      let skillName: string | null = null;

      const sceneContext = `[Bối cảnh Cảnh: "${chapterTitle}"]
Mục tiêu cảnh: ${sceneObjective || 'Chưa định nghĩa'}
Góc nhìn (POV): ${scenePov || 'Toàn tri'}
Xung đột chính: ${sceneConflict || 'Chưa định nghĩa'}
Nội dung văn bản hiện có:
"""
${chapterContent.slice(-1500) || 'Bắt đầu khởi đầu cho cảnh sáng tác.'}
"""`;

      if (actionType === 'continue') {
        skillName = 'continue_writing';
        promptMessage = `${sceneContext}\n\nHãy viết tiếp phân đoạn tiếp theo một cách mượt mà, gay cấn và cuốn hút. ${customInstruction || ''}`;
      } else if (actionType === 'sensory') {
        skillName = 'description_enhance';
        promptMessage = `${sceneContext}\n\nHãy tập trung miêu tả chi tiết ngũ giác (thị giác, thính giác, khứu giác, xúc giác, vị giác) và không gian bầu không khí để làm nổi bật sự căng thẳng của cảnh này. ${customInstruction || ''}`;
      } else if (actionType === 'dialogue') {
        skillName = 'character_voice';
        promptMessage = `${sceneContext}\n\nHãy sáng tác hoặc trau chuốt lời thoại giữa các nhân vật trong cảnh, làm nổi bật phong thái sắc sảo, ẩn ý đối đầu và giọng điệu riêng biệt của từng người. ${customInstruction || ''}`;
      } else if (actionType === 'climax') {
        skillName = 'expand';
        promptMessage = `${sceneContext}\n\nHãy đẩy mâu thuẫn trong cảnh lên đỉnh điểm cao trào kịch tính (Climax escalation), dồn nhân vật vào thế tiến thoái lưỡng nan với những đặt cược sinh tử hoặc bước ngoặt không thể quay đầu. ${customInstruction || ''}`;
      }

      await executeAIChat({
        projectId,
        contextType: 'chapter',
        contextId: chapterId,
        message: promptMessage,
        skill: skillName,
        stream: true,
        onChunk: (chunk) => {
          setAiOutput((prev) => prev + chunk);
        },
      });
      toast.success('AI Co-pilot đã sáng tác xong!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối AI Co-pilot');
    } finally {
      setAiLoading(false);
      setAiGeneratingSkill(null);
    }
  };

  const handleCopyOutput = () => {
    if (!aiOutput) return;
    navigator.clipboard.writeText(aiOutput);
    setCopied(true);
    toast.success('Đã sao chép nội dung AI');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Studio Inspector"
      className={`studio-inspector relative flex flex-col w-full md:w-80 lg:w-96 border-l border-border bg-card/98 backdrop-blur-md shadow-xl z-20 h-full overflow-hidden shrink-0 transition-all duration-200 select-none ${className}`}
    >
      {/* Inspector Header */}
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 shrink-0 bg-muted/30">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            Studio Inspector
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            onClick={onToggle}
            title="Thu gọn Inspector (Ctrl+I)"
          >
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border p-1.5 gap-1 shrink-0 bg-muted/20">
        <button
          onClick={() => {
            setActiveTab('codex');
            setSelectedCardForView(null);
            setIsEditingCard(false);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'codex'
              ? 'bg-background text-foreground shadow-2xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Codex Wiki</span>
          <span className="text-[10px] opacity-60">({loreCards.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('beats');
            setSelectedCardForView(null);
            setIsEditingCard(false);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'beats'
              ? 'bg-background text-foreground shadow-2xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Scene Beats</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('copilot');
            setSelectedCardForView(null);
            setIsEditingCard(false);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'copilot'
              ? 'bg-background text-foreground shadow-2xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>AI Co-pilot</span>
        </button>
      </div>

      {/* Main Tab Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 select-text">
        {/* ================= TAB 1: CODEX WIKI ================= */}
        {activeTab === 'codex' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* View/Edit Card Overlay or Form */}
            {selectedCardForView ? (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-md animate-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedCardForView.avatarUrl}
                      alt={selectedCardForView.name}
                      className="w-12 h-12 rounded-xl object-cover border border-border/80 shadow-xs"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {selectedCardForView.name}
                      </h4>
                      <div className="flex gap-1.5 mt-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                        >
                          {selectedCardForView.role}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {selectedCardForView.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedCardForView(null)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium block mb-0.5">Tóm tắt:</span>
                    <p className="text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border/40">
                      {selectedCardForView.summary || 'Không có mô tả.'}
                    </p>
                  </div>
                  {selectedCardForView.appearance && (
                    <div>
                      <span className="text-muted-foreground font-medium block mb-0.5">Diện mạo:</span>
                      <p className="text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border/40">
                        {selectedCardForView.appearance}
                      </p>
                    </div>
                  )}
                  {selectedCardForView.motivation && (
                    <div>
                      <span className="text-muted-foreground font-medium block mb-0.5">Động cơ:</span>
                      <p className="text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border/40">
                        {selectedCardForView.motivation}
                      </p>
                    </div>
                  )}
                  {selectedCardForView.secrets && (
                    <div>
                      <span className="text-amber-600 dark:text-amber-400 font-medium block mb-0.5">Bí mật cốt truyện:</span>
                      <p className="text-amber-800 dark:text-amber-200 leading-relaxed bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/25">
                        {selectedCardForView.secrets}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs flex-1 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => handleInsertMention(selectedCardForView.name)}
                  >
                    <Send className="w-3 h-3" />
                    Chèn tên vào bài
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={() => {
                      setCardFormData(selectedCardForView);
                      setIsEditingCard(true);
                    }}
                    title="Chỉnh sửa hồ sơ"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteCard(selectedCardForView.id)}
                    title="Xóa hồ sơ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : isEditingCard ? (
              // Add/Edit Card Form
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-md animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    {cardFormData.id ? 'Chỉnh sửa hồ sơ Codex' : 'Tạo hồ sơ Codex mới'}
                  </h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditingCard(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Tên định danh *
                    </label>
                    <Input
                      placeholder="Ví dụ: Alex Mercer, Pháo đài..."
                      value={cardFormData.name || ''}
                      onChange={(e) => setCardFormData({ ...cardFormData, name: e.target.value })}
                      className="h-8 text-xs bg-background border-input text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Phân loại
                      </label>
                      <select
                        value={cardFormData.category || 'character'}
                        onChange={(e) => {
                          const nextCat = e.target.value as LoreCategory;
                          const nextRole: LoreRole =
                            nextCat === 'location'
                              ? 'location'
                              : nextCat === 'item'
                                ? 'item'
                                : cardFormData.role === 'location' || cardFormData.role === 'item'
                                  ? 'protagonist'
                                  : (cardFormData.role || 'protagonist');
                          const matchingPresets = PORTRAIT_PRESETS.filter((p) => p.category === nextCat);
                          const nextAvatar = matchingPresets[0]?.url || cardFormData.avatarUrl;
                          setCardFormData({
                            ...cardFormData,
                            category: nextCat as any,
                            role: nextRole,
                            avatarUrl: nextAvatar,
                          });
                        }}
                        className="w-full h-8 text-xs rounded-md bg-background border border-input px-2 text-foreground"
                      >
                        <option value="character">Nhân vật</option>
                        <option value="location">Địa danh</option>
                        <option value="item">Vật phẩm</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Vai trò
                      </label>
                      <select
                        value={cardFormData.role || 'protagonist'}
                        onChange={(e) =>
                          setCardFormData({ ...cardFormData, role: e.target.value as any })
                        }
                        className="w-full h-8 text-xs rounded-md bg-background border border-input px-2 text-foreground"
                      >
                        <option value="protagonist">Chính diện (Protagonist)</option>
                        <option value="antagonist">Phản diện (Antagonist)</option>
                        <option value="ally">Đồng minh (Ally)</option>
                        <option value="minor">Phụ tá (Minor)</option>
                        <option value="location">Bối cảnh (Location)</option>
                        <option value="item">Vật phẩm (Item)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Ảnh chân dung / Minh họa (URL)
                    </label>
                    <Input
                      placeholder="https://images.unsplash.com/..."
                      value={cardFormData.avatarUrl || ''}
                      onChange={(e) =>
                        setCardFormData({ ...cardFormData, avatarUrl: e.target.value })
                      }
                      className="h-8 text-xs bg-background border-input text-foreground"
                    />
                    {/* Quick Preset Selector matching selected category */}
                    <div className="flex gap-1.5 mt-1.5 overflow-x-auto no-scrollbar py-1">
                      {PORTRAIT_PRESETS.filter(
                        (p) =>
                          !cardFormData.category || cardFormData.category === 'character'
                            ? p.category === 'character'
                            : p.category === cardFormData.category
                      ).map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setCardFormData({
                              ...cardFormData,
                              avatarUrl: preset.url,
                              category: preset.category,
                              role: preset.role,
                            })
                          }
                          className={`shrink-0 w-8 h-8 rounded-lg overflow-hidden border transition-all ${
                            cardFormData.avatarUrl === preset.url
                              ? 'border-primary ring-2 ring-primary/40 scale-105'
                              : 'border-border/80 hover:scale-110'
                          }`}
                          title={preset.label}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Tóm tắt hồ sơ & tiểu sử
                    </label>
                    <Textarea
                      placeholder="Vài dòng khái quát về nhân vật hoặc địa danh..."
                      value={cardFormData.summary || ''}
                      onChange={(e) =>
                        setCardFormData({ ...cardFormData, summary: e.target.value })
                      }
                      className="h-16 text-xs bg-background border-input text-foreground resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Động cơ / Bí mật cốt truyện
                    </label>
                    <Input
                      placeholder="Ví dụ: Mang dòng máu phong ấn..."
                      value={cardFormData.secrets || ''}
                      onChange={(e) =>
                        setCardFormData({ ...cardFormData, secrets: e.target.value })
                      }
                      className="h-8 text-xs bg-background border-input text-foreground"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsEditingCard(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleSaveCard}
                  >
                    Lưu hồ sơ
                  </Button>
                </div>
              </div>
            ) : (
              // Lore Cards Browser
              <>
                {/* Search & Add Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Tìm nhân vật, địa danh..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs bg-muted/40 border-border/70 text-foreground"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                    onClick={() => {
                      setCardFormData({
                        name: '',
                        category: 'character',
                        role: 'protagonist',
                        avatarUrl: PORTRAIT_PRESETS[0].url,
                        summary: '',
                      });
                      setIsEditingCard(true);
                    }}
                    title="Thêm thẻ hồ sơ mới"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Thêm
                  </Button>
                </div>

                {/* Category Pills */}
                <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {(['all', 'character', 'location', 'item'] as LoreCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all shrink-0 capitalize ${
                        categoryFilter === cat
                          ? 'border-primary/60 bg-primary/10 text-primary font-medium'
                          : 'border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      {cat === 'all'
                        ? 'Tất cả'
                        : cat === 'character'
                          ? 'Nhân vật'
                          : cat === 'location'
                            ? 'Địa danh'
                            : 'Vật phẩm'}
                    </button>
                  ))}
                </div>

                {/* Cards Grid */}
                <div className="space-y-2">
                  {filteredCards.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      Không tìm thấy thẻ nào phù hợp. Bấm “Thêm” để tạo thẻ mới.
                    </div>
                  ) : (
                    filteredCards.map((card) => {
                      const roleStyle = getRoleBadgeStyle(card.role);
                      return (
                        <div
                          key={card.id}
                          className="group relative flex items-center gap-3 p-2.5 rounded-xl border border-border/70 bg-card hover:bg-accent/40 hover:border-border transition-all cursor-pointer shadow-2xs"
                          onClick={() => {
                            setHoveredCard(null);
                            setSelectedCardForView(card);
                          }}
                          onMouseEnter={(e) => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoverPos({
                              top: rect.top,
                              right: window.innerWidth - rect.left + 10,
                            });
                            hoverTimeoutRef.current = setTimeout(() => {
                              setHoveredCard(card);
                            }, 120);
                          }}
                          onMouseLeave={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            setHoveredCard(null);
                          }}
                        >
                          {/* Portrait Avatar */}
                          <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-border/80 bg-muted/30">
                            <img
                              src={card.avatarUrl}
                              alt={card.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </div>

                          {/* Info Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {card.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 uppercase tracking-wider font-semibold shrink-0 ${roleStyle.className}`}
                              >
                                {roleStyle.label}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {card.summary}
                            </p>
                          </div>

                          {/* Direct Mention Button on Card */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInsertMention(card.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-primary/20 text-primary transition-opacity shrink-0"
                            title="Chèn tên vào văn bản"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Floating Rich Lore Mini-Popover on Hover (Novelcrafter x Linear Hover Lore Preview) */}
                {hoveredCard && hoverPos && !selectedCardForView && !isEditingCard && (
                  <div
                    style={{
                      top: Math.max(
                        16,
                        Math.min(
                          typeof window !== 'undefined' ? window.innerHeight - 340 : 500,
                          hoverPos.top - 12
                        )
                      ),
                      right: hoverPos.right,
                    }}
                    className="fixed z-50 w-72 rounded-2xl border border-border bg-popover/98 text-popover-foreground p-3.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none select-none"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border/80 shrink-0 shadow-xs">
                        <img
                          src={hoveredCard.avatarUrl}
                          alt={hoveredCard.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {hoveredCard.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 uppercase tracking-wider font-semibold ${
                              getRoleBadgeStyle(hoveredCard.role).className
                            }`}
                          >
                            {getRoleBadgeStyle(hoveredCard.role).label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {hoveredCard.category === 'character'
                              ? 'Nhân vật'
                              : hoveredCard.category === 'location'
                                ? 'Bối cảnh'
                                : 'Vật phẩm'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] leading-relaxed text-foreground line-clamp-3 bg-muted/40 p-2.5 rounded-lg border border-border/40">
                      {hoveredCard.summary || 'Không có mô tả khái quát.'}
                    </p>

                    {(hoveredCard.appearance || hoveredCard.personality) && (
                      <div className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">
                        <span className="font-semibold text-foreground">Đặc trưng: </span>
                        {hoveredCard.appearance || hoveredCard.personality}
                      </div>
                    )}

                    {hoveredCard.secrets && (
                      <div className="mt-1.5 text-[10px] text-amber-800 dark:text-amber-200 bg-amber-500/10 p-2 rounded border border-amber-500/25 line-clamp-2">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Bí mật: </span>
                        {hoveredCard.secrets}
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Bấm thẻ để xem chi tiết & sửa</span>
                      <span className="text-primary font-medium flex items-center gap-0.5">
                        <span>Send icon để chèn</span>
                        <Send className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================= TAB 2: SCENE BEATS ================= */}
        {activeTab === 'beats' && (
          <div className="space-y-4 animate-in fade-in duration-150 text-xs">
            {/* Chapter Header Info */}
            <div className="p-3 rounded-xl border border-border/70 bg-muted/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
                  Trạng thái Cảnh
                </span>
                <select
                  value={sceneStatus}
                  onChange={(e) => {
                    const next = e.target.value as any;
                    setSceneStatus(next);
                    saveBeats({ status: next });
                    toast.success('Đã cập nhật trạng thái cảnh');
                  }}
                  className="h-7 text-[11px] rounded-md bg-background border border-input px-2 text-primary font-medium"
                >
                  <option value="outline">Phác thảo (Outline)</option>
                  <option value="draft">Bản nháp (Draft)</option>
                  <option value="revised">Đã chỉnh lý (Revised)</option>
                  <option value="final">Hoàn thiện (Final)</option>
                </select>
              </div>
              <div className="text-sm font-serif font-semibold text-foreground truncate">
                {chapterTitle || 'Cảnh sáng tác hiện tại'}
              </div>
            </div>

            {/* Scene Objective (Mục tiêu cảnh) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-primary">
                  <Target className="w-3.5 h-3.5" />
                  Mục tiêu Cảnh (Scene Objective)
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">Tự động lưu</span>
              </label>
              <Textarea
                placeholder="Điều gì bắt buộc phải xảy ra hoặc thay đổi trong cảnh này?"
                value={sceneObjective}
                onChange={(e) => {
                  setSceneObjective(e.target.value);
                  saveBeats({ objective: e.target.value });
                }}
                className="h-18 text-xs bg-background border-input text-foreground resize-none leading-relaxed"
              />
            </div>

            {/* Main Character POV */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <User className="w-3.5 h-3.5" />
                  Góc nhìn chính (Scene POV)
                </span>
              </label>
              <Input
                placeholder="Ví dụ: Kaelen, Alex, Ngôi thứ ba giới hạn..."
                value={scenePov}
                onChange={(e) => {
                  setScenePov(e.target.value);
                  saveBeats({ pov: e.target.value });
                }}
                className="h-8 text-xs bg-background border-input text-foreground"
              />
            </div>

            {/* Scene Conflict & Stakes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <Flame className="w-3.5 h-3.5" />
                  Xung đột & Đặt cược (Conflict & Stakes)
                </span>
              </label>
              <Textarea
                placeholder="Trở ngại ngăn cản mục tiêu? Hậu quả nếu nhân vật thất bại?"
                value={sceneConflict}
                onChange={(e) => {
                  setSceneConflict(e.target.value);
                  saveBeats({ conflict: e.target.value });
                }}
                className="h-18 text-xs bg-background border-input text-foreground resize-none leading-relaxed"
              />
            </div>

            {/* Scene Scratchpad Notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <FileEdit className="w-3.5 h-3.5" />
                  Ghi chú nháp cảnh (Scene Notes)
                </span>
              </label>
              <Textarea
                placeholder="Các ý tưởng thoáng qua, đối thoại dự kiến, gợi ý gài bẫy..."
                value={sceneNotes}
                onChange={(e) => {
                  setSceneNotes(e.target.value);
                  saveBeats({ notes: e.target.value });
                }}
                className="h-24 text-xs bg-background border-input text-foreground resize-none leading-relaxed font-mono"
              />
            </div>
          </div>
        )}

        {/* ================= TAB 3: AI CO-PILOT ================= */}
        {activeTab === 'copilot' && (
          <div className="space-y-4 animate-in fade-in duration-150 text-xs">
            {/* Quick 1-Click Action Buttons Matrix */}
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                Thao tác sáng tác nhanh 1-chạm
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAIQuickAction('continue')}
                  disabled={aiLoading}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/50 text-left transition-all group active:scale-[0.98] shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 text-primary font-semibold text-xs mb-1">
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Tiếp tục phân đoạn</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-snug">
                    Phát triển diễn biến nối tiếp câu chuyện
                  </span>
                </button>

                <button
                  onClick={() => handleAIQuickAction('sensory')}
                  disabled={aiLoading}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-amber-500/50 text-left transition-all group active:scale-[0.98] shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs mb-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Miêu tả ngũ giác</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-snug">
                    Sống động âm thanh, ánh sáng & khí sắc
                  </span>
                </button>

                <button
                  onClick={() => handleAIQuickAction('dialogue')}
                  disabled={aiLoading}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-sky-500/50 text-left transition-all group active:scale-[0.98] shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold text-xs mb-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Trau chuốt thoại</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-snug">
                    Lời thoại sắc sảo, cá tính riêng biệt
                  </span>
                </button>

                <button
                  onClick={() => handleAIQuickAction('climax')}
                  disabled={aiLoading}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-rose-500/50 text-left transition-all group active:scale-[0.98] shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold text-xs mb-1">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Đẩy cao trào</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-snug">
                    Leo thang xung đột, kịch tính nghẹt thở
                  </span>
                </button>
              </div>
            </div>

            {/* Custom Instruction Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground block">
                Chỉ đạo đạo diễn riêng cho AI
              </label>
              <div className="relative">
                <Textarea
                  placeholder="Ví dụ: Cho nhân vật bộc lộ bí mật quá khứ, thêm chi tiết sương mù tràn vào..."
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  className="h-18 text-xs bg-background border-input text-foreground resize-none pr-10"
                />
                <Button
                  size="icon"
                  className="h-7 w-7 absolute right-2 bottom-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={aiLoading || !aiCustomPrompt.trim()}
                  onClick={() => handleAIQuickAction('continue', aiCustomPrompt)}
                  title="Gửi yêu cầu"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* AI Generation Stream & Result Panel */}
            {(aiLoading || aiOutput) && (
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-md animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className={`w-3.5 h-3.5 text-primary ${aiLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {aiLoading
                        ? 'AI đang sáng tác theo ngữ cảnh...'
                        : 'Bản thảo đề xuất từ AI'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {aiOutput && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={handleCopyOutput}
                          title="Sao chép"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => setAiOutput('')}
                          title="Đóng kết quả"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Output text */}
                <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto pr-1 font-serif bg-muted/30 p-2.5 rounded-lg border border-border/40">
                  {aiOutput}
                  {aiLoading && <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse" />}
                </div>

                {/* Direct Insert Button */}
                {aiOutput && !aiLoading && (
                  <div className="pt-2 border-t border-border/60 flex justify-end">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
                      onClick={() => {
                        handleInsertMention('\n\n' + aiOutput);
                        setAiOutput('');
                      }}
                    >
                      <Send className="w-3 h-3" />
                      Chèn trực tiếp vào bản thảo
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

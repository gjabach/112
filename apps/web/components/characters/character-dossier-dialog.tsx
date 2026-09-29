'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Sparkles, 
  Heart, 
  Sword, 
  Shield, 
  Brain, 
  Lock, 
  Plus, 
  Trash2, 
  Sliders, 
  Mic2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface Relationship {
  characterId: string;
  type: string;
  description: string;
}

interface Character {
  id?: string;
  projectId?: string;
  name: string;
  role: string;
  avatarUrl?: string;
  age?: string;
  gender?: string;
  occupation?: string;
  aliases?: string[];
  appearance?: string;
  personality?: string;
  speechPattern?: string;
  desires?: string; // The Want
  motivation?: string;
  characterArc?: string; // The Need
  secrets?: string;
  fears?: string;
  weaknesses?: string;
  strengths?: string;
  background?: string;
  relationships?: Relationship[];
  customFields?: Record<string, string>;
  tags?: string[];
}

interface CharacterDossierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character | null;
  allCharacters: Character[];
  onSave: (data: Partial<Character>) => Promise<void>;
  loading?: boolean;
}

export function CharacterDossierDialog({
  isOpen,
  onClose,
  character,
  allCharacters,
  onSave,
  loading = false
}: CharacterDossierDialogProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'psychology' | 'secrets' | 'relationships' | 'custom'>('general');
  const [form, setForm] = useState<Character>({
    name: '',
    role: 'supporting',
    avatarUrl: '',
    age: '',
    gender: '',
    occupation: '',
    aliases: [],
    appearance: '',
    personality: '',
    speechPattern: '',
    desires: '',
    motivation: '',
    characterArc: '',
    secrets: '',
    fears: '',
    weaknesses: '',
    strengths: '',
    background: '',
    relationships: [],
    customFields: {},
    tags: []
  });

  const [aliasInput, setAliasInput] = useState('');
  const [newRelCharId, setNewRelCharId] = useState('');
  const [newRelType, setNewRelType] = useState('ally');
  const [newRelDesc, setNewRelDesc] = useState('');

  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');

  useEffect(() => {
    if (character) {
      setForm({
        ...character,
        aliases: Array.isArray(character.aliases) ? character.aliases : [],
        relationships: Array.isArray(character.relationships) ? character.relationships : [],
        customFields: character.customFields && typeof character.customFields === 'object' ? character.customFields : {},
        tags: Array.isArray(character.tags) ? character.tags : []
      });
    } else {
      setForm({
        name: '',
        role: 'supporting',
        avatarUrl: '',
        age: '',
        gender: '',
        occupation: '',
        aliases: [],
        appearance: '',
        personality: '',
        speechPattern: '',
        desires: '',
        motivation: '',
        characterArc: '',
        secrets: '',
        fears: '',
        weaknesses: '',
        strengths: '',
        background: '',
        relationships: [],
        customFields: {},
        tags: []
      });
    }
    setActiveTab('general');
  }, [character, isOpen]);

  const handleAddAlias = () => {
    if (!aliasInput.trim()) return;
    const clean = aliasInput.trim();
    if (!form.aliases?.includes(clean)) {
      setForm(prev => ({ ...prev, aliases: [...(prev.aliases || []), clean] }));
    }
    setAliasInput('');
  };

  const handleRemoveAlias = (alias: string) => {
    setForm(prev => ({ ...prev, aliases: (prev.aliases || []).filter(a => a !== alias) }));
  };

  const handleAddRelationship = () => {
    if (!newRelCharId) {
      toast.error('Chọn nhân vật liên kết');
      return;
    }
    const newRel: Relationship = {
      characterId: newRelCharId,
      type: newRelType,
      description: newRelDesc.trim() || 'Có quan hệ tương tác'
    };
    setForm(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []).filter(r => r.characterId !== newRelCharId), newRel]
    }));
    setNewRelCharId('');
    setNewRelDesc('');
    toast.success('Đã thêm mối quan hệ!');
  };

  const handleRemoveRelationship = (charId: string) => {
    setForm(prev => ({
      ...prev,
      relationships: (prev.relationships || []).filter(r => r.characterId !== charId)
    }));
  };

  const handleAddCustomField = () => {
    if (!customKey.trim()) return;
    setForm(prev => ({
      ...prev,
      customFields: {
        ...(prev.customFields || {}),
        [customKey.trim()]: customVal.trim()
      }
    }));
    setCustomKey('');
    setCustomVal('');
  };

  const handleRemoveCustomField = (key: string) => {
    setForm(prev => {
      const next = { ...(prev.customFields || {}) };
      delete next[key];
      return { ...prev, customFields: next };
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Tên nhân vật không được để trống');
      return;
    }
    await onSave(form);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden border border-border/70 shadow-2xl bg-card rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center font-bold text-base text-primary">
                {form.name?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  {character ? `Hồ sơ: ${character.name}` : 'Thiết Lập Nhân Vật Mới'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Xây dựng chiều sâu tâm lý, ngoại hình, mâu thuẫn nội tâm và mạng lưới quan hệ
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex capitalize text-xs">
              {form.role === 'protagonist' ? '🌟 Nhân vật chính' : form.role === 'antagonist' ? '⚔️ Phản diện' : '🤝 Nhân vật phụ'}
            </Badge>
          </div>

          {/* Dossier Tabs */}
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t overflow-x-auto no-scrollbar text-xs">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'general' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Tổng quan & Ngoại hình
            </button>
            <button
              onClick={() => setActiveTab('psychology')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'psychology' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Brain className="w-3.5 h-3.5" /> Chiều sâu tâm lý (Arc)
            </button>
            <button
              onClick={() => setActiveTab('secrets')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'secrets' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Động cơ & Bí mật
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'relationships' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Heart className="w-3.5 h-3.5" /> Mối quan hệ ({(form.relationships || []).length})
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'custom' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Thuộc tính tự do
            </button>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* TAB 1: GENERAL & APPEARANCE */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-semibold text-foreground">Tên nhân vật *</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ví dụ: Lâm Vũ Phong, Elena Vance..."
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Vai trò trong truyện</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full h-8 border rounded-lg bg-background px-2 text-xs"
                  >
                    <option value="protagonist">🌟 Nhân vật chính (Protagonist)</option>
                    <option value="antagonist">⚔️ Phản diện (Antagonist)</option>
                    <option value="supporting">🤝 Nhân vật phụ (Supporting)</option>
                    <option value="minor">👤 Quần chúng (Minor)</option>
                  </select>
                </div>
              </div>

              {/* Aliases & Titles */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Danh xưng / Biệt hiệu / Tên giả</label>
                <div className="flex gap-2">
                  <Input
                    value={aliasInput}
                    onChange={e => setAliasInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                    placeholder="Ví dụ: Hắc Kiếm Sĩ, Đệ Nhất Kiếm Thần..."
                    className="h-8 text-xs flex-1"
                  />
                  <Button size="sm" type="button" onClick={handleAddAlias} className="h-8 text-xs">
                    Thêm danh xưng
                  </Button>
                </div>
                {form.aliases && form.aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {form.aliases.map(a => (
                      <Badge key={a} variant="secondary" className="text-[11px] gap-1 px-2 py-0.5">
                        {a}
                        <button type="button" onClick={() => handleRemoveAlias(a)} className="hover:text-destructive">
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Age, Gender, Occupation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="font-medium text-muted-foreground">Tuổi tác</label>
                  <Input
                    value={form.age || ''}
                    onChange={e => setForm({ ...form, age: e.target.value })}
                    placeholder="Ví dụ: 19 tuổi, Ngoại hình 25..."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-medium text-muted-foreground">Giới tính</label>
                  <Input
                    value={form.gender || ''}
                    onChange={e => setForm({ ...form, gender: e.target.value })}
                    placeholder="Ví dụ: Nam, Nữ, Phi nhị nguyên..."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-medium text-muted-foreground">Nghề nghiệp / Thân phận</label>
                  <Input
                    value={form.occupation || ''}
                    onChange={e => setForm({ ...form, occupation: e.target.value })}
                    placeholder="Ví dụ: Thợ săn ma vật, Hoằng tử lưu vong..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Appearance & Style */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Diện mạo, vóc dáng & Phong cách ăn mặc</label>
                <Textarea
                  value={form.appearance || ''}
                  onChange={e => setForm({ ...form, appearance: e.target.value })}
                  placeholder="Chiều cao, màu mắt, vết sẹo đặc trưng, trang phục thường ngày, vũ khí mang theo bên mình..."
                  className="min-h-[85px] text-xs leading-relaxed"
                />
              </div>

              {/* Speech Pattern / Voice */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5 text-primary" /> Ngữ điệu & Giọng nói đặc trưng (Speech Pattern)
                </label>
                <Input
                  value={form.speechPattern || ''}
                  onChange={e => setForm({ ...form, speechPattern: e.target.value })}
                  placeholder="Cách xưng hô (ta - ngươi, tôi - cậu), câu cửa miệng, giọng trầm ấm hay sắc sảo, thói quen ngừng ngắt..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PSYCHOLOGY & CHARACTER ARC */}
          {activeTab === 'psychology' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-[11px] text-muted-foreground leading-relaxed">
                💡 <strong>Bí quyết viết nhân vật lôi cuốn:</strong> Nhân vật có chiều sâu luôn có sự mâu thuẫn giữa điều họ <em>nghĩ mình khao khát (The Want)</em> và điều họ <em>thực sự cần để chữa lành (The Need)</em>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 border rounded-xl p-3 bg-muted/20">
                  <label className="font-semibold text-foreground text-xs text-amber-600 dark:text-amber-400">
                    Khát vọng bề nổi (The Want)
                  </label>
                  <p className="text-[10px] text-muted-foreground">Mục tiêu cụ thể mà nhân vật theo đuổi (e.g. Báo thù, đoạt ngai vàng, giải mã bí mật gia tộc).</p>
                  <Textarea
                    value={form.desires || ''}
                    onChange={e => setForm({ ...form, desires: e.target.value })}
                    placeholder="Mục tiêu tối thượng mà nhân vật luôn hướng tới..."
                    className="min-h-[75px] text-xs leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5 border rounded-xl p-3 bg-muted/20">
                  <label className="font-semibold text-foreground text-xs text-blue-600 dark:text-blue-400">
                    Nhu cầu tiềm thức (The Need)
                  </label>
                  <p className="text-[10px] text-muted-foreground">Bài học đạo đức / tinh thần mà nhân vật phải nhận ra để trưởng thành trọn vẹn.</p>
                  <Textarea
                    value={form.characterArc || ''}
                    onChange={e => setForm({ ...form, characterArc: e.target.value })}
                    placeholder="Bài học nhân vật cần học để vượt qua mâu thuẫn nội tâm..."
                    className="min-h-[75px] text-xs leading-relaxed"
                  />
                </div>
              </div>

              {/* The Lie & The Ghost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Lời dối trá tin tưởng (The Lie / Misbelief)</label>
                  <Textarea
                    value={form.personality || ''}
                    onChange={e => setForm({ ...form, personality: e.target.value })}
                    placeholder="Niềm tin sai lầm về bản thân hoặc thế giới (e.g. 'Không ai đáng tin', 'Kẻ yếu không có quyền sống')..."
                    className="min-h-[70px] text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Vết thương quá khứ (The Ghost / Wound)</label>
                  <Textarea
                    value={form.background || ''}
                    onChange={e => setForm({ ...form, background: e.target.value })}
                    placeholder="Biến cố đau buồn trong quá khứ đã sinh ra niềm tin sai lầm và nỗi sợ đó..."
                    className="min-h-[70px] text-xs"
                  />
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-medium text-emerald-600 dark:text-emerald-400">Phẩm chất & Điểm mạnh</label>
                  <Input
                    value={form.strengths || ''}
                    onChange={e => setForm({ ...form, strengths: e.target.value })}
                    placeholder="Quả cảm, mưu lược, trung thành, tài kiếm thuật..."
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-medium text-red-600 dark:text-red-400">Điểm yếu chí mạng & Nỗi sợ</label>
                  <Input
                    value={form.weaknesses || ''}
                    onChange={e => setForm({ ...form, weaknesses: e.target.value })}
                    placeholder="Cố chấp, sợ bị bỏ rơi, nghi ngờ đồng đội..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECRETS & MOTIVATION */}
          {activeTab === 'secrets' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Lock className="w-3.5 h-3.5" /> Bí mật thầm kín (Secrets)
                </label>
                <p className="text-[11px] text-muted-foreground">Những bí mật nếu bị vạch trần sẽ làm thay đổi hoàn toàn diễn biến câu chuyện.</p>
                <Textarea
                  value={form.secrets || ''}
                  onChange={e => setForm({ ...form, secrets: e.target.value })}
                  placeholder="Thân phận thực sự bị che giấu, tội lỗi trong quá khứ, bảo vật cấm mang theo..."
                  className="min-h-[90px] text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Động lực cốt lõi (Core Motivation)</label>
                <Textarea
                  value={form.motivation || ''}
                  onChange={e => setForm({ ...form, motivation: e.target.value })}
                  placeholder="Điều gì thúc đẩy nhân vật thức dậy mỗi sáng và không bao giờ chịu từ bỏ?"
                  className="min-h-[85px] text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Nỗi sợ tột cùng (Greatest Fear)</label>
                <Input
                  value={form.fears || ''}
                  onChange={e => setForm({ ...form, fears: e.target.value })}
                  placeholder="Điều tồi tệ nhất có thể xảy đến với nhân vật..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 4: RELATIONSHIPS */}
          {activeTab === 'relationships' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Add New Relationship */}
              <div className="border rounded-xl p-3 bg-muted/20 space-y-2.5">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" /> Thiết lập mối quan hệ mới
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newRelCharId}
                    onChange={e => setNewRelCharId(e.target.value)}
                    className="h-8 border rounded-lg bg-background px-2 text-xs"
                  >
                    <option value="">-- Chọn nhân vật đối tác --</option>
                    {allCharacters
                      .filter(c => c.id !== character?.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.role === 'protagonist' ? 'Chính' : c.role === 'antagonist' ? 'Phản diện' : 'Phụ'})
                        </option>
                      ))}
                  </select>

                  <select
                    value={newRelType}
                    onChange={e => setNewRelType(e.target.value)}
                    className="h-8 border rounded-lg bg-background px-2 text-xs"
                  >
                    <option value="love">❤️ Tình cảm / Tri kỷ</option>
                    <option value="enemy">⚔️ Kẻ thù / Thù hằn</option>
                    <option value="rival">⚡ Đối thủ cạnh tranh</option>
                    <option value="ally">🛡️ Đồng minh / Bạn bè</option>
                    <option value="mentor">🎓 Sư đồ / Thầy trò</option>
                    <option value="family">👨‍👩‍👧 Gia tộc / Huyết thống</option>
                    <option value="subordinate">👑 Chủ tớ / Thống trị</option>
                  </select>

                  <Input
                    value={newRelDesc}
                    onChange={e => setNewRelDesc(e.target.value)}
                    placeholder="Mô tả bối cảnh quan hệ..."
                    className="h-8 text-xs"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddRelationship())}
                  />
                </div>

                <div className="flex justify-end">
                  <Button size="sm" type="button" onClick={handleAddRelationship} className="h-7 text-xs">
                    Thêm vào hồ sơ
                  </Button>
                </div>
              </div>

              {/* List of Relationships */}
              <div className="space-y-2">
                <span className="font-semibold text-xs text-foreground block">
                  Danh sách mối quan hệ hiện tại ({(form.relationships || []).length})
                </span>

                {(!form.relationships || form.relationships.length === 0) ? (
                  <div className="text-center py-6 text-muted-foreground text-[11px] border border-dashed rounded-xl">
                    Chưa thiết lập mối quan hệ nào với các nhân vật khác.
                  </div>
                ) : (
                  form.relationships.map((rel) => {
                    const targetChar = allCharacters.find(c => c.id === rel.characterId);
                    return (
                      <div
                        key={rel.characterId}
                        className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/10 gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs border shrink-0">
                            {targetChar?.name?.[0]?.toUpperCase() || 'N'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold truncate">{targetChar?.name || 'Nhân vật khác'}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                {rel.type}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{rel.description}</p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemoveRelationship(rel.characterId)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOM FIELDS */}
          {activeTab === 'custom' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" /> Thêm trường thông tin tự do
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={customKey}
                    onChange={e => setCustomKey(e.target.value)}
                    placeholder="Tên trường (e.g. Vũ khí, Sở thích, Linh thú...)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={customVal}
                    onChange={e => setCustomVal(e.target.value)}
                    placeholder="Giá trị (e.g. Long Uyên Kiếm, Trà xanh...)"
                    className="h-8 text-xs"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomField())}
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" type="button" onClick={handleAddCustomField} className="h-7 text-xs">
                    Thêm trường
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                {Object.entries(form.customFields || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-2 rounded-lg border bg-muted/10 text-xs">
                    <span className="font-semibold text-muted-foreground">{k}:</span>
                    <span className="flex-1 px-3 truncate text-foreground">{v}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveCustomField(k)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/20 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading} className="text-xs h-8">
            Hủy
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading} className="text-xs h-8 font-semibold">
            {loading ? 'Đang lưu...' : 'Lưu Hồ Sơ Nhân Vật'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

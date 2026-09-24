'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { executeAIChat } from '@/lib/ai';
import { toast } from 'sonner';
import { Send, Sparkles, Trash2, Copy, Check, ArrowLeft, Bot, User as UserIcon } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

const skills = [
  { id: 'continue_writing', label: '✍️ Viết tiếp', desc: 'Sáng tác tiếp từ bối cảnh hiện tại' },
  { id: 'rewrite', label: '🔄 Viết lại', desc: 'Nâng cấp văn phong, trau chuốt câu từ' },
  { id: 'critique', label: '🔍 Phê bình', desc: 'Nhận xét điểm mạnh, điểm yếu và gợi ý sửa' },
  { id: 'expand', label: '🌿 Mở rộng', desc: 'Đào sâu miêu tả cảm xúc, chi tiết cảnh' },
  { id: 'brainstorm', label: '💡 Brainstorm', desc: 'Gợi ý nút thắt (plot twist) và tình huống mới' },
  { id: 'plot_hole', label: '🕳️ Tìm Plot Hole', desc: 'Soi lỗ hổng logic và bất hợp lý trong cốt truyện' },
  { id: 'character_voice', label: '🎭 Giọng nhân vật', desc: 'Điều chỉnh hội thoại tự nhiên, đậm cá tính' },
  { id: 'description_enhance', label: '👁️ Đánh thức giác quan', desc: 'Bổ sung âm thanh, mùi vị, ánh sáng' }
];

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const chapterId = searchParams.get('chapterId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép vào bộ nhớ đệm');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input;
    setInput('');
    setLoading(true);

    const tempUserMsg: Message = { id: 'temp-' + Date.now(), role: 'user', content: userMessage, createdAt: Date.now() };
    setMessages(prev => [...prev, tempUserMsg]);

    const assistantId = 'assistant-' + Date.now();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() }]);

    let assistantContent = '';
    try {
      await executeAIChat({
        message: userMessage,
        skill: selectedSkill,
        projectId: projectId || undefined,
        contextType: chapterId ? 'chapter' : 'project',
        contextId: chapterId || undefined,
        stream: true,
        onChunk: (chunk) => {
          assistantContent += chunk;
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
        }
      });
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi gọi AI');
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-65px)] max-w-6xl mx-auto">
        {/* Skills sidebar */}
        <div className="w-72 border-r bg-card p-4 hidden md:flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Kỹ năng AI (Skills)</h3>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            {skills.map(skill => (
              <button
                key={skill.id}
                onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                  selectedSkill === skill.id
                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                    : 'border-transparent bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="font-medium text-foreground">{skill.label}</div>
                <div className="text-[11px] opacity-80 mt-0.5 line-clamp-1">{skill.desc}</div>
              </button>
            ))}
          </div>

          {selectedSkill && (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs space-y-1">
              <div className="font-medium text-primary">Skill đang kích hoạt:</div>
              <div className="text-[11px] text-foreground">{skills.find(s => s.id === selectedSkill)?.label}</div>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] w-full mt-1" onClick={() => setSelectedSkill(null)}>
                Bỏ chọn skill
              </Button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">💡 Mẹo ngữ cảnh:</p>
            <p>AI tự động phân tích dàn ý, nhân vật và chương truyện gần nhất để đưa ra phản hồi bám sát cốt truyện.</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <div className="border-b p-3 bg-card flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {projectId && (
                <Link href={chapterId ? `/editor/${projectId}/${chapterId}` : `/editor/${projectId}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Quay lại trình soạn thảo">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <div className="min-w-0">
                <h1 className="font-bold text-sm flex items-center gap-2 truncate">
                  <span>Trợ lý sáng tác AI</span>
                  {selectedSkill && (
                    <Badge variant="secondary" className="text-[10px]">
                      {skills.find(s => s.id === selectedSkill)?.label}
                    </Badge>
                  )}
                </h1>
                <p className="text-[11px] text-muted-foreground truncate">
                  Hỗ trợ mạch truyện, tâm lý nhân vật và gợi ý sáng tác văn học
                </p>
              </div>
            </div>

            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-destructive" onClick={() => setMessages([])}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Xóa hội thoại
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-16 px-4 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base mb-1">Trợ lý đồng sáng tác của bạn</h3>
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Tôi có thể giúp bạn viết tiếp một cảnh quay, gỡ rối những điểm nghẽn cốt truyện (writer's block), hoặc đưa ra nhận xét văn học sắc bén.
                </p>
                <div className="grid grid-cols-2 gap-2 text-left">
                  {skills.slice(0, 4).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSkill(s.id)}
                      className="p-3 border rounded-lg hover:border-primary/50 hover:bg-accent/40 text-xs transition-colors"
                    >
                      <div className="font-medium mb-0.5">{s.label}</div>
                      <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/70 text-foreground border border-border/50 rounded-tl-sm'
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content || (loading && m.role === 'assistant' ? 'Đang suy nghĩ và sáng tác...' : '')}</div>

                    {m.role === 'assistant' && m.content && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(m.content, m.id)}
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-green-500" /> Đã chép
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" /> Sao chép
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-3 bg-card">
            <div className="flex gap-2">
              <Input
                placeholder={selectedSkill ? `Nhập yêu cầu cho skill ${skills.find(s=>s.id===selectedSkill)?.label}...` : "Hỏi AI hoặc yêu cầu sáng tác (ví dụ: Gợi ý 3 hướng đi tiếp theo cho nhân vật...)"}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                disabled={loading}
                className="text-sm h-10"
              />
              <Button onClick={sendMessage} disabled={loading || !input.trim()} className="h-10 px-4">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-muted-foreground">
              <span>{selectedSkill ? `Skill: ${selectedSkill}` : 'Sáng tác tự do'} • Streaming • Tự động nạp ngữ cảnh</span>
              <span>Enter để gửi</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function AIAssistantPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse text-muted-foreground">Đang mở trợ lý AI...</div>}>
      <AIAssistantContent />
    </Suspense>
  );
}

'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiFetch } from '@/lib/utils';
import { executeAIChat } from '@/lib/ai';
import { toast } from 'sonner';
import {
  Send,
  Sparkles,
  Trash2,
  Copy,
  Check,
  ArrowLeft,
  Bot,
  User as UserIcon,
  FileText,
  BookOpen,
} from 'lucide-react';
import {
  MagicSparkles,
  SparkleIcon,
  GlowingDot,
} from '@/components/vfx/magic-sparkles';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

const skills = [
  {
    id: 'continue_writing',
    label: '✍️ Viết tiếp',
    desc: 'Sáng tác tiếp từ bối cảnh hiện tại',
  },
  {
    id: 'rewrite',
    label: '🔄 Viết lại',
    desc: 'Nâng cấp văn phong, trau chuốt câu từ',
  },
  {
    id: 'critique',
    label: '🔍 Phê bình',
    desc: 'Nhận xét điểm mạnh, điểm yếu và gợi ý sửa',
  },
  {
    id: 'expand',
    label: '🌿 Mở rộng',
    desc: 'Đào sâu miêu tả cảm xúc, chi tiết cảnh',
  },
  {
    id: 'brainstorm',
    label: '💡 Brainstorm',
    desc: 'Gợi ý nút thắt (plot twist) và tình huống mới',
  },
  {
    id: 'plot_hole',
    label: '🕳️ Tìm Plot Hole',
    desc: 'Soi lỗ hổng logic và bất hợp lý trong cốt truyện',
  },
  {
    id: 'character_voice',
    label: '🎭 Giọng nhân vật',
    desc: 'Điều chỉnh hội thoại tự nhiên, đậm cá tính',
  },
  {
    id: 'description_enhance',
    label: '👁️ Đánh thức giác quan',
    desc: 'Bổ sung âm thanh, mùi vị, ánh sáng',
  },
];

const quickPrompts = [
  'Gợi ý 3 hướng đi tiếp theo cho cảnh quay này',
  'Miêu tả không gian và bầu không khí chi tiết',
  'Tạo một plot twist bất ngờ nhưng hợp lý',
  'Viết đoạn hội thoại kịch tính giữa hai nhân vật',
  'Tìm các điểm nghịch lý hoặc lỗ hổng cốt truyện',
];

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const chapterId = searchParams.get('chapterId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertingId, setInsertingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'nearest',
    });
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép vào bộ nhớ đệm');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const insertIntoChapter = async (text: string, msgId: string) => {
    if (!chapterId) return;
    setInsertingId(msgId);
    try {
      await apiFetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ appendContent: text }),
      });
      toast.success('Đã chèn nội dung vào cuối chương truyện!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi chèn vào chương');
    } finally {
      setInsertingId(null);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input;
    setInput('');
    setRequestError('');
    setLoading(true);

    const tempUserMsg: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: userMessage,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const assistantId = 'assistant-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      },
    ]);

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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            )
          );
        },
      });
    } catch (e: any) {
      const detail = e.message || 'Chưa thể kết nối với trợ lý AI';
      toast.error(detail);
      setRequestError(detail);
      setInput(userMessage);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) {
    return (
      <DashboardLayout projectId={projectId}>
        <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-6 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-serif font-bold mb-2 text-foreground">
            Trợ lý AI cần ngữ cảnh tác phẩm
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
            Để AI có thể hỗ trợ viết tiếp, biên soạn và phê bình bám sát cốt
            truyện, bạn hãy mở Trợ lý AI từ thanh công cụ bên trong bản thảo tác
            phẩm.
          </p>
          <Link href="/projects">
            <Button className="font-semibold shadow-md shadow-primary/20">
              <BookOpen className="w-4 h-4 mr-2" /> Đến Kệ Sách Sáng Tác
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout projectId={projectId}>
      <div className="studio-chat flex h-[calc(100dvh-64px)] lg:h-dvh min-h-0 max-w-6xl mx-auto">
        {/* Skills sidebar */}
        <div className="w-72 border-r bg-card p-4 hidden md:flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Kỹ năng AI (Skills)</h3>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() =>
                  setSelectedSkill(selectedSkill === skill.id ? null : skill.id)
                }
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                  selectedSkill === skill.id
                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                    : 'border-transparent bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="font-medium text-foreground">{skill.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  {skill.desc}
                </div>
              </button>
            ))}
          </div>

          {selectedSkill && (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs space-y-1">
              <div className="font-medium text-primary">
                Skill đang kích hoạt:
              </div>
              <div className="text-[11px] text-foreground">
                {skills.find((s) => s.id === selectedSkill)?.label}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] w-full mt-1"
                onClick={() => setSelectedSkill(null)}
              >
                Bỏ chọn skill
              </Button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">💡 Mẹo ngữ cảnh:</p>
            <p>
              Mở AI từ tác phẩm hoặc chương để cung cấp ngữ cảnh cho cuộc trao
              đổi.
            </p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
          <div className="border-b p-3 bg-card flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {projectId && (
                <Link
                  href={
                    chapterId
                      ? `/editor/${projectId}/${chapterId}`
                      : `/editor/${projectId}`
                  }
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Quay lại trình soạn thảo"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <div className="min-w-0">
                <h1 className="font-bold text-sm flex flex-wrap items-center gap-2">
                  <span>Trợ lý sáng tác AI</span>
                  {selectedSkill && (
                    <Badge variant="secondary" className="text-[10px]">
                      {skills.find((s) => s.id === selectedSkill)?.label}
                    </Badge>
                  )}
                </h1>
                <p className="text-[11px] text-muted-foreground truncate">
                  Hỗ trợ mạch truyện, tâm lý nhân vật và gợi ý sáng tác văn học
                </p>
              </div>
            </div>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setMessages([])}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Xóa hội thoại
              </Button>
            )}
          </div>

          <div className="border-b bg-card p-3 md:hidden">
            <label
              htmlFor="mobile-skill"
              className="mb-2 block text-xs font-medium text-muted-foreground"
            >
              Bạn muốn AI hỗ trợ điều gì?
            </label>
            <select
              id="mobile-skill"
              value={selectedSkill || ''}
              onChange={(event) => setSelectedSkill(event.target.value || null)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Sáng tác tự do</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 space-y-5">
            {messages.length === 0 ? (
              <div className="text-center py-16 px-4 max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <SparkleIcon size={28} color="currentColor" />
                </div>
                <h3 className="font-serif font-bold text-lg mb-1 tracking-tight">
                  Trợ lý đồng sáng tác của bạn
                </h3>
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Tôi có thể giúp bạn viết tiếp một cảnh quay, gỡ rối những điểm
                  nghẽn cốt truyện (writer&apos;s block), hoặc đưa ra nhận xét
                  văn học sắc bén.
                </p>
                <div className="grid grid-cols-2 gap-2 text-left">
                  {skills.slice(0, 4).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSkill(s.id);
                      }}
                      className="p-3 border rounded-xl hover:border-primary/50 hover:bg-accent/40 text-xs transition-all glass-card glow-card"
                    >
                      <div className="font-semibold mb-0.5 text-foreground flex items-center gap-1">
                        <span>{s.label}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0 mt-1 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'glass-card text-foreground border border-border/60 rounded-tl-sm'
                    }`}
                  >
                    {m.content ? (
                      <div className="whitespace-pre-wrap break-words leading-relaxed">
                        {m.content}
                      </div>
                    ) : loading && m.role === 'assistant' ? (
                      <div className="flex items-center gap-2 text-xs text-primary font-medium py-1">
                        <GlowingDot color="bg-primary" />
                        <span className="animate-pulse">
                          Đang vận dụng cảm hứng văn học để sáng tác...
                        </span>
                      </div>
                    ) : null}

                    {m.role === 'assistant' && m.content && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30 justify-end">
                        {chapterId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                            disabled={insertingId === m.id}
                            onClick={() => insertIntoChapter(m.content, m.id)}
                            title="Chèn văn bản này vào cuối chương đang viết"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            {insertingId === m.id
                              ? 'Đang chèn...'
                              : 'Chèn vào chương'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(m.content, m.id)}
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-green-500" />{' '}
                              Đã chép
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

          <div className="shrink-0 border-t p-3 sm:p-5 bg-card pb-[max(12px,env(safe-area-inset-bottom))]">
            {requestError && (
              <div
                role="alert"
                className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <p className="text-destructive">{requestError}</p>
                <p className="mt-1 text-muted-foreground">
                  Yêu cầu đã được giữ lại. Kiểm tra cấu hình AI trong Cài đặt,
                  rồi gửi lại khi sẵn sàng.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                >
                  Thử lại
                </Button>
              </div>
            )}
            {/* Quick prompt chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2">
              <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                Gợi ý:
              </span>
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                aria-label="Yêu cầu gửi cho trợ lý AI"
                placeholder={
                  selectedSkill
                    ? `Nhập yêu cầu cho skill ${skills.find((s) => s.id === selectedSkill)?.label}...`
                    : 'Hỏi AI hoặc yêu cầu sáng tác (ví dụ: Gợi ý 3 hướng đi tiếp theo cho nhân vật...)'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  !e.nativeEvent.isComposing &&
                  sendMessage()
                }
                disabled={loading}
                className="text-sm h-10"
              />
              <Button
                aria-label="Gửi yêu cầu cho AI"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="h-10 px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap justify-between gap-1 items-center mt-2 px-1 text-[11px] text-muted-foreground">
              <span>
                {selectedSkill
                  ? `Kỹ năng: ${skills.find((s) => s.id === selectedSkill)?.label}`
                  : 'Sáng tác tự do'}{' '}
                • Đang dùng ngữ cảnh tác phẩm
              </span>
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
    <Suspense
      fallback={
        <div className="p-8 animate-pulse text-muted-foreground">
          Đang mở trợ lý AI...
        </div>
      }
    >
      <AIAssistantContent />
    </Suspense>
  );
}

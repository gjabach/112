'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiFetch } from '@/lib/utils';
import { executeAIChat } from '@/lib/ai';
import { toast } from 'sonner';
import { Send, Sparkles, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

const skills = [
  { id: 'continue_writing', label: '✍️ Viết tiếp', desc: 'Viết tiếp câu chuyện' },
  { id: 'rewrite', label: '🔄 Viết lại', desc: 'Viết lại đoạn văn' },
  { id: 'critique', label: '🔍 Phê bình', desc: 'Nhận xét chi tiết' },
  { id: 'expand', label: '🌿 Mở rộng', desc: 'Mở rộng cảnh' },
  { id: 'brainstorm', label: '💡 Brainstorm', desc: 'Gợi ý ý tưởng' },
  { id: 'plot_hole', label: '🕳️ Plot Hole', desc: 'Tìm lỗ hổng' },
  { id: 'character_voice', label: '🎭 Giọng NV', desc: 'Cải thiện hội thoại' },
  { id: 'description_enhance', label: '👁️ Chi tiết', desc: 'Thêm chi tiết giác quan' }
];

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

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
      <div className="flex h-[calc(100vh-0px)] max-w-6xl mx-auto">
        {/* Skills sidebar */}
        <div className="w-64 border-r bg-card p-4 hidden md:block">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Skills</h3>
          <div className="space-y-2">
            {skills.map(skill => (
              <button key={skill.id} onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)} className={`w-full text-left p-2 rounded-lg border text-sm transition-colors ${selectedSkill === skill.id ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}>
                <div className="font-medium">{skill.label}</div>
                <div className="text-xs text-muted-foreground">{skill.desc}</div>
              </button>
            ))}
          </div>
          {selectedSkill && <div className="mt-4 p-3 bg-primary/10 rounded-lg text-xs">Đang dùng skill: <Badge variant="secondary" className="ml-1">{skills.find(s => s.id === selectedSkill)?.label}</Badge><Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setSelectedSkill(null)}>Bỏ chọn</Button></div>}
          <div className="mt-6 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Mẹo:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Chọn skill trước khi chat</li>
              <li>AI có context dự án nếu bạn mở từ editor</li>
              <li>BYOK: tự nhập API key trong Settings</li>
            </ul>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          <div className="border-b p-4 bg-card">
            <h1 className="font-bold">AI Assistant {projectId && <Badge variant="secondary" className="ml-2">Project: {projectId.slice(0,8)}</Badge>}</h1>
            <p className="text-sm text-muted-foreground">Trợ lý viết tiểu thuyết - Hỗ trợ brainstorm, viết tiếp, phê bình, tìm plot hole</p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Chào mừng đến với AI Assistant</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">Tôi có thể giúp bạn viết tiếp, viết lại, phê bình, brainstorm ý tưởng, phát hiện plot hole và nhiều hơn nữa. Chọn một skill bên trái và bắt đầu chat!</p>
                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                  {skills.slice(0,4).map(s => <Button key={s.id} variant="outline" size="sm" onClick={() => setSelectedSkill(s.id)}>{s.label}</Button>)}
                </div>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4 bg-card">
            <div className="flex gap-2">
              <Input placeholder={selectedSkill ? `Nhập nội dung cho ${skills.find(s=>s.id===selectedSkill)?.label}...` : "Nhập tin nhắn, ví dụ: Viết tiếp chương 3..."} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} disabled={loading} />
              <Button onClick={sendMessage} disabled={loading || !input.trim()}><Send className="w-4 h-4" /></Button>
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-muted-foreground">{selectedSkill ? `Skill: ${selectedSkill}` : 'Chat tự do'} • Streaming • BYOK</div>
              {messages.length > 0 && <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setConversationId(null); }}><Trash2 className="w-3 h-3 mr-1" /> Xóa chat</Button>}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function AIAssistantPage() {
  return (
    <Suspense fallback={<div className="p-8">Đang tải...</div>}>
      <AIAssistantContent />
    </Suspense>
  );
}

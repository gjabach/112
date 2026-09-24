'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { Eye, EyeOff, Save } from 'lucide-react';

const providers = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'] },
  { id: 'anthropic', name: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
  { id: 'gemini', name: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'] },
  { id: 'groq', name: 'Groq (miễn phí, nhanh)', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
  { id: 'ollama', name: 'Ollama Local', models: ['llama3.2', 'mistral', 'gemma2'] }
];

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-1.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');

  useEffect(() => {
    // 1. Load from localStorage first
    const savedProvider = localStorage.getItem('ai_provider');
    const savedModel = localStorage.getItem('ai_model');
    const savedKey = localStorage.getItem('ai_api_key');

    if (savedProvider) setAiProvider(savedProvider);
    if (savedModel) setAiModel(savedModel);
    if (savedKey) setApiKey(savedKey);

    // 2. Merge with user object
    if (user) {
      setProfileName(user.name || '');
      if (user.aiProvider && !savedProvider) setAiProvider(user.aiProvider);
      if (user.aiModel && !savedModel) setAiModel(user.aiModel);
      if (user.aiApiKey && !savedKey) setApiKey(user.aiApiKey);
    }
  }, [user]);

  const saveAISettings = async () => {
    if (!apiKey && aiProvider !== 'ollama') {
      toast.error('Vui lòng nhập API key của ' + aiProvider.toUpperCase());
      return;
    }
    setLoading(true);
    try {
      // 1. Save directly to localStorage for instant reliability
      localStorage.setItem('ai_provider', aiProvider);
      localStorage.setItem('ai_model', aiModel);
      if (apiKey) localStorage.setItem('ai_api_key', apiKey);

      // 2. Sync to auth store
      if (user) {
        setUser({
          ...user,
          aiProvider,
          aiModel,
          aiApiKey: apiKey
        });
      }

      // 3. Call apiFetch to sync with backend / localApi
      await apiFetch('/api/auth/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          aiProvider,
          aiModel,
          aiApiKey: apiKey || undefined
        })
      });

      toast.success('Đã lưu cấu hình AI thành công!');
    } catch (e: any) {
      toast.error('Lỗi khi lưu: ' + (e.message || 'Không xác định'));
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = () => {
    if (!profileName.trim()) { toast.error('Vui lòng nhập tên hiển thị'); return; }
    try {
      const userStr = localStorage.getItem('novelist_current_user');
      const u = userStr ? JSON.parse(userStr) : { email: 'user@example.com' };
      u.name = profileName;
      localStorage.setItem('novelist_current_user', JSON.stringify(u));
      if (user) setUser({ ...user, name: profileName });
      toast.success('Đã lưu tên hiển thị thành công!');
    } catch {
      toast.error('Không thể lưu profile');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Cài đặt</h1>
          <p className="text-muted-foreground">Quản lý tài khoản và AI</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin cá nhân</CardTitle>
            <CardDescription>Email: {user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Tên hiển thị" value={profileName} onChange={e => setProfileName(e.target.value)} />
            <Button variant="outline" onClick={saveProfile}><Save className="w-4 h-4 mr-2" /> Lưu profile</Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>🤖 Cấu hình AI (BYOK - Bring Your Own Key)</CardTitle>
            <CardDescription>
              Bạn tự nhập API key từ provider. Key được mã hóa AES-256-GCM trước khi lưu vào D1. Chúng tôi không lưu lịch sử chat lên server AI provider ngoài nội dung bạn gửi.
              <br /><br />
              <strong>Gợi ý miễn phí:</strong> Groq cho tốc độ cực nhanh free tier, hoặc Ollama chạy local hoàn toàn miễn phí.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">AI Provider</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {providers.map(p => (
                  <button key={p.id} onClick={() => { setAiProvider(p.id); setAiModel(p.models[0]); }} className={`p-3 rounded-lg border text-left text-sm transition-all ${aiProvider === p.id ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.models[0]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Model</label>
              <select className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm" value={aiModel} onChange={e => setAiModel(e.target.value)}>
                {providers.find(p => p.id === aiProvider)?.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">API Key {aiProvider !== 'ollama' && '*'}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input type={showKey ? 'text' : 'password'} placeholder={aiProvider === 'ollama' ? 'http://localhost:11434 (optional)' : `sk-... hoặc API key của ${aiProvider}`} value={apiKey} onChange={e => setApiKey(e.target.value)} />
                  <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {aiProvider === 'openai' && 'Lấy key tại: platform.openai.com/api-keys'}
                {aiProvider === 'anthropic' && 'Lấy key tại: console.anthropic.com'}
                {aiProvider === 'gemini' && 'Lấy key tại: aistudio.google.com/app/apikey (miễn phí)'}
                {aiProvider === 'groq' && 'Lấy key tại: console.groq.com/keys (miễn phí, nhanh)'}
                {aiProvider === 'ollama' && 'Cài Ollama local: ollama.ai, không cần key'}
              </p>
            </div>

            <Button onClick={saveAISettings} disabled={loading} className="w-full md:w-auto">
              <Save className="w-4 h-4 mr-2" /> Lưu cài đặt AI
            </Button>

            <div className="bg-muted p-4 rounded-lg text-sm">
              <div className="font-medium mb-1">🔒 Bảo mật</div>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>API key mã hóa AES-256-GCM trước khi lưu D1</li>
                <li>Chỉ bạn mới có thể dùng key của mình (row-level security)</li>
                <li>Streaming trực tiếp, không lưu log nhạy cảm</li>
                <li>Có thể xóa key bất kỳ lúc nào</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Giao diện</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Dark mode / Light mode / Sepia - Phase 2 sẽ có theme switcher đầy đủ</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { Eye, EyeOff, Save, Download, Upload, Database, RefreshCw, AlertCircle } from 'lucide-react';

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

  const exportAllData = () => {
    try {
      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        projects: JSON.parse(localStorage.getItem('novelist_projects') || '[]'),
        chapters: JSON.parse(localStorage.getItem('novelist_chapters') || '[]'),
        characters: JSON.parse(localStorage.getItem('novelist_characters') || '[]'),
        entities: JSON.parse(localStorage.getItem('novelist_entities') || '[]'),
        timelineEvents: JSON.parse(localStorage.getItem('novelist_timeline_events') || '[]'),
        timelineEras: JSON.parse(localStorage.getItem('novelist_timeline_eras') || '[]'),
        outlines: JSON.parse(localStorage.getItem('novelist_outlines') || '{}'),
        user: JSON.parse(localStorage.getItem('novelist_current_user') || 'null'),
        aiConfig: {
          provider: localStorage.getItem('ai_provider') || 'gemini',
          model: localStorage.getItem('ai_model') || 'gemini-1.5-flash',
          apiKey: localStorage.getItem('ai_api_key') || ''
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novelist_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Đã xuất file sao lưu toàn bộ dữ liệu thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi sao lưu dữ liệu: ' + (err.message || ''));
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data || typeof data !== 'object') {
          throw new Error('File sao lưu không đúng định dạng');
        }

        if (Array.isArray(data.projects)) {
          localStorage.setItem('novelist_projects', JSON.stringify(data.projects));
        }
        if (Array.isArray(data.chapters)) {
          localStorage.setItem('novelist_chapters', JSON.stringify(data.chapters));
        }
        if (Array.isArray(data.characters)) {
          localStorage.setItem('novelist_characters', JSON.stringify(data.characters));
        }
        if (Array.isArray(data.entities)) {
          localStorage.setItem('novelist_entities', JSON.stringify(data.entities));
        }
        if (Array.isArray(data.timelineEvents)) {
          localStorage.setItem('novelist_timeline_events', JSON.stringify(data.timelineEvents));
        }
        if (Array.isArray(data.timelineEras)) {
          localStorage.setItem('novelist_timeline_eras', JSON.stringify(data.timelineEras));
        }
        if (data.outlines && typeof data.outlines === 'object') {
          localStorage.setItem('novelist_outlines', JSON.stringify(data.outlines));
        }
        if (data.aiConfig) {
          if (data.aiConfig.provider) localStorage.setItem('ai_provider', data.aiConfig.provider);
          if (data.aiConfig.model) localStorage.setItem('ai_model', data.aiConfig.model);
          if (data.aiConfig.apiKey) localStorage.setItem('ai_api_key', data.aiConfig.apiKey);
          setAiProvider(data.aiConfig.provider || 'gemini');
          setAiModel(data.aiConfig.model || 'gemini-1.5-flash');
          setApiKey(data.aiConfig.apiKey || '');
        }

        toast.success('Khôi phục dữ liệu thành công! Đang tải lại...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        toast.error('Lỗi khi nạp file sao lưu: ' + (err.message || ''));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-500" />
              Sao lưu & Phục hồi dữ liệu (Backup & Restore)
            </CardTitle>
            <CardDescription>
              Toàn bộ tiểu thuyết, chương, nhân vật, dàn ý và thiết lập được lưu an toàn trong trình duyệt của bạn (LocalStorage).
              Xuất file dự phòng để không bao giờ sợ mất dữ liệu khi đổi trình duyệt, dọn máy hoặc đổi link Vercel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Mẹo quan trọng:</strong> Khi truy cập trên Vercel, hãy luôn dùng <strong>đường link Production chính cố định</strong> của bạn thay vì link Preview tạm thời. Dữ liệu trên link cố định sẽ <strong>không bao giờ bị mất</strong> qua các lần cập nhật code.
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={exportAllData} className="flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-500" />
                Tải về bản sao lưu (.json)
              </Button>

              <label className="inline-flex">
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button variant="outline" asChild className="cursor-pointer flex items-center gap-2">
                  <span>
                    <Upload className="w-4 h-4 text-sky-500" />
                    Phục hồi từ file sao lưu
                  </span>
                </Button>
              </label>
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

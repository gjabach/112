'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Eye, EyeOff, Save, Download, Upload, Database, RefreshCw, AlertCircle, CheckCircle2, Sun, Moon, Monitor } from 'lucide-react';

const providers = [
  { id: 'gemini', name: 'Google Gemini (Khuyên dùng)', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] },
  { id: 'groq', name: 'Groq (miễn phí, nhanh)', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'] },
  { id: 'anthropic', name: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
  { id: 'ollama', name: 'Ollama Local', models: ['llama3.2', 'mistral', 'gemma2'] }
];

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-1.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [profileName, setProfileName] = useState(user?.name || '');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    const cleanKey = apiKey.trim();
    if (!cleanKey && aiProvider !== 'ollama') {
      toast.error('Vui lòng nhập API key của ' + aiProvider.toUpperCase());
      return;
    }
    setLoading(true);
    try {
      // 1. Save directly to localStorage for instant reliability
      localStorage.setItem('ai_provider', aiProvider);
      localStorage.setItem('ai_model', aiModel);
      if (cleanKey) localStorage.setItem('ai_api_key', cleanKey);

      // 2. Sync to auth store
      if (user) {
        setUser({
          ...user,
          aiProvider,
          aiModel,
          aiApiKey: cleanKey
        });
      }

      // 3. Call apiFetch to sync with backend / localApi
      await apiFetch('/api/auth/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          aiProvider,
          aiModel,
          aiApiKey: cleanKey || undefined
        })
      });

      toast.success('Đã lưu cấu hình AI thành công!');
    } catch (e: any) {
      toast.error('Lỗi khi lưu: ' + (e.message || 'Không xác định'));
    } finally {
      setLoading(false);
    }
  };

  const testAIConnection = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey && aiProvider !== 'ollama') {
      toast.error('Vui lòng nhập API key trước khi kiểm tra');
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          model: aiModel,
          apiKey: cleanKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message });
        toast.success(data.message);
      } else {
        setTestResult({ success: false, message: data.error || 'Kiểm tra thất bại' });
        toast.error(data.error || 'Kiểm tra kết nối thất bại');
      }
    } catch (err: any) {
      const msg = err.message || 'Lỗi khi gửi yêu cầu kiểm tra';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingKey(false);
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
      const getStored = (key: string, fallback: any = []) => {
        try {
          const v = localStorage.getItem(key);
          return v ? JSON.parse(v) : fallback;
        } catch { return fallback; }
      };

      const backupData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        projects: getStored('novelist_projects', []),
        chapters: getStored('novelist_chapters', []),
        characters: getStored('novelist_characters', []),
        entities: getStored('novelist_worldbuilding', getStored('novelist_entities', [])),
        timeline: getStored('novelist_timeline', getStored('novelist_timeline_events', [])),
        timelineEras: getStored('novelist_timeline_eras', []),
        outline: getStored('novelist_outline', getStored('novelist_outlines', [])),
        user: getStored('novelist_current_user', null),
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

        const entitiesData = data.entities || data.worldbuilding || [];
        if (Array.isArray(entitiesData)) {
          localStorage.setItem('novelist_worldbuilding', JSON.stringify(entitiesData));
          localStorage.setItem('novelist_entities', JSON.stringify(entitiesData));
        }

        const timelineData = data.timeline || data.timelineEvents || [];
        if (Array.isArray(timelineData)) {
          localStorage.setItem('novelist_timeline', JSON.stringify(timelineData));
          localStorage.setItem('novelist_timeline_events', JSON.stringify(timelineData));
        }

        if (Array.isArray(data.timelineEras)) {
          localStorage.setItem('novelist_timeline_eras', JSON.stringify(data.timelineEras));
        }

        const outlineData = data.outline || data.outlines || [];
        if (outlineData) {
          localStorage.setItem('novelist_outline', JSON.stringify(outlineData));
          localStorage.setItem('novelist_outlines', JSON.stringify(outlineData));
        }

        if (data.user) {
          localStorage.setItem('novelist_current_user', JSON.stringify(data.user));
          if (data.user.name) setProfileName(data.user.name);
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

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveAISettings} disabled={loading || testingKey} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" /> Lưu cài đặt AI
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={testAIConnection}
                disabled={testingKey || loading || (!apiKey.trim() && aiProvider !== 'ollama')}
                className="w-full sm:w-auto border-primary/40 hover:bg-primary/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${testingKey ? 'animate-spin' : ''}`} />
                {testingKey ? 'Đang kiểm tra...' : '⚡ Kiểm tra kết nối'}
              </Button>
            </div>

            {testResult && (
              <div className={`p-3.5 rounded-lg border text-sm flex items-start gap-3 transition-all ${
                testResult.success
                  ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <div className="font-semibold">{testResult.success ? '✅ Kết nối thành công!' : '❌ Kết nối thất bại:'}</div>
                  <div className="text-xs mt-1 opacity-90 leading-relaxed font-mono whitespace-pre-wrap">{testResult.message}</div>
                </div>
              </div>
            )}

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
            <CardTitle>Giao diện & Chủ đề (Theme)</CardTitle>
            <CardDescription>Tùy chỉnh màu sắc để tối ưu trải nghiệm sáng tác và bảo vệ mắt</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  mounted && theme === 'dark' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-input hover:bg-muted/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-white shrink-0">
                  <Moon className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Giao diện Tối (Dark)</div>
                  <div className="text-xs text-muted-foreground">Dịu mắt, thích hợp viết đêm</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  mounted && theme === 'light' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-input hover:bg-muted/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-800 shadow-sm shrink-0">
                  <Sun className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Giao diện Sáng (Light)</div>
                  <div className="text-xs text-muted-foreground">Rõ nét, độ tương phản cao</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-4 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  mounted && theme === 'system' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-input hover:bg-muted/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Hệ thống (System)</div>
                  <div className="text-xs text-muted-foreground">Tự đồng bộ theo thiết bị</div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

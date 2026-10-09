'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PageHeader } from '@/components/studio/page-header';
import { SyncStatusButton } from '@/components/layout/sync-provider';
import { SoundToggleButton } from '@/components/layout/sound-provider';
import {
  MechKeyboardProvider,
  MechKeyboardToggle,
} from '@/components/editor/mech-keyboard-provider';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Save,
  Download,
  Upload,
  Database,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  Cloud,
  LogOut,
  BookOpen,
} from 'lucide-react';

const providers = [
  {
    id: 'gemini',
    name: 'Google Gemini (Khuyên dùng)',
    models: [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ],
  },
  {
    id: 'groq',
    name: 'Groq (miễn phí, nhanh)',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama Local',
    models: ['llama3.2', 'mistral', 'gemma2'],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-3.8-flash');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [profileName, setProfileName] = useState(user?.name || '');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // 1. Load from localStorage first
    const savedProvider = localStorage.getItem('ai_provider');
    const savedModel = localStorage.getItem('ai_model');
    const emailClean = (user?.email || '').trim().toLowerCase();
    const savedKey =
      (localStorage.getItem('ai_api_key') || '').trim() ||
      (emailClean
        ? (localStorage.getItem(`novelist_api_key_${emailClean}`) || '').trim()
        : '') ||
      (user?.aiApiKey || '').trim();

    let activeModel = savedModel;
    const deprecatedModels = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ];
    if (
      activeModel &&
      (deprecatedModels.includes(activeModel) ||
        activeModel.includes('2.0-flash') ||
        activeModel.includes('1.5-flash'))
    ) {
      activeModel = 'gemini-3.8-flash';
      localStorage.setItem('ai_model', 'gemini-3.8-flash');
    }

    if (savedProvider) setAiProvider(savedProvider);
    if (activeModel) setAiModel(activeModel);
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
      const emailClean = (user?.email || '').trim().toLowerCase();

      // 1. Save directly to localStorage for instant reliability & multi-tier resilience
      localStorage.setItem('ai_provider', aiProvider);
      localStorage.setItem('ai_model', aiModel);
      if (cleanKey) {
        localStorage.setItem('ai_api_key', cleanKey);
        if (emailClean)
          localStorage.setItem(`novelist_api_key_${emailClean}`, cleanKey);
      } else {
        localStorage.removeItem('ai_api_key');
        if (emailClean)
          localStorage.removeItem(`novelist_api_key_${emailClean}`);
      }

      // 2. Sync to auth store
      if (user) {
        setUser({
          ...user,
          aiProvider,
          aiModel,
          aiApiKey: cleanKey,
        });
      }

      // 3. Keep updated in novelist_users store & sync to cloud KV
      try {
        const usersStr = localStorage.getItem('novelist_users');
        if (usersStr) {
          const users = JSON.parse(usersStr);
          if (Array.isArray(users)) {
            const idx = users.findIndex(
              (u: any) =>
                u.id === user?.id ||
                (u.email && u.email.trim().toLowerCase() === emailClean)
            );
            if (idx !== -1) {
              users[idx].aiProvider = aiProvider;
              users[idx].aiModel = aiModel;
              users[idx].aiApiKey = cleanKey;
              localStorage.setItem('novelist_users', JSON.stringify(users));

              if (emailClean) {
                const { getCloudAccountKeys } = await import('@/lib/sync');
                const { userKey } = await getCloudAccountKeys(emailClean);
                fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${userKey}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(users[idx]),
                }).catch(() => {});
              }
            }
          }
        }
      } catch {}

      // 4. Call apiFetch to sync with backend / localApi
      await apiFetch('/api/auth/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          aiProvider,
          aiModel,
          aiApiKey: cleanKey || undefined,
        }),
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
          apiKey: cleanKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const finalModel =
          data.autoAdjusted && data.model ? data.model : aiModel;
        if (data.autoAdjusted && data.model) {
          setAiModel(data.model);
          localStorage.setItem('ai_model', data.model);
        }

        // Auto-save verified settings so they are never lost
        const emailClean = (user?.email || '').trim().toLowerCase();
        localStorage.setItem('ai_provider', aiProvider);
        localStorage.setItem('ai_model', finalModel);
        if (cleanKey) {
          localStorage.setItem('ai_api_key', cleanKey);
          if (emailClean)
            localStorage.setItem(`novelist_api_key_${emailClean}`, cleanKey);
        }
        if (user) {
          setUser({
            ...user,
            aiProvider,
            aiModel: finalModel,
            aiApiKey: cleanKey,
          });
        }

        setTestResult({ success: true, message: data.message });
        toast.success(data.message + ' (Đã tự động lưu cấu hình)');
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Kiểm tra thất bại',
        });
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
    if (!profileName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị');
      return;
    }
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
        } catch {
          return fallback;
        }
      };

      const backupData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        projects: getStored('novelist_projects', []),
        chapters: getStored('novelist_chapters', []),
        characters: getStored('novelist_characters', []),
        entities: getStored(
          'novelist_worldbuilding',
          getStored('novelist_entities', [])
        ),
        timeline: getStored(
          'novelist_timeline',
          getStored('novelist_timeline_events', [])
        ),
        timelineEras: getStored('novelist_timeline_eras', []),
        outline: getStored(
          'novelist_outline',
          getStored('novelist_outlines', [])
        ),
        user: getStored('novelist_current_user', null),
        aiConfig: {
          provider: localStorage.getItem('ai_provider') || 'gemini',
          model: localStorage.getItem('ai_model') || 'gemini-3.8-flash',
          apiKey: localStorage.getItem('ai_api_key') || '',
        },
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
          localStorage.setItem(
            'novelist_projects',
            JSON.stringify(data.projects)
          );
        }
        if (Array.isArray(data.chapters)) {
          localStorage.setItem(
            'novelist_chapters',
            JSON.stringify(data.chapters)
          );
        }
        if (Array.isArray(data.characters)) {
          localStorage.setItem(
            'novelist_characters',
            JSON.stringify(data.characters)
          );
        }

        const entitiesData = data.entities || data.worldbuilding || [];
        if (Array.isArray(entitiesData)) {
          localStorage.setItem(
            'novelist_worldbuilding',
            JSON.stringify(entitiesData)
          );
          localStorage.setItem(
            'novelist_entities',
            JSON.stringify(entitiesData)
          );
        }

        const timelineData = data.timeline || data.timelineEvents || [];
        if (Array.isArray(timelineData)) {
          localStorage.setItem(
            'novelist_timeline',
            JSON.stringify(timelineData)
          );
          localStorage.setItem(
            'novelist_timeline_events',
            JSON.stringify(timelineData)
          );
        }

        if (Array.isArray(data.timelineEras)) {
          localStorage.setItem(
            'novelist_timeline_eras',
            JSON.stringify(data.timelineEras)
          );
        }

        const outlineData = data.outline || data.outlines || [];
        if (outlineData) {
          localStorage.setItem('novelist_outline', JSON.stringify(outlineData));
          localStorage.setItem(
            'novelist_outlines',
            JSON.stringify(outlineData)
          );
        }

        if (data.user) {
          localStorage.setItem(
            'novelist_current_user',
            JSON.stringify(data.user)
          );
          if (data.user.name) setProfileName(data.user.name);
        }

        if (data.aiConfig) {
          if (data.aiConfig.provider)
            localStorage.setItem('ai_provider', data.aiConfig.provider);
          if (data.aiConfig.model)
            localStorage.setItem('ai_model', data.aiConfig.model);
          if (data.aiConfig.apiKey)
            localStorage.setItem('ai_api_key', data.aiConfig.apiKey);
          setAiProvider(data.aiConfig.provider || 'gemini');
          setAiModel(data.aiConfig.model || 'gemini-3.8-flash');
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
    <MechKeyboardProvider>
      <DashboardLayout>
        <div className="p-5 sm:p-8 lg:p-10 max-w-4xl mx-auto space-y-6">
          <PageHeader
            eyebrow="Theo cách của bạn"
            title="Cài đặt phòng viết"
            description="Tài khoản, công cụ AI và những điều giúp bạn viết thoải mái hơn."
          />
          <nav
            aria-label="Các nhóm cài đặt"
            className="flex flex-wrap gap-2 pb-2"
          >
            {[
              ['account', 'Tài khoản'],
              ['ai-config', 'Trợ lý AI'],
              ['sound', 'Âm thanh'],
              ['appearance', 'Giao diện'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={'#' + id}
                className="inline-flex min-h-11 items-center rounded-lg border bg-card px-4 text-xs hover:bg-accent"
              >
                {label}
              </a>
            ))}
          </nav>

          <Card id="account">
            <CardHeader>
              <CardTitle>Tài khoản</CardTitle>
              <CardDescription>Email: {user?.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                aria-label="Tên hiển thị"
                placeholder="Tên hiển thị"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={saveProfile}>
                  <Save className="w-4 h-4 mr-2" /> Lưu tên hiển thị
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    logout();
                    toast.success('Đã đăng xuất tài khoản thành công');
                    router.push('/login');
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="ai-config" className="border-primary/20">
            <CardHeader>
              <CardTitle>Trợ lý AI · Khóa API của bạn</CardTitle>
              <CardDescription>
                Chọn nhà cung cấp và nhập khóa API của bạn. Cấu hình được lưu
                trên thiết bị; nội dung yêu cầu sẽ được gửi đến dịch vụ AI đã
                chọn.
                <br />
                <br />
                <strong>Gợi ý miễn phí:</strong> Groq cho tốc độ cực nhanh free
                tier, hoặc Ollama chạy local hoàn toàn miễn phí.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  AI Provider
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      aria-pressed={aiProvider === p.id}
                      onClick={() => {
                        setAiProvider(p.id);
                        setAiModel(p.models[0]);
                      }}
                      className={`min-w-0 p-3 rounded-lg border text-left text-sm transition-colors ${aiProvider === p.id ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.models[0]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-model"
                  className="text-sm font-medium mb-2 block"
                >
                  Model
                </label>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  id="ai-model"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                >
                  {providers
                    .find((p) => p.id === aiProvider)
                    ?.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  API Key {aiProvider !== 'ollama' && '*'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="ai-key"
                      aria-label="Khóa API hoặc địa chỉ Ollama"
                      className="pr-14"
                      type={showKey ? 'text' : 'password'}
                      placeholder={
                        aiProvider === 'ollama'
                          ? 'http://localhost:11434 (optional)'
                          : `sk-... hoặc API key của ${aiProvider}`
                      }
                      value={apiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setApiKey(val);
                        const clean = val.trim();
                        if (clean) {
                          localStorage.setItem('ai_api_key', clean);
                          if (user?.email)
                            localStorage.setItem(
                              `novelist_api_key_${user.email.trim().toLowerCase()}`,
                              clean
                            );
                        }
                      }}
                    />
                    <button
                      type="button"
                      aria-label={showKey ? 'Ẩn khóa API' : 'Hiện khóa API'}
                      aria-pressed={showKey}
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 space-y-1.5">
                  {aiProvider === 'openai' && (
                    <p>Lấy key tại: platform.openai.com/api-keys</p>
                  )}
                  {aiProvider === 'anthropic' && (
                    <p>Lấy key tại: console.anthropic.com</p>
                  )}
                  {aiProvider === 'gemini' && (
                    <div className="space-y-1">
                      <p>
                        Lấy key tại:{' '}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-primary font-medium"
                        >
                          aistudio.google.com/app/apikey
                        </a>{' '}
                        (miễn phí)
                      </p>
                      <p className="text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                        💡 <strong>Mẹo quan trọng:</strong> Tại Google AI
                        Studio, hãy bấm nút <strong>"Create API key"</strong>{' '}
                        -&gt; chọn{' '}
                        <strong>"Create API key in new project"</strong> (dự án
                        mới) để Google tự động kích hoạt API và hạn mức miễn phí
                        (tránh lỗi bị chặn dịch vụ khi chọn dự án cũ).
                      </p>
                    </div>
                  )}
                  {aiProvider === 'groq' && (
                    <p>Lấy key tại: console.groq.com/keys (miễn phí, nhanh)</p>
                  )}
                  {aiProvider === 'ollama' && (
                    <p>Cài Ollama local: ollama.ai, không cần key</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={saveAISettings}
                  disabled={loading || testingKey}
                  className="w-full sm:w-auto"
                >
                  <Save className="w-4 h-4 mr-2" /> Lưu cài đặt AI
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={testAIConnection}
                  disabled={
                    testingKey ||
                    loading ||
                    (!apiKey.trim() && aiProvider !== 'ollama')
                  }
                  className="w-full sm:w-auto border-primary/40 hover:bg-primary/10"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${testingKey ? 'animate-spin' : ''}`}
                  />
                  {testingKey ? 'Đang kiểm tra...' : '⚡ Kiểm tra kết nối'}
                </Button>
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-lg border text-sm flex items-start gap-3 transition-all ${
                    testResult.success ? 'studio-success' : 'studio-danger'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-[hsl(var(--success))]" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-destructive" />
                  )}
                  <div>
                    <div className="font-semibold">
                      {testResult.success
                        ? '✅ Kết nối thành công!'
                        : '❌ Kết nối thất bại:'}
                    </div>
                    <div className="text-xs mt-1 opacity-90 leading-relaxed font-mono whitespace-pre-wrap">
                      {testResult.message}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-muted p-4 rounded-lg text-sm">
                <div className="font-medium mb-1">🔒 Bảo mật</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>
                    Cấu hình AI được lưu trên thiết bị để dùng cho lần viết tiếp
                    theo.
                  </li>
                  <li>
                    Khi dịch vụ có kết nối, cấu hình tài khoản có thể được đồng
                    bộ.
                  </li>
                  <li>
                    Nội dung yêu cầu được gửi đến nhà cung cấp AI bạn chọn.
                  </li>
                  <li>
                    Bạn có thể thay đổi khóa và nhà cung cấp trong phần này.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Account Cloud Auto-Save Status */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-primary" />
                Lưu trữ & đồng bộ
              </CardTitle>
              <CardDescription>
                Bản thảo được lưu trên thiết bị. Khi dịch vụ có kết nối, bạn có
                thể đồng bộ giữa các thiết bị cùng tài khoản. Kiểm tra trạng
                thái đồng bộ trước khi chuyển thiết bị.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-card/60">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    Tài khoản đang liên kết:
                  </div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                    {user?.email || 'Chưa đăng nhập'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lưu trên thiết bị; kiểm tra trạng thái trước khi chuyển sang
                    thiết bị khác.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SyncStatusButton />
                </div>
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
                Toàn bộ tiểu thuyết, chương, nhân vật, dàn ý và thiết lập được
                lưu an toàn trong trình duyệt của bạn (LocalStorage). Xuất file
                dự phòng để không bao giờ sợ mất dữ liệu khi đổi trình duyệt,
                dọn máy hoặc đổi link Vercel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="studio-warning border rounded-lg p-3 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Mẹo quan trọng:</strong> Khi truy cập trên Vercel, hãy
                  luôn dùng <strong>đường link Production chính cố định</strong>{' '}
                  của bạn thay vì link Preview tạm thời. Dùng cùng một địa chỉ
                  giúp bạn truy cập đúng dữ liệu đã lưu trên thiết bị. Hãy tải
                  bản sao lưu định kỳ.
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={exportAllData}
                  className="flex items-center gap-2"
                >
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
                  <Button
                    variant="outline"
                    asChild
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <span>
                      <Upload className="w-4 h-4 text-sky-500" />
                      Phục hồi từ file sao lưu
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card id="sound">
            <CardHeader>
              <CardTitle>Âm thanh</CardTitle>
              <CardDescription>
                Chọn âm thanh thao tác và bàn phím theo sở thích.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
                <div>
                  <p className="text-sm font-medium">Âm thanh phòng viết</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Điều chỉnh ngay tại đây hoặc trong menu của trình viết.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <SoundToggleButton />
                  <MechKeyboardToggle />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card id="appearance">
            <CardHeader>
              <CardTitle>Giao diện</CardTitle>
              <CardDescription>
                Chọn ánh sáng phù hợp với nhịp viết của bạn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    id: 'light',
                    label: 'Giấy ấm',
                    desc: 'Sáng và thoáng, như một trang sách.',
                    color: '#F7F4ED',
                    ink: '#242923',
                    Icon: Sun,
                  },
                  {
                    id: 'dark',
                    label: 'Mực đêm',
                    desc: 'Nền tối ấm cho những giờ viết muộn.',
                    color: '#191E1B',
                    ink: '#ECEDE5',
                    Icon: Moon,
                  },
                  {
                    id: 'sepia',
                    label: 'Sepia',
                    desc: 'Sắc giấy ngả nâu, nét mực cổ điển.',
                    color: '#E9DECA',
                    ink: '#59422E',
                    Icon: BookOpen,
                  },
                  {
                    id: 'system',
                    label: 'Theo thiết bị',
                    desc: 'Tự chuyển giữa sáng và tối.',
                    color: '#D9DED9',
                    ink: '#242923',
                    Icon: Monitor,
                  },
                ].map(({ id, label, desc, color, ink, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={mounted && theme === id}
                    onClick={() => setTheme(id)}
                    className={
                      'flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ' +
                      (mounted && theme === id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-accent')
                    }
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border"
                      style={{ background: color, color: ink }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </MechKeyboardProvider>
  );
}

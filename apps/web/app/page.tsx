import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Sparkles, Users, Map, Clock, FileText, Zap, Shield, Globe } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">N</div>
            <span>Novelist Studio</span>
            <Badge variant="secondary" className="ml-2">Beta</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost">Đăng nhập</Button></Link>
            <Link href="/register"><Button>Bắt đầu viết miễn phí</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <Badge className="mb-4" variant="secondary">✨ Chạy 24/7 hoàn toàn miễn phí trên Cloudflare</Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Viết tiểu thuyết<br />
            <span className="text-primary">chuyên nghiệp</span> hơn
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Công cụ all-in-one cho nhà văn Việt Nam. Quản lý nhân vật, xây dựng thế giới, outline thông minh, AI hỗ trợ viết - tất cả trong một nơi.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register"><Button size="lg" className="text-lg px-8 py-6">Bắt đầu miễn phí - Không cần thẻ</Button></Link>
            <Link href="#features"><Button size="lg" variant="outline" className="text-lg px-8 py-6">Xem tính năng</Button></Link>
          </div>
          
          {/* Hero mockup */}
          <div className="relative rounded-2xl border bg-card shadow-2xl p-2 md:p-4 overflow-hidden">
            <div className="bg-muted rounded-xl h-[400px] flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Editor 3 cột - Focus mode - AI Assistant</p>
                <div className="mt-4 flex gap-2 justify-center">
                  <div className="w-20 h-3 bg-primary/20 rounded-full"></div>
                  <div className="w-32 h-3 bg-primary/40 rounded-full"></div>
                  <div className="w-16 h-3 bg-primary/20 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">Mọi thứ bạn cần để hoàn thành tiểu thuyết</h2>
            <p className="text-muted-foreground text-lg">Lấy cảm hứng từ Notion, Scrivener, Ulysses nhưng hiện đại hơn và dành cho người Việt</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2"><FileText className="w-5 h-5 text-primary" /></div>
                <CardTitle>Editor chuyên nghiệp</CardTitle>
                <CardDescription>Rich text với Tiptap, focus mode, typewriter mode, auto-save, version history, Pomodoro</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-2"><Users className="w-5 h-5 text-purple-500" /></div>
                <CardTitle>Quản lý nhân vật</CardTitle>
                <CardDescription>Profile chi tiết, relationship graph, character arc, consistency check bằng AI</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-2"><Map className="w-5 h-5 text-green-500" /></div>
                <CardTitle>Xây dựng thế giới</CardTitle>
                <CardDescription>Locations, magic systems, species, organizations với bản đồ tương tác và link entities</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-2"><Sparkles className="w-5 h-5 text-blue-500" /></div>
                <CardTitle>AI Assistant (BYOK)</CardTitle>
                <CardDescription>Hỗ trợ OpenAI, Claude, Gemini, Groq, Ollama. 15+ skills: viết tiếp, rewrite, critique, plot hole detection</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mb-2"><Clock className="w-5 h-5 text-orange-500" /></div>
                <CardTitle>Outline & Timeline</CardTitle>
                <CardDescription>3-Act, Hero Journey, Save the Cat. Timeline vertical, corkboard, Trello board view</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center mb-2"><BookOpen className="w-5 h-5 text-pink-500" /></div>
                <CardTitle>Xuất bản đa định dạng</CardTitle>
                <CardDescription>PDF, DOCX, EPUB, Markdown, HTML. Style templates: Modern, Classic, Minimal</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Miễn phí mãi mãi</h2>
          <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">Chạy 100% trên Cloudflare Free Tier. Không phí ẩn, không giới hạn tính năng. Bạn chỉ cần tự nhập API key AI (BYOK).</p>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <div className="text-3xl font-bold">$0 <span className="text-sm font-normal text-muted-foreground">/tháng</span></div>
                <CardDescription>Cho mọi nhà văn</CardDescription>
              </CardHeader>
              <CardContent className="text-left space-y-3">
                <div className="flex gap-2"><Zap className="w-4 h-4 text-green-500" /> Không giới hạn projects</div>
                <div className="flex gap-2"><Zap className="w-4 h-4 text-green-500" /> Không giới hạn chapters</div>
                <div className="flex gap-2"><Zap className="w-4 h-4 text-green-500" /> Full editor + AI (BYOK)</div>
                <div className="flex gap-2"><Zap className="w-4 h-4 text-green-500" /> Export PDF/DOCX/EPUB</div>
                <div className="flex gap-2"><Zap className="w-4 h-4 text-green-500" /> Cloudflare D1 + R2 + KV</div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary shadow-lg scale-105">
              <CardHeader>
                <Badge className="w-fit mx-auto mb-2">Phổ biến</Badge>
                <CardTitle>Pro (BYOK)</CardTitle>
                <div className="text-3xl font-bold">$0 <span className="text-sm font-normal text-muted-foreground">+ API key của bạn</span></div>
                <CardDescription>Bạn tự quản lý AI cost</CardDescription>
              </CardHeader>
              <CardContent className="text-left space-y-3">
                <div className="flex gap-2"><Shield className="w-4 h-4 text-primary" /> Tất cả tính năng Free</div>
                <div className="flex gap-2"><Shield className="w-4 h-4 text-primary" /> OpenAI, Claude, Gemini, Groq</div>
                <div className="flex gap-2"><Shield className="w-4 h-4 text-primary" /> Ollama local miễn phí</div>
                <div className="flex gap-2"><Shield className="w-4 h-4 text-primary" /> API key mã hóa AES-256</div>
                <div className="flex gap-2"><Shield className="w-4 h-4 text-primary" /> Không lưu lịch sử chat lên server AI</div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle>Self-Hosted</CardTitle>
                <div className="text-3xl font-bold">Open Source</div>
                <CardDescription>Cho team & enterprise</CardDescription>
              </CardHeader>
              <CardContent className="text-left space-y-3">
                <div className="flex gap-2"><Globe className="w-4 h-4 text-blue-500" /> Deploy lên Cloudflare của bạn</div>
                <div className="flex gap-2"><Globe className="w-4 h-4 text-blue-500" /> Code trên GitHub</div>
                <div className="flex gap-2"><Globe className="w-4 h-4 text-blue-500" /> Custom domain</div>
                <div className="flex gap-2"><Globe className="w-4 h-4 text-blue-500" /> White-label</div>
                <div className="flex gap-2"><Globe className="w-4 h-4 text-blue-500" /> Community support</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Sẵn sàng viết tiểu thuyết tiếp theo?</h2>
          <p className="text-xl opacity-90 mb-8">Tham gia hàng nghìn nhà văn đang dùng Novelist Studio. Miễn phí, không cần thẻ tín dụng.</p>
          <Link href="/register"><Button size="lg" variant="secondary" className="text-lg px-8 py-6">Bắt đầu viết ngay →</Button></Link>
          <p className="text-sm opacity-70 mt-4">Mất chưa tới 30 giây để tạo tài khoản</p>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 font-bold text-foreground mb-4">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground text-sm">N</div>
            Novelist Studio
          </div>
          <p>Built with ❤️ for Vietnamese writers. 100% free on Cloudflare.</p>
          <p className="text-xs mt-2">Next.js 15 + Hono + D1 + R2 + KV + Tiptap + AI</p>
        </div>
      </footer>
    </div>
  );
}

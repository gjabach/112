import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Sparkles,
  Users,
  Map,
  Clock,
  FileText,
  Zap,
  Shield,
  Globe,
  ArrowRight,
  CheckCircle2,
  Feather,
  Flame,
  Volume2
} from 'lucide-react';
import { AmbientBackground } from '@/components/vfx/ambient-background';
import { MagicSparkles, SparkleIcon, GlowingDot } from '@/components/vfx/magic-sparkles';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Dynamic Cosmic Aurora Lighting */}
      <AmbientBackground intensity="medium" />

      {/* Header */}
      <header className="border-b border-border/60 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl group">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-md shadow-primary/30 group-hover:scale-105 transition-transform">
              N
            </div>
            <span className="tracking-tight">Novelist Studio</span>
            <Badge variant="secondary" className="ml-1 text-[10px] bg-primary/10 text-primary border-primary/20">
              Studio Edition
            </Badge>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="font-medium text-sm">Đăng nhập</Button>
            </Link>
            <Link href="/register">
              <MagicSparkles>
                <Button className="font-medium text-sm shadow-md shadow-primary/25 bg-primary hover:bg-primary/90">
                  Bắt đầu viết miễn phí
                </Button>
              </MagicSparkles>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 z-10">
        <div className="container mx-auto px-4 text-center max-w-5xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6 shadow-sm">
            <SparkleIcon size={13} color="currentColor" />
            <span>Studio Sáng Tác Toàn Năng Cho Nhà Văn Việt Nam</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight mb-6 leading-[1.08]">
            Viết tiểu thuyết<br />
            <span className="gradient-text drop-shadow-sm">chuyên nghiệp & kỳ ảo</span> hơn
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Không gian sáng tác văn học all-in-one cao cấp. Quản lý nhân vật, xây dựng thế giới huyền bí, dòng thời gian đa tuyến, AI cộng sự sáng tạo đỉnh cao.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link href="/register">
              <Button size="lg" className="text-base px-8 py-6 rounded-xl shadow-xl shadow-primary/30 font-semibold btn-interactive flex items-center gap-2">
                <span>Bắt đầu viết ngay — Hoàn toàn miễn phí</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-base px-8 py-6 rounded-xl border-border/80 hover:bg-accent/60 btn-interactive">
                Khám phá tính năng Studio
              </Button>
            </Link>
          </div>

          {/* Interactive 3D Perspective Studio Mockup */}
          <div className="relative mx-auto max-w-4xl p-2 md:p-3 rounded-2xl bg-gradient-to-b from-border/70 via-border/30 to-border/10 shadow-2xl border backdrop-blur-xl">
            {/* Ambient backlight glow behind mockup */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-600/30 via-pink-600/20 to-indigo-600/30 blur-xl opacity-60 -z-10" />

            <div className="rounded-xl overflow-hidden border border-border/80 bg-card shadow-inner flex flex-col text-left">
              {/* Fake Window Header Bar */}
              <div className="h-10 bg-muted/60 border-b border-border/60 px-4 flex items-center justify-between text-xs text-muted-foreground select-none">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                  <span className="ml-2 font-mono text-[11px] opacity-75">Novelist Studio • Thiên Mệnh Kỷ • Chương 12</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[11px] text-green-500 font-medium">
                    <GlowingDot color="bg-green-500" ping={false} /> Tự động lưu
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5 font-mono">1,842 từ</Badge>
                </div>
              </div>

              {/* Fake Editor Canvas Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[360px] md:min-h-[420px]">
                {/* Left Mini Sidebar */}
                <div className="hidden md:block md:col-span-3 border-r border-border/50 bg-muted/20 p-4 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mục lục chương</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="p-2 rounded-lg bg-accent/60 font-medium text-foreground flex items-center justify-between">
                      <span className="truncate">Chương 12: Đêm Trăng Máu</span>
                      <span className="text-[10px] text-muted-foreground font-mono">1.8k</span>
                    </div>
                    <div className="p-2 rounded-lg hover:bg-accent/30 text-muted-foreground flex items-center justify-between">
                      <span className="truncate">Chương 11: Thành Phố Tro Tàn</span>
                      <span className="text-[10px] text-muted-foreground font-mono">2.1k</span>
                    </div>
                    <div className="p-2 rounded-lg hover:bg-accent/30 text-muted-foreground flex items-center justify-between">
                      <span className="truncate">Chương 10: Lời Nguyền Cổ Xưa</span>
                      <span className="text-[10px] text-muted-foreground font-mono">1.6k</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nhân vật trong cảnh</div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">Lâm Dực</Badge>
                      <Badge variant="secondary" className="text-[10px]">Tử Dạ</Badge>
                      <Badge variant="secondary" className="text-[10px]">Thủ hộ linh</Badge>
                    </div>
                  </div>
                </div>

                {/* Main Writing Canvas */}
                <div className="md:col-span-9 p-6 md:p-8 relative flex flex-col justify-between bg-card">
                  {/* Fake Manuscript Excerpt */}
                  <div className="space-y-4 max-w-xl font-serif text-foreground/90">
                    <h3 className="text-2xl font-bold font-serif text-foreground tracking-tight">
                      Chương 12: Đêm Trăng Máu
                    </h3>
                    <p className="text-base leading-relaxed">
                      Gió rít qua khe cửa sổ gỗ mun, mang theo hơi sương lạnh ngắt như cắt da thịt của rặng núi tuyết phương Bắc. Lâm Dực siết chặt cán kiếm tàn, ánh thép lạnh phản chiếu đôi đồng tử màu hổ phách đang rực sáng trong đêm tối...
                    </p>
                    <p className="text-base leading-relaxed text-muted-foreground">
                      &quot;Ngươi vẫn chọn bước tiếp con đường này sao?&quot; Giọng nói của Tử Dạ vang lên từ bóng tối, trầm và sâu như tiếng chuông chùa giữa khuya tịch mịch.
                    </p>
                  </div>

                  {/* Floating AI Magic Suggestion Card */}
                  <div className="mt-6 p-3.5 rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-md shadow-lg flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-primary flex items-center gap-1.5 mb-0.5">
                        <span>AI Đồng Tác Giả (Gemini / Claude / OpenAI)</span>
                        <Badge variant="outline" className="text-[9px] py-0 border-primary/40 text-primary">Gợi ý viết tiếp</Badge>
                      </div>
                      <p className="text-muted-foreground italic">
                        &quot;Lâm Dực không đáp. Hắn chỉ nhẹ nhàng bước về phía trước, nơi ngọn lửa sinh mệnh đang chập chờn như muốn tắt lịm trước cơn bão tuyết sắp ập tới...&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-32 relative z-10 border-t border-border/40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-3 px-3 py-1 border-primary/30 text-primary font-medium">
              ✨ Tính năng Studio Đỉnh Cao
            </Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4 tracking-tight">
              Mọi công cụ bạn cần để hoàn thành đại tác phẩm
            </h2>
            <p className="text-muted-foreground text-lg">
              Kế thừa sự tinh giản của Ulysses, sức mạnh cấu trúc của Scrivener, nhưng mang tâm hồn và ngữ điệu văn học thuần Việt.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="glass-card glow-card border border-border/70 hover:border-primary/50">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold">Trình Soạn Thảo Chuyên Nghiệp</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Rich text TipTap chuẩn A4, Zen Focus Mode, Typewriter mode khóa tiêu cự con trỏ, tự động lưu thời gian thực và đếm từ chính xác.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card glow-card border border-border/70 hover:border-purple-500/50">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle className="text-xl font-bold">Hồ Sơ Nhân Vật Sâu Sắc</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Quản lý tính cách, động cơ, ngoại hình, cây quan hệ và arc biến đổi tâm lý của từng nhân vật xuyên suốt bộ tiểu thuyết.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card glow-card border border-border/70 hover:border-emerald-500/50">
              <CardHeader>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                  <Map className="w-6 h-6 text-emerald-500" />
                </div>
                <CardTitle className="text-xl font-bold">Kiến Tạo Thế Giới (Worldbuilding)</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Xây dựng hệ thống phép thuật, địa lý, thần thoại, bang phái, cổ vật và các định luật vật lý riêng cho vũ trụ truyện của bạn.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card glow-card border border-border/70 hover:border-blue-500/50">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                  <Sparkles className="w-6 h-6 text-blue-500" />
                </div>
                <CardTitle className="text-xl font-bold">AI Đồng Tác Giả (BYOK)</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Tự do gắn key Gemini, Claude, OpenAI hoặc Ollama. 15+ trợ lý chuyên biệt: viết tiếp, nâng cấp văn phong, soi plot hole và gợi ý nút thắt.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card glow-card border border-border/70 hover:border-amber-500/50">
              <CardHeader>
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl font-bold">Dàn Ý & Dòng Thời Gian Đa Tuyến</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Cấu trúc 3 hồi, Hero&apos;s Journey, Save the Cat, bảng Kanban thẻ chương và dòng thời gian trực quan giúp câu chuyện luôn mạch lạc.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card glow-card border border-border/70 hover:border-pink-500/50">
              <CardHeader>
                <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                  <BookOpen className="w-6 h-6 text-pink-500" />
                </div>
                <CardTitle className="text-xl font-bold">Xuất Bản Sách Đa Định Dạng</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Xuất bản sách in PDF khổ A4/A5 chuyên nghiệp với bìa tự động, tệp Word DOCX chuẩn biên tập và sách điện tử EPUB hoàn hảo cho Kindle.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing / Cloudflare Free Pledge */}
      <section className="py-20 md:py-28 relative z-10 bg-muted/20 border-t border-border/50">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-3 px-3 py-1 font-medium">
            💎 Triết Lý Của Chúng Tôi
          </Badge>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4 tracking-tight">
            Miễn phí trọn đời cho mọi ngòi bút
          </h2>
          <p className="text-muted-foreground mb-14 max-w-2xl mx-auto text-base md:text-lg">
            Vận hành trên nền tảng Cloudflare Edge & D1 Database. Không có phí ẩn, không giới hạn tính năng. Bạn chỉ cần tự nhập API key AI nếu muốn dùng AI.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="glass-card border border-border/70 text-left">
              <CardHeader>
                <CardTitle className="text-lg">Bản Nhà Văn (Writer)</CardTitle>
                <div className="text-3xl font-bold mt-1">0đ <span className="text-xs font-normal text-muted-foreground">/trọn đời</span></div>
                <CardDescription>Dành cho mọi tác giả bắt đầu sáng tác</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Không giới hạn dự án & chương</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Quản lý nhân vật & thế giới</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Đồng bộ đa thiết bị (PC & Mobile)</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Xuất bản PDF, DOCX, EPUB</div>
              </CardContent>
            </Card>

            <Card className="glass-card border-2 border-primary shadow-xl shadow-primary/10 relative text-left scale-105">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground font-semibold px-3 py-0.5 text-xs shadow-md">
                  Studio Khuyên Dùng
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">AI Studio (BYOK)</CardTitle>
                <div className="text-3xl font-bold mt-1">0đ <span className="text-xs font-normal text-muted-foreground">+ Key AI cá nhân</span></div>
                <CardDescription>Toàn quyền khai phóng trí tuệ nhân tạo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Toàn bộ tính năng Bản Nhà Văn</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Hỗ trợ Google Gemini, Claude, OpenAI</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 15+ Trợ lý chuyên sâu theo ngữ cảnh</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Mã hóa Key bảo mật, không lưu lịch sử</div>
              </CardContent>
            </Card>

            <Card className="glass-card border border-border/70 text-left">
              <CardHeader>
                <CardTitle className="text-lg">Mã Nguồn Mở</CardTitle>
                <div className="text-3xl font-bold mt-1">GitHub <span className="text-xs font-normal text-muted-foreground">/Open-source</span></div>
                <CardDescription>Tự do tùy biến và tự host</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" /> Mã nguồn mở hoàn toàn</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" /> Triển khai trên Cloudflare Pages</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" /> Hỗ trợ mô hình AI cục bộ (Ollama)</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" /> Hoàn toàn kiểm soát dữ liệu</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-20 relative z-10 bg-gradient-to-r from-violet-900 via-indigo-950 to-purple-900 text-white overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="container mx-auto px-4 text-center max-w-3xl relative z-10">
          <SparkleIcon size={32} color="#fbbf24" style={{ margin: '0 auto 16px auto' }} />
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4 tracking-tight drop-shadow-md">
            Sẵn sàng viết nên kiệt tác của đời bạn?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto leading-relaxed">
            Hòa mình cùng không gian viết tĩnh lặng, tiện nghi và truyền cảm hứng nhất hiện nay.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-base px-8 py-6 rounded-xl font-bold text-primary shadow-xl hover:scale-105 transition-all">
              Bắt đầu sáng tác ngay bây giờ →
            </Button>
          </Link>
          <p className="text-xs opacity-60 mt-4">Chỉ mất 20 giây để khởi tạo bàn làm việc</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10 text-center text-muted-foreground text-xs relative z-10 bg-card/40 backdrop-blur-md">
        <div className="container mx-auto px-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <div className="w-5 h-5 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-xs">N</div>
            <span>Novelist Studio</span>
          </div>
          <p>Được thiết kế với tất cả niềm đam mê văn chương dành cho các nhà văn Việt Nam.</p>
          <p className="opacity-60 text-[11px]">Next.js 15 • TipTap • Web Audio VFX • Hono • Cloudflare D1</p>
        </div>
      </footer>
    </div>
  );
}

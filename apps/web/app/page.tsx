import Link from 'next/link';
import {
  ArrowRight,
  Feather,
  BookOpen,
  Sparkles,
  Download,
  Cloud,
  ListTree,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudioBrand } from '@/components/studio/brand';
import { Reveal } from '@/components/studio/reveal';
import { ManuscriptPreview } from '@/components/studio/manuscript-preview';
import { LandingNav } from '@/components/layout/landing-nav';
const features = [
  {
    number: '01',
    icon: Feather,
    title: 'Một nơi để viết thật sâu',
    description:
      'Bản thảo thoáng, chữ dễ đọc. Định dạng, tìm và thay thế ngay trong không gian sáng tác.',
  },
  {
    number: '02',
    icon: ListTree,
    title: 'Câu chuyện có cấu trúc',
    description:
      'Sắp xếp chương và thẻ tài liệu theo cây. Theo dõi số từ và tiến độ của từng tác phẩm.',
  },
  {
    number: '03',
    icon: Sparkles,
    title: 'Một cộng sự khi bạn cần',
    description:
      'Gợi ý viết tiếp, biên tập và trao đổi ý tưởng với AI qua khóa API của riêng bạn.',
  },
  {
    number: '04',
    icon: Download,
    title: 'Từ bản thảo đến cuốn sách',
    description:
      'Xuất PDF, DOCX hoặc EPUB để đọc lại, chia sẻ và tiếp tục biên tập.',
  },
];
export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip selection:bg-primary/15">
      <header className="sticky top-0 z-40 border-b bg-background/95">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <StudioBrand compact />
          <nav
            aria-label="Điều hướng giới thiệu"
            className="hidden items-center gap-8 text-sm text-muted-foreground lg:flex"
          >
            <a href="#features" className="hover:text-primary">
              Không gian sáng tác
            </a>
            <a href="#workflow" className="hover:text-primary">
              Cách bắt đầu
            </a>
          </nav>
          <LandingNav />
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-28">
          <Reveal>
            <p className="studio-eyebrow mb-7 flex items-center gap-3">
              <span className="h-px w-8 bg-primary" />
              Dành cho những người kể chuyện
            </p>
            <h1 className="font-serif text-[clamp(3.2rem,6vw,5.6rem)] font-medium leading-[1.02] tracking-[-0.035em]">
              Câu chuyện lớn.
              <br />
              <span className="italic text-primary">Bắt đầu từ bạn.</span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-muted-foreground">
              Một góc yên tĩnh cho trí tưởng tượng. Viết, sắp xếp và hoàn thiện
              cuốn tiểu thuyết của bạn — từng trang một.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/register">
                  Mở trang viết đầu tiên <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">Khám phá studio</a>
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary" />
              Miễn phí sử dụng · AI với khóa API của bạn
            </p>
            <div className="mt-10 flex items-center gap-4 border-t pt-6">
              <div className="flex -space-x-2">
                {['A', 'M', 'L'].map((letter, i) => (
                  <span
                    key={letter}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-[10px] ${i === 1 ? 'bg-primary/15 text-primary' : 'bg-secondary text-foreground'}`}
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Cho tác phẩm đầu tay.
                <br />
                Và những câu chuyện còn dang dở.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="relative">
            <div
              className="absolute -right-3 -top-6 hidden font-serif text-7xl text-primary/15 sm:block"
              aria-hidden="true"
            >
              “
            </div>
            <ManuscriptPreview />
            <div className="ml-auto mt-5 flex max-w-xs items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <p className="font-serif text-sm">
                  Một chương nữa, một bước gần hơn.
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Mỗi câu chữ đều có ý nghĩa.
                </p>
              </div>
            </div>
          </Reveal>
        </section>
        <section
          id="features"
          className="border-y bg-card/50 px-5 py-20 sm:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="studio-eyebrow mb-4">Trong phòng viết của bạn</p>
                <h2 className="max-w-xl font-serif text-4xl font-medium leading-tight sm:text-5xl">
                  Đủ công cụ.
                  <br />
                  Đủ khoảng trống để sáng tạo.
                </h2>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Từ ý tưởng đầu tiên đến bản thảo hoàn chỉnh, studio đi cùng nhịp
                viết của bạn.
              </p>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ number, icon: Icon, title, description }, i) => (
                <Reveal
                  key={number}
                  delay={i * 0.06}
                  className="studio-surface p-6"
                >
                  <div className="mb-10 flex items-center justify-between">
                    <Icon className="h-6 w-6 text-primary" strokeWidth={1.4} />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {number}
                    </span>
                  </div>
                  <h3 className="mb-3 font-serif text-2xl leading-tight">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section id="workflow" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <Reveal className="grid gap-10 md:grid-cols-2">
            <div>
              <p className="studio-eyebrow mb-4">
                Không cần một khởi đầu hoàn hảo
              </p>
              <h2 className="font-serif text-4xl font-medium sm:text-5xl">
                Chỉ cần câu
                <br />
                <span className="italic text-primary">đầu tiên.</span>
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Đặt tên cho tác phẩm, mở một chương và để câu chuyện tìm thấy
                hình hài của nó.
              </p>
            </div>
            <ol className="space-y-0">
              {[
                [
                  'Đặt tên câu chuyện',
                  'Tạo tác phẩm, thêm bìa sách và mục tiêu số từ.',
                ],
                [
                  'Tìm nhịp viết của bạn',
                  'Mở chương, sắp xếp ý tưởng và viết theo cách của bạn.',
                ],
                [
                  'Mang tác phẩm ra thế giới',
                  'Xuất bản thảo ở định dạng phù hợp khi bạn sẵn sàng.',
                ],
              ].map(([title, desc], i) => (
                <li key={title} className="flex gap-5 border-b py-6 first:pt-0">
                  <span className="font-serif text-3xl italic text-primary/60">
                    0{i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>
        <section className="px-5 pb-20 sm:px-8">
          <Reveal className="mx-auto max-w-7xl rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div>
                <Feather className="mb-5 h-7 w-7" strokeWidth={1.3} />
                <h2 className="font-serif text-4xl font-medium">
                  Trang giấy đang chờ bạn.
                </h2>
                <p className="mt-4 text-sm opacity-85">
                  Một không gian riêng. Một câu chuyện của riêng bạn.
                </p>
              </div>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/register">
                  Bắt đầu sáng tác <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>
      <footer className="border-t px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
          <StudioBrand />
          <p className="text-xs text-muted-foreground">
            Được tạo cho những câu chuyện bằng tiếng Việt.
          </p>
          <a
            href="#features"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Cloud className="h-4 w-4" />
            Lưu bản nháp & đồng bộ khi có kết nối
          </a>
        </div>
      </footer>
    </div>
  );
}

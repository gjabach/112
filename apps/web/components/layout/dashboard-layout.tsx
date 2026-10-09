'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  ArrowUpRight,
  ListTree,
  Download,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { initAutoSync } from '@/lib/sync';
import { SyncStatusButton } from './sync-provider';
import { StudioBrand } from '@/components/studio/brand';
import { StudioState } from '@/components/studio/page-header';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function DashboardLayout({
  children,
  projectId,
  mode = 'library',
}: {
  children: React.ReactNode;
  projectId?: string | null;
  mode?: 'library' | 'project' | 'writing';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('novelist_current_user');
    if (token && userStr) {
      try {
        const u = JSON.parse(userStr);
        if (!useAuthStore.getState().isAuthenticated)
          useAuthStore.getState().setAuth(u, token);
        setIsReady(true);
        initAutoSync();
        return;
      } catch {}
    }
    if (!useAuthStore.getState().isAuthenticated) router.push('/login');
    else {
      setIsReady(true);
      initAutoSync();
    }
  }, [router]);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  const items = [
    { href: '/projects', label: 'Tác phẩm', icon: BookOpen },
    {
      href: projectId
        ? `/ai-assistant?projectId=${projectId}`
        : '/ai-assistant',
      label: 'Trợ lý AI',
      icon: Sparkles,
    },
    { href: '/settings', label: 'Cài đặt', icon: Settings },
  ];
  const projectItems = projectId
    ? [
        { href: `/editor/${projectId}`, label: 'Tổng quan', icon: ListTree },
        { href: `/export/${projectId}`, label: 'Xuất bản', icon: Download },
      ]
    : [];
  const navigation = (
    <>
      <p className="studio-eyebrow mb-4 px-3">Không gian của bạn</p>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href.split('?')[0];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
              active
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.6} />
            {item.label}
          </Link>
        );
      })}
      {projectItems.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <p className="studio-eyebrow mb-4 px-3">Tác phẩm đang mở</p>
          {projectItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cn(
                'mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm',
                pathname === item.href
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
  const account = (
    <div className="space-y-4 border-t p-5">
      <SyncStatusButton className="w-full justify-center" />
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-primary">
          {user?.name?.[0] || user?.email?.[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {user?.name || 'Nhà văn'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {user?.email}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => {
          logout();
          router.push('/');
        }}
      >
        <LogOut />
        Đăng xuất
      </Button>
    </div>
  );
  if (!isReady)
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <StudioState
          busy
          title="Đang mở phòng viết"
          description="Khôi phục phiên làm việc của bạn…"
        />
      </div>
    );
  if (mode === 'writing') return <>{children}</>;
  return (
    <div className="flex min-h-dvh min-w-0">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-card/65 lg:flex xl:w-60">
        <div className="px-6 py-7">
          <StudioBrand href="/projects" />
        </div>
        <nav
          aria-label="Điều hướng studio"
          className="flex-1 overflow-y-auto p-4 pt-6"
        >
          {navigation}
        </nav>
        <div className="mx-5 mb-5 rounded-xl border bg-muted/30 p-4">
          <p className="font-serif text-lg italic">Cứ viết tiếp.</p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Một đoạn văn hôm nay.
            <br />
            Một câu chuyện ngày mai.
          </p>
        </div>
        {account}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mở điều hướng"
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </Button>
            <StudioBrand href="/projects" compact />
          </div>
          <SyncStatusButton compact />
        </header>
        <main id="studio-content" className="min-w-0">
          {children}
        </main>
      </div>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen} drawer>
        <DialogContent className="flex min-h-dvh flex-col rounded-none border-0 p-4">
          <div className="mb-8 pr-8">
            <StudioBrand href="/projects" />
            <DialogTitle className="sr-only">Điều hướng studio</DialogTitle>
          </div>
          <nav aria-label="Điều hướng di động" className="flex-1">
            {navigation}
          </nav>
          {account}
        </DialogContent>
      </Dialog>
    </div>
  );
}

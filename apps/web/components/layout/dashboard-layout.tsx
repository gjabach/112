'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  LayoutDashboard, 
  Users, 
  Map, 
  Sparkles, 
  Settings, 
  LogOut, 
  PenTool, 
  BarChart3, 
  LayoutList, 
  Clock,
  Smartphone,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { initAutoSync, setSyncKey, pullSync } from '@/lib/sync';
import { SyncDialog } from '@/components/sync/sync-dialog';
import { toast } from 'sonner';

const navItems = [
  { href: '/projects', label: 'Dự án', icon: LayoutDashboard },
  { href: '/ai-assistant', label: 'AI Assistant', icon: Sparkles },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // 1. Initialize auto-sync engine
    initAutoSync();

    // 2. Check for sync_key query parameter (e.g. from QR code scan or share link)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const incomingSyncKey = urlParams.get('sync_key');
      if (incomingSyncKey) {
        setSyncKey(incomingSyncKey);
        pullSync(true).then((res) => {
          if (res.success) {
            toast.success('🎉 Đã đồng bộ thành công! Toàn bộ dữ liệu từ máy tính đã được tải về điện thoại.');
          }
        });
        // Clean URL parameter
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-40">
        <Link href="/projects" className="flex items-center gap-2 font-bold text-base">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">N</div>
          Novelist Studio
        </Link>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSyncDialogOpen(true)}
          className="h-8 text-xs border-primary/40 text-primary flex items-center gap-1.5"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Đồng bộ</span>
        </Button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b">
          <Link href="/projects" className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">N</div>
            Novelist Studio
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Sync Button in Sidebar */}
          <button
            type="button"
            onClick={() => setSyncDialogOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all mt-4"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4" />
              <span>Đồng bộ điện thoại</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </button>
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">{user?.name?.[0] || user?.email[0].toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Nhà văn'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { logout(); router.push('/'); }}>
            <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-card border-t flex items-center justify-around px-2 z-40">
        <Link 
          href="/projects" 
          className={`flex flex-col items-center justify-center text-[10px] gap-1 flex-1 py-1 ${
            pathname.startsWith('/projects') ? 'text-primary font-bold' : 'text-muted-foreground'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dự án</span>
        </Link>
        <Link 
          href="/ai-assistant" 
          className={`flex flex-col items-center justify-center text-[10px] gap-1 flex-1 py-1 ${
            pathname.startsWith('/ai-assistant') ? 'text-primary font-bold' : 'text-muted-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI</span>
        </Link>
        <button 
          onClick={() => setSyncDialogOpen(true)}
          className="flex flex-col items-center justify-center text-[10px] gap-1 flex-1 py-1 text-primary font-medium"
        >
          <Smartphone className="w-4 h-4" />
          <span>Đồng bộ</span>
        </button>
        <Link 
          href="/settings" 
          className={`flex flex-col items-center justify-center text-[10px] gap-1 flex-1 py-1 ${
            pathname.startsWith('/settings') ? 'text-primary font-bold' : 'text-muted-foreground'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cài đặt</span>
        </Link>
      </nav>

      {/* Sync Dialog Modal */}
      <SyncDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen} />
    </div>
  );
}


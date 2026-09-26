'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { useEffect } from 'react';
import { initAutoSync } from '@/lib/sync';
import { AmbientBackground } from '@/components/vfx/ambient-background';
import { SparkleIcon } from '@/components/vfx/magic-sparkles';

const navItems = [
  { href: '/projects', label: 'Dự án', icon: LayoutDashboard },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Initialize silent background auto-sync across devices
    initAutoSync();
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="relative min-h-screen bg-background flex flex-col md:flex-row pb-16 md:pb-0 overflow-x-hidden">
      {/* Ambient background VFX lighting */}
      <AmbientBackground intensity="subtle" />

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <Link href="/projects" className="flex items-center gap-2 font-bold text-base">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm">N</div>
          <span className="tracking-tight">Novelist Studio</span>
        </Link>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="truncate max-w-[120px]">{user?.name || user?.email?.split('@')[0]}</span>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border/60 bg-card/75 backdrop-blur-xl hidden md:flex flex-col shrink-0 z-20">
        <div className="p-6 border-b border-border/50">
          <Link href="/projects" className="flex items-center gap-2 font-bold text-lg group">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
              N
            </div>
            <span className="tracking-tight group-hover:text-primary transition-colors">Novelist Studio</span>
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
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">{user?.name?.[0] || user?.email?.[0]?.toUpperCase()}</div>
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

      {/* Mobile Bottom Navigation Bar with Glassmorphism */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-card/85 backdrop-blur-xl border-t border-border/60 flex items-center justify-around px-2 z-40 shadow-lg">
        <Link 
          href="/projects" 
          className={`flex flex-col items-center justify-center text-[10px] gap-1 flex-1 py-1 transition-all active:scale-95 ${
            pathname.startsWith('/projects') ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dự án</span>
        </Link>
        <Link 
          href="/settings" 
          className={`flex flex-col items-center justify-center text-[10px] gap-1 flex-1 py-1 transition-all active:scale-95 ${
            pathname.startsWith('/settings') ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cài đặt</span>
        </Link>
      </nav>
    </div>
  );
}

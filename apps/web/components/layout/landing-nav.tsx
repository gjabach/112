'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MagicSparkles } from '@/components/vfx/magic-sparkles';
import { LayoutDashboard, ArrowRight } from 'lucide-react';

export function LandingNav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('novelist_current_user');
      if (token && userStr) {
        setIsLoggedIn(true);
        const u = JSON.parse(userStr);
        setUserName(u.name || u.email?.split('@')[0] || 'Tác giả');
      }
    } catch {}
  }, []);

  if (isLoggedIn) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button className="font-semibold text-sm shadow-md shadow-primary/25 bg-primary hover:bg-primary/90 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span>Vào phòng viết ({userName})</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
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
  );
}

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to client console for diagnostics
    console.error('Unhandled Client Exception:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
      <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border bg-card/60 backdrop-blur-md shadow-xl flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Đã xảy ra sự cố khi tải trang</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Hệ thống gặp lỗi nhỏ khi xử lý dữ liệu. Đừng lo, dữ liệu tiểu thuyết của bạn vẫn an toàn trên đám mây.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            onClick={() => reset()}
            className="flex-1 gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Thử tải lại
          </Button>
          <Button
            variant="outline"
            asChild
            className="flex-1 gap-2"
          >
            <Link href="/projects">
              <Home className="w-4 h-4" /> Về dự án
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

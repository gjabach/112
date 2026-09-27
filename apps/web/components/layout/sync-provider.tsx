'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initAutoSync, syncBidirectional, exportFullWorkspace, type SyncStatus } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Cloud, Check, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SyncContextType {
  status: SyncStatus;
  lastSynced: number | null;
  syncNow: (force?: boolean) => Promise<boolean>;
}

const SyncContext = createContext<SyncContextType>({
  status: 'idle',
  lastSynced: null,
  syncNow: async () => false
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novelist_last_synced');
      return saved ? parseInt(saved, 10) : null;
    }
    return null;
  });

  useEffect(() => {
    // 1. Initialize auto-sync across entire application
    initAutoSync();

    // 2. Listen to custom sync status events
    const handleStatus = (e: any) => {
      if (e?.detail?.status) {
        setStatus(e.detail.status);
      }
      if (e?.detail?.timestamp) {
        setLastSynced(e.detail.timestamp);
      }
    };

    const handleUpdated = () => {
      setStatus('synced');
      setLastSynced(Date.now());
    };

    window.addEventListener('novelist-sync-status', handleStatus);
    window.addEventListener('novelist-sync-updated', handleUpdated);

    return () => {
      window.removeEventListener('novelist-sync-status', handleStatus);
      window.removeEventListener('novelist-sync-updated', handleUpdated);
    };
  }, []);

  const syncNow = useCallback(async (force: boolean = true) => {
    setStatus('syncing');
    try {
      const res = await syncBidirectional();
      const current = exportFullWorkspace();
      const totalChapters = Array.isArray(current?.chapters) ? current.chapters.length : 0;

      if (res.success) {
        setStatus('synced');
        setLastSynced(Date.now());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('novelist-sync-updated', { detail: { data: current } }));
        }
        toast.success(`Đồng bộ hoàn tất! Hiện có ${totalChapters} chương`);
        return true;
      } else {
        setStatus('error');
        toast.error('Chưa thể kết nối đám mây: ' + (res.error || 'Vui lòng thử lại'));
        return false;
      }
    } catch (e: any) {
      setStatus('error');
      toast.error('Lỗi khi đồng bộ: ' + (e?.message || 'Vui lòng thử lại'));
      return false;
    }
  }, []);

  return (
    <SyncContext.Provider value={{ status, lastSynced, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}

/**
 * Universal Sync Status Button component.
 * Can be rendered on mobile header or desktop toolbar.
 * Provides clear visual feedback and manual one-tap sync.
 */
export function SyncStatusButton({ 
  className = '', 
  compact = false 
}: { 
  className?: string; 
  compact?: boolean; 
}) {
  const { status, syncNow } = useSync();
  const [isClicking, setIsClicking] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isClicking || status === 'syncing') return;
    setIsClicking(true);
    await syncNow(true);
    setIsClicking(false);
  };

  const isSpinning = status === 'syncing' || isClicking;

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isSpinning}
        title={isSpinning ? 'Đang đồng bộ đám mây...' : status === 'error' ? 'Lỗi đồng bộ (Bấm để thử lại)' : 'Đồng bộ đám mây (Bấm để cập nhật)'}
        className={`h-8 w-8 rounded-lg relative ${className}`}
      >
        {isSpinning ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : status === 'error' ? (
          <AlertCircle className="w-4 h-4 text-rose-500" />
        ) : (
          <Cloud className="w-4 h-4 text-emerald-500 hover:text-emerald-400" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isSpinning}
      className={`h-8 px-2.5 text-xs font-medium gap-1.5 transition-all ${
        status === 'error'
          ? 'border-rose-500/40 text-rose-500 hover:bg-rose-500/10'
          : 'border-border/70 hover:border-primary/50 text-foreground'
      } ${className}`}
      title="Bấm để đồng bộ dữ liệu ngay lập tức giữa PC và Điện thoại"
    >
      {isSpinning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="hidden sm:inline">Đang đồng bộ...</span>
        </>
      ) : status === 'error' ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>Thử lại đồng bộ</span>
        </>
      ) : (
        <>
          <Cloud className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">Đồng bộ</span>
        </>
      )}
    </Button>
  );
}
